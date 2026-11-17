import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { attempts, engineNotes } from "@/db/schema";

export const ENGINE_KINDS = ["rule", "pattern", "note"] as const;
export type EngineKind = (typeof ENGINE_KINDS)[number];

export const ENGINE_LABEL: Record<EngineKind, string> = {
  rule: "Marking rules learned",
  pattern: "Candidate patterns",
  note: "Notes for the examiner",
};

/** Notes are capped so the prompt cannot grow without bound. */
const MAX_IN_PROMPT = 40;

export async function listEngineNotes(): Promise<
  { id: number; kind: EngineKind; content: string; source: string; attemptId: number | null; createdAt: string }[]
> {
  const rows = await db.select().from(engineNotes).orderBy(desc(engineNotes.createdAt)).limit(200);
  return rows.map((r) => ({
    id: r.id,
    kind: (ENGINE_KINDS as readonly string[]).includes(r.kind) ? (r.kind as EngineKind) : "note",
    content: r.content,
    source: r.source,
    attemptId: r.attemptId,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Plain text, written into the marking prompt. */
export async function engineNotesText(): Promise<string> {
  const rows = await db.select().from(engineNotes).orderBy(asc(engineNotes.createdAt)).limit(MAX_IN_PROMPT);
  if (rows.length === 0) return "";
  const byKind = new Map<string, string[]>();
  for (const r of rows) {
    const arr = byKind.get(r.kind) ?? [];
    arr.push(r.content);
    byKind.set(r.kind, arr);
  }
  const L: string[] = ["NOTES THE MARKING ENGINE HAS ACCUMULATED (from this candidate's marked papers, and from their tutor)"];
  for (const [kind, list] of byKind) {
    L.push(`${kind.toUpperCase()}:`);
    for (const c of list) L.push(`- ${c}`);
  }
  L.push("These describe this candidate and how they lose marks. Use them to sharpen the verdicts and the analysis. They do not change what any answer is worth.");
  return L.join("\n");
}

/**
 * After a paper is marked, keep what was learned. Deliberately narrow and capped: one entry for a
 * repeated loss category, and one for the weakest chapter, so the prompt grows slowly and usefully.
 */
export async function recordEngineNotes(
  attemptId: number,
  subject: string,
  report: { questions: { unit: string; awarded: number; maxMarks: number; counted: boolean }[]; lossByCategory: Record<string, number> },
): Promise<number> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(engineNotes);
  if (n >= 200) return 0; // hard ceiling

  const rows: (typeof engineNotes.$inferInsert)[] = [];

  // The two categories that cost the most marks in this paper.
  const losses = Object.entries(report.lossByCategory ?? {})
    .filter(([, m]) => (m ?? 0) >= 1)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 2);
  for (const [cat, marks] of losses) {
    const rounded = Math.round((marks ?? 0) * 10) / 10;
    if (rounded < 1) continue;
    rows.push({
      kind: "pattern",
      content: `In ${subject}, this candidate lost about ${rounded} marks to ${cat.replace(/_/g, " ")}. Watch for it and name it in the verdict when it appears again.`,
      source: "auto",
      attemptId,
    });
  }

  // The weakest chapter by marks.
  const agg = new Map<string, { awarded: number; max: number }>();
  for (const q of report.questions ?? []) {
    if (!q.counted || q.maxMarks <= 0) continue;
    const v = agg.get(q.unit) ?? { awarded: 0, max: 0 };
    v.awarded += q.awarded;
    v.max += q.maxMarks;
    agg.set(q.unit, v);
  }
  const weakest = [...agg.entries()]
    .filter(([, v]) => v.max >= 3)
    .map(([unit, v]) => ({ unit, pct: (v.awarded / v.max) * 100 }))
    .sort((a, b) => a.pct - b.pct)[0];
  if (weakest && weakest.pct < 60) {
    rows.push({
      kind: "note",
      content: `${subject}: ${weakest.unit} is a weak chapter for this candidate (${Math.round(weakest.pct)}% of the marks there). Check it closely in the next paper.`,
      source: "auto",
      attemptId,
    });
  }

  if (rows.length === 0) return 0;
  await db.insert(engineNotes).values(rows);
  return rows.length;
}

/** Adds a note the tutor or the student wrote. */
export async function addEngineNote(kind: string, content: string, source = "tutor", attemptId?: number): Promise<void> {
  if (!content.trim() || !(ENGINE_KINDS as readonly string[]).includes(kind)) return;
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(engineNotes);
  if (n >= 200) return;
  await db.insert(engineNotes).values({ kind, content: content.trim().slice(0, 500), source, attemptId: attemptId ?? null });
}

/** Removes an engine note. */
export async function deleteEngineNote(id: number): Promise<void> {
  await db.delete(engineNotes).where(eq(engineNotes.id, id));
}

/** How many papers have contributed, for the settings page. */
export async function engineNoteStats(): Promise<{ notes: number; papers: number }> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(engineNotes);
  const [{ p }] = await db
    .select({ p: sql<number>`count(distinct ${engineNotes.attemptId})::int` })
    .from(engineNotes);
  return { notes: n, papers: p };
}
