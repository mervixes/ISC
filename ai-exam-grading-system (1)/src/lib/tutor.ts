import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { attempts, engineNotes, events, insights, resources, tutorMemory, tutorNotes } from "@/db/schema";
import { daysBetween, dayKey } from "./dates";
import { fmtDuration, fmtMarks, pct } from "./format";
import { predictAll } from "./predict";
import { TYPES } from "./qtypes";
import { VAULT } from "./vault";
import { ENGINE_KINDS } from "./engine";
import { computeStudyPlan } from "./study";
import { EVENT_KINDS, INSIGHT_LABEL, type InsightType } from "./types";

import { MEMORY_KINDS, type MemoryKind, type MemoryRow } from "./tutor-meta";

export { MEMORY_KINDS, MEMORY_LABEL, type MemoryKind, type MemoryRow } from "./tutor-meta";

/**
 * The tutor asks for anything worth keeping inside a fenced block at the very end of its reply.
 * One JSON object per line, so the block can be stripped before the text is shown.
 */
export const MEMORY_FENCE = "```memory";

export function parseMemory(text: string): { kind: MemoryKind; content: string }[] {
  const start = text.indexOf(MEMORY_FENCE);
  if (start < 0) return [];
  const end = text.indexOf("```", start + MEMORY_FENCE.length);
  const body = end > start ? text.slice(start + MEMORY_FENCE.length, end) : text.slice(start + MEMORY_FENCE.length);
  const out: { kind: MemoryKind; content: string }[] = [];
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t) as { kind?: unknown; content?: unknown };
      const kind = typeof o.kind === "string" ? o.kind : "";
      const content = typeof o.content === "string" ? o.content.trim().slice(0, 400) : "";
      if (content && (MEMORY_KINDS as readonly string[]).includes(kind)) {
        out.push({ kind: kind as MemoryKind, content });
      }
    } catch {
      /* not a memory line */
    }
  }
  return out;
}

/** Removes the memory block, and anything after it, from text meant for the student. */
export function stripMemory(text: string): string {
  const start = text.indexOf(MEMORY_FENCE);
  return (start < 0 ? text : text.slice(0, start)).trimEnd();
}

/** The block the tutor uses to change the student's data. */
export const ACTIONS_FENCE = "```actions";

/** Markers that mean "the machine-readable tail is starting". Models sometimes mangle the fence
 *  itself, so the first JSON action or memory object is treated as a boundary too. */
export const TAIL_MARKERS = [MEMORY_FENCE, ACTIONS_FENCE, '{"op":', '{"kind":'];

/** Cuts the reply at the first tail marker, so only what the student should read remains. */
export function cutAtTail(text: string): string {
  let cut = text.length;
  for (const m of TAIL_MARKERS) {
    const i = text.indexOf(m);
    if (i >= 0 && i < cut) cut = i;
  }
  return text.slice(0, cut).replace(/\s*```\s*$/m, "").trimEnd();
}

export interface TutorAction {
  op: string;
  [k: string]: unknown;
}

export function parseActions(text: string): TutorAction[] {
  const start = text.indexOf(ACTIONS_FENCE);
  if (start < 0) return [];
  const end = text.indexOf("```", start + ACTIONS_FENCE.length);
  const body = end > start ? text.slice(start + ACTIONS_FENCE.length, end) : text.slice(start + ACTIONS_FENCE.length);
  const out: TutorAction[] = [];
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t) as Record<string, unknown>;
      if (typeof o.op === "string" && o.op) out.push({ ...o, op: o.op });
    } catch {
      /* not an action line */
    }
  }
  return out;
}

/** Strips both blocks, and everything from the first one onwards. */
export function stripBlocks(text: string): string {
  return cutAtTail(text);
}

export interface ActionResult {
  op: string;
  ok: boolean;
  detail: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, n = 300) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const int = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Applies the tutor's requested changes. Narrow and validated: it can only touch what is listed here. */
export async function applyActions(actions: TutorAction[]): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  for (const a of actions.slice(0, 20)) {
    try {
      switch (a.op) {
        case "memory.upsert": {
          const kind = str(a.kind, 20);
          const content = str(a.content, 400);
          if (!content || !(MEMORY_KINDS as readonly string[]).includes(kind)) {
            results.push({ op: a.op, ok: false, detail: "invalid memory" });
            break;
          }
          const id = int(a.id);
          if (id) {
            await db.update(tutorMemory).set({ kind, content }).where(eq(tutorMemory.id, id));
          } else {
            // The memory fence and the actions block can both carry the same note.
            const dup = await db.select({ id: tutorMemory.id }).from(tutorMemory).where(eq(tutorMemory.content, content)).limit(1);
            if (dup.length === 0) await db.insert(tutorMemory).values({ kind, content });
          }
          results.push({ op: a.op, ok: true, detail: content.slice(0, 70) });
          break;
        }
        case "memory.delete": {
          const id = int(a.id);
          if (!id) {
            results.push({ op: a.op, ok: false, detail: "no id" });
            break;
          }
          await db.delete(tutorMemory).where(eq(tutorMemory.id, id));
          results.push({ op: a.op, ok: true, detail: `note ${id} removed` });
          break;
        }
        case "event.create": {
          const day = str(a.day, 10);
          const title = str(a.title, 140);
          const kind = str(a.kind, 12);
          const subject = str(a.subject, 20);
          if (!DAY.test(day) || !title || !(EVENT_KINDS as readonly string[]).includes(kind)) {
            results.push({ op: a.op, ok: false, detail: "invalid event" });
            break;
          }
          const [row] = await db.insert(events).values({ day, kind, title, subject }).returning({ id: events.id });
          results.push({ op: a.op, ok: true, detail: `${title} on ${day} (#${row.id})` });
          break;
        }
        case "event.delete": {
          const id = int(a.id);
          if (!id) {
            results.push({ op: a.op, ok: false, detail: "no id" });
            break;
          }
          await db.delete(events).where(eq(events.id, id));
          results.push({ op: a.op, ok: true, detail: `calendar entry ${id} removed` });
          break;
        }
        case "note.create": {
          const title = str(a.title, 160);
          const body = str(a.body, 4000);
          if (!title) {
            results.push({ op: a.op, ok: false, detail: "no title" });
            break;
          }
          const [row] = await db
            .insert(tutorNotes)
            .values({ subject: str(a.subject, 60), title, body })
            .returning({ id: tutorNotes.id });
          results.push({ op: a.op, ok: true, detail: `${title} (#${row.id})` });
          break;
        }
        case "note.update": {
          const id = int(a.id);
          if (!id) {
            results.push({ op: a.op, ok: false, detail: "no id" });
            break;
          }
          const patch: Record<string, unknown> = { updatedAt: new Date() };
          if (typeof a.title === "string") patch.title = str(a.title, 160);
          if (typeof a.body === "string") patch.body = str(a.body, 4000);
          if (typeof a.subject === "string") patch.subject = str(a.subject, 60);
          await db.update(tutorNotes).set(patch).where(eq(tutorNotes.id, id));
          results.push({ op: a.op, ok: true, detail: `note ${id} updated` });
          break;
        }
        case "engine.note": {
          const kind = str(a.kind, 10);
          const content = str(a.content, 500);
          if (!content || !(ENGINE_KINDS as readonly string[]).includes(kind)) {
            results.push({ op: a.op, ok: false, detail: "invalid engine note" });
            break;
          }
          await db.insert(engineNotes).values({ kind, content, source: "tutor" });
          results.push({ op: a.op, ok: true, detail: content.slice(0, 70) });
          break;
        }
        case "note.delete": {
          const id = int(a.id);
          if (!id) {
            results.push({ op: a.op, ok: false, detail: "no id" });
            break;
          }
          await db.delete(tutorNotes).where(eq(tutorNotes.id, id));
          results.push({ op: a.op, ok: true, detail: `note ${id} removed` });
          break;
        }
        default:
          results.push({ op: a.op, ok: false, detail: "unknown operation" });
      }
    } catch (e) {
      results.push({ op: a.op, ok: false, detail: (e as Error)?.message?.slice(0, 80) ?? "failed" });
    }
  }
  return results;
}

export async function loadMemory(): Promise<MemoryRow[]> {
  const rows = await db.select().from(tutorMemory).orderBy(asc(tutorMemory.kind), asc(tutorMemory.id));
  return rows.map((r) => ({
    id: r.id,
    kind: (MEMORY_KINDS as readonly string[]).includes(r.kind) ? (r.kind as MemoryKind) : "fact",
    content: r.content,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Everything the app knows about this student, as plain text for the tutor prompt. */
export async function buildTutorContext(): Promise<string> {
  const L: string[] = [];

  const memory = await loadMemory();
  L.push("WHAT YOU ALREADY KNOW ABOUT THIS STUDENT (saved from earlier conversations)");
  if (memory.length === 0) L.push("- nothing recorded yet. Ask, and save what matters.");
  for (const m of memory) L.push(`- (${m.kind}) ${m.content}`);

  const papers = await db
    .select()
    .from(attempts)
    .where(isNull(attempts.deletedAt))
    .orderBy(desc(attempts.createdAt))
    .limit(40);
  const graded = papers.filter((p) => p.status === "graded" && (p.maxMarks ?? 0) > 0);
  L.push("");
  L.push("PAPERS THEY HAVE SAT");
  if (papers.length === 0) L.push("- none yet.");
  for (const p of papers.slice(0, 20)) {
    const bits = [`${p.subject}: "${p.title}"`, p.status];
    if (p.timeTakenMs != null) bits.push(`took ${fmtDuration(p.timeTakenMs)} of ${p.timeAllowedMin} min allowed`);
    if (p.status === "graded" && p.maxMarks) {
      bits.push(`${fmtMarks(p.awardedMarks ?? 0)}/${fmtMarks(p.maxMarks)} (${pct(p.awardedMarks ?? 0, p.maxMarks)}%)`);
    }
    if (p.error) bits.push(`last error: ${p.error.slice(0, 120)}`);
    L.push(`- ${bits.join(" · ")}`);
  }

  const { subjects, overall } = predictAll(
    graded.map((p) => ({
      subject: p.subject,
      percent: pct(p.awardedMarks ?? 0, p.maxMarks ?? 1),
      at: p.gradedAt ?? p.createdAt,
    })),
  );
  if (overall) {
    L.push("");
    L.push(`PROJECTED BOARD TOTAL: ${fmtMarks(overall.predicted)} of ${overall.max} (${overall.percent}%) across ${overall.subjects} subjects.`);
  }
  const withData = subjects.filter((s) => s.predicted !== null);
  if (withData.length) {
    L.push("PER-SUBJECT PROJECTION (weighted to the last six papers):");
    for (const s of withData) {
      L.push(
        `- ${s.name}: about ${fmtMarks(s.predicted ?? 0)}/${s.boardMax}, range ${fmtMarks(s.low ?? 0)} to ${fmtMarks(s.high ?? 0)}, last paper ${s.lastPercent}%, trend ${s.trend ?? "unknown"}, ${s.papers} paper(s)`,
      );
    }
  }

  const rows = await db.select().from(insights).orderBy(desc(insights.occurrences), desc(insights.lastSeenAt)).limit(120);
  L.push("");
  L.push("KNOWLEDGE PROFILE (from marked scripts)");
  if (rows.length === 0) L.push("- empty. No paper has been marked yet.");
  const byType = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byType.get(r.type) ?? [];
    arr.push(r);
    byType.set(r.type, arr);
  }
  for (const [type, list] of byType) {
    L.push(`${INSIGHT_LABEL[(type as InsightType) in INSIGHT_LABEL ? (type as InsightType) : "concept_gap"]}:`);
    for (const r of list.slice(0, 25)) {
      const qs = [...new Set((r.evidence ?? []).flatMap((e) => e.questions))].slice(0, 6);
      L.push(
        `- [${r.subject}${r.unit ? ` / ${r.unit}` : ""}] ${r.title} (seen ${r.occurrences}×, severity ${r.severity}, ${r.status}${qs.length ? `, Q ${qs.join(", ")}` : ""})`,
      );
      if (r.detail) L.push(`    why: ${r.detail.slice(0, 300)}`);
      if (r.fix && type !== "strength") L.push(`    fix: ${r.fix.slice(0, 300)}`);
      if (r.formulaWrote || r.formulaCorrect) {
        L.push(`    wrote: ${r.formulaWrote || "not recalled"} | correct: ${r.formulaCorrect || "-"}`);
      }
    }
  }

  // Loss patterns across every marked paper.
  const lossTotals = new Map<string, number>();
  for (const p of graded) {
    for (const [cat, marks] of Object.entries(p.report?.lossByCategory ?? {})) {
      lossTotals.set(cat, (lossTotals.get(cat) ?? 0) + (marks ?? 0));
    }
  }
  if (lossTotals.size) {
    const sorted = [...lossTotals.entries()].sort((a, b) => b[1] - a[1]);
    L.push("");
    L.push("WHERE MARKS GO, ACROSS EVERY MARKED PAPER: " + sorted.map(([c, m]) => `${c} −${Math.round(m * 10) / 10}`).join(", "));
  }

  // Weakest chapters from the question-level data.
  const chapterAgg = new Map<string, { awarded: number; max: number }>();
  for (const p of graded) {
    for (const q of p.report?.questions ?? []) {
      if (!q.counted || q.maxMarks <= 0) continue;
      const k = `${p.subject} / ${q.unit}`;
      const v = chapterAgg.get(k) ?? { awarded: 0, max: 0 };
      v.awarded += q.awarded;
      v.max += q.maxMarks;
      chapterAgg.set(k, v);
    }
  }
  if (chapterAgg.size) {
    const sorted = [...chapterAgg.entries()]
      .map(([k, v]) => ({ k, ...v, p: pct(v.awarded, v.max) }))
      .sort((a, b) => a.p - b.p)
      .slice(0, 15);
    L.push("");
    L.push("WEAKEST CHAPTERS BY ACTUAL MARKS: " + sorted.map((s) => `${s.k} ${fmtMarks(s.awarded)}/${fmtMarks(s.max)} (${s.p}%)`).join("; "));
  }

  const evs = await db.select().from(events).orderBy(asc(events.day));
  const today = dayKey(new Date());
  const boards = evs.filter((e) => e.kind === "board");
  const nextBoard = boards.find((b) => b.day >= today);
  L.push("");
  L.push("CALENDAR");
  if (nextBoard) L.push(`- next board paper: ${nextBoard.title} on ${nextBoard.day}, in ${daysBetween(today, nextBoard.day)} days`);
  const upcoming = evs.filter((e) => e.day >= today).slice(0, 12);
  for (const e of upcoming) L.push(`- ${e.day} (${e.kind}${e.subject ? `, ${e.subject}` : ""}): ${e.title}`);

  try {
    const plan = await computeStudyPlan();
    if (plan.picks.length) {
      L.push("");
      L.push("WHAT THE DASHBOARD IS TELLING THEM TO STUDY RIGHT NOW (\"Study this chapter right now\"):");
      plan.picks.forEach((p, i) => L.push(`${i + 1}. ${p.subject}: ${p.chapter}. ${p.headline}. ${p.why}`));
      L.push("Back these up. If they ask what to do next, start from this list unless their message gives a better reason.");
    }
    if (plan.recentDone.length) {
      L.push(
        "CHAPTERS THEY MARKED DONE RECENTLY: " +
          plan.recentDone.map((d) => `${d.subject}: ${d.chapter} (${d.at.slice(0, 10)})`).join("; "),
      );
    }
  } catch {
    /* the plan is a convenience; the rest of the context stands without it */
  }

  L.push("");
  L.push("SYLLABUS WEIGHTAGE THEY ARE WORKING TO (marks in the theory paper):");
  for (const s of TYPES) {
    L.push(`- ${s.subject}: ${s.chapters.map((c) => `${c.chapter} ${c.weightage}`).join("; ")}`);
  }

  L.push("");
  L.push("WHAT IS IN THEIR VAULT (so you can point them at it instead of repeating it):");
  for (const s of TYPES) {
    const items = VAULT.filter((v) => v.subject === s.subject || (s.subject.startsWith("English") && false));
    if (items.length === 0) continue;
    const byKind = new Map<string, string[]>();
    for (const v of items) {
      const arr = byKind.get(v.kind) ?? [];
      arr.push(v.title ?? v.quote ?? v.id);
      byKind.set(v.kind, arr);
    }
    for (const [kind, titles] of byKind) {
      L.push(`- ${s.subject} ${kind}: ${titles.filter(Boolean).join("; ")}`);
    }
  }

  const notes = await db.select().from(tutorNotes).orderBy(asc(tutorNotes.updatedAt));
  L.push("");
  L.push("NOTES YOU HAVE WRITTEN FOR THEM (id | subject | title)");
  if (notes.length === 0) L.push("- none yet. Write one when a topic deserves a permanent record.");
  for (const n of notes) L.push(`- ${n.id} | ${n.subject || "general"} | ${n.title}`);

  // The most recent marked paper, question by question, so advice can be exact.
  const [latest] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.status, "graded"), isNull(attempts.deletedAt)))
    .orderBy(desc(attempts.gradedAt))
    .limit(1);
  if (latest?.report) {
    L.push("");
    L.push(`THEIR MOST RECENTLY MARKED PAPER, QUESTION BY QUESTION: ${latest.subject} "${latest.title}"`);
    for (const q of latest.report.questions.slice(0, 40)) {
      const losses = q.lostMarks.map((l) => `${l.marks} (${l.category})`).join(", ");
      L.push(
        `- Q${q.number} [${q.unit}] ${q.awarded}/${q.maxMarks}${losses ? `; lost ${losses}` : "; full marks"}${q.attempted ? "" : "; not attempted"}`,
      );
    }
  }

  const recycled = await db
    .select({ title: attempts.title, subject: attempts.subject })
    .from(attempts)
    .where(isNotNull(attempts.deletedAt))
    .limit(20);
  if (recycled.length) {
    L.push("");
    L.push("PAPERS IN THE RECYCLE BIN (deleted but not destroyed; ask them whether to restore): " + recycled.map((r) => `${r.subject}: "${r.title}"`).join("; "));
  }

  const engine = await db.select().from(engineNotes).orderBy(asc(engineNotes.createdAt)).limit(40);
  if (engine.length) {
    L.push("");
    L.push("NOTES THE MARKING ENGINE HAS ACCUMULATED (from marked papers and from you):");
    for (const n of engine) L.push(`- (${n.kind}, ${n.source}) ${n.content}`);
  }

  // Literature quotations are not covered by the six-subject loop above.
  const litQuotes = VAULT.filter((v) => v.subject === "Literature");
  if (litQuotes.length) {
    const bySource = new Map<string, number>();
    for (const q of litQuotes) {
      const k = q.chapter.replace(" — ", ": ");
      bySource.set(k, (bySource.get(k) ?? 0) + 1);
    }
    L.push("");
    L.push("LITERATURE QUOTATIONS IN THEIR VAULT (grouped by act, scene, poem or story):");
    for (const [src, count] of bySource) L.push(`- ${src}: ${count} quotation(s)`);
    L.push("- Point them at these instead of writing quotations out in full.");
  }

  const refs = await db.select({ subject: resources.subject, kind: resources.kind, name: resources.name }).from(resources);
  if (refs.length) {
    L.push("");
    L.push("OFFICIAL MATERIAL IN THEIR LIBRARY (you cannot open these files, but you know they exist):");
    for (const r of refs) L.push(`- ${r.subject} / ${r.kind}: ${r.name}`);
  }

  return L.join("\n");
}

export const TUTOR_SYSTEM = `You are the private tutor of one ISC Class XII student, working with them between now and their board examinations. You have their complete record: every paper they have sat, every mark they lost, the reason they lost it, their formula errors, their concept gaps, their careless habits, their strengths, their projected board marks and their calendar.

HOW YOU WORK
- You know this student better than they know themselves. Use that. Refer to specific papers, questions, marks and mistakes from their record rather than giving general advice. "You lost 4 marks on Coulomb's law in the physics specimen, writing 1/r instead of 1/r²" beats "revise electrostatics".
- Be direct and specific, in the same register as their examiner reports. No praise padding, no filler, no emojis. Warmth comes from being useful, not from being nice.
- Answer the question they asked first. Then, if their record shows something relevant that they did not ask about, say it briefly.
- Teach properly. When you explain a concept, give the rule, the reason it holds, and a worked example with the answer. Use LaTeX between single dollar signs for formulae.
- When they are revising, drive it: ask them a question from a weak chapter, wait for their attempt, then mark it against the ISC scheme and tell them exactly what a full-mark answer needed.
- When they ask how to use their remaining time, work from the syllabus weightages and their weakest chapters, not from what is easiest.
- Do not invent results, papers or mistakes that are not in their record. If you do not know something, say so and tell them what would answer it.
- Never contradict their examiner's marks. If they dispute a mark, explain the rule that decided it.
- If the record is empty because nothing has been marked yet, say so plainly and tell them the first thing to do.

DRAWING GRAPHS
You can draw any graph or function plot for the student. When a curve, a graph sketch or a figure would help, emit a fenced block that starts with \`\`\`graph containing one JSON object:
\`\`\`graph
{"title":"y = sin x and y = x","xmin":-6,"xmax":6,"ymin":-7,"ymax":7,"functions":[{"f":"sin(x)","label":"sin x"},{"f":"x","label":"x"}],"points":[{"x":0,"y":0,"label":"O"}]}
\`\`\`
The expression "f" may use x, numbers, + - * / ^ ( ), and sin, cos, tan, asin, acos, atan, sqrt, abs, exp, ln, log, pi, e. Use radians. Keep "xmin" < "xmax" and give sensible "ymin" and "ymax". "points" is optional. Put the block on its own lines. Do not describe a graph in prose if a block would show it better.
If the student sends you an image, it is usually their handwritten work, a diagram or a question paper. Read it, then respond to what is actually in it.

KEEPING NOTES ABOUT THE STUDENT
When they tell you something durable about themselves that is not already in your notes, save it. Also save anything you establish about them during the conversation that will matter later: a target grade, a subject they have dropped, how much time they have each day, an exam date, a preference in how they want to be taught, or a weakness you have diagnosed from their answers.
CHANGING THE STUDENT'S DATA
You can act, not only advise. At the very end of your reply, inside a fenced block starting with \`\`\`actions, put one JSON object per line:
\`\`\`actions
{"op":"event.create","day":"2027-02-20","kind":"revision","title":"Gauss's law drill, 45 minutes","subject":"physics"}
{"op":"note.create","subject":"Physics","title":"Gauss's law: the three standard surfaces","body":"..."}
{"op":"memory.upsert","kind":"target","content":"Physics above 60/70"}
\`\`\`
Allowed operations, and nothing else:
- {"op":"event.create","day":"YYYY-MM-DD","kind":"board|mock|revision|custom","title":"...","subject":"physics|chemistry|maths|cs|english1|english2"} — put something on the calendar. Use it whenever you agree a plan: give it a date.
- {"op":"event.delete","id":<number>} — remove a calendar entry you created, using its id from the calendar list.
- {"op":"note.create","subject":"<subject or empty>","title":"...","body":"..."} — write a permanent revision note for the student to read.
- {"op":"engine.note",...} — see below. Use it when the explanation is worth keeping, not for chat.
- {"op":"note.update","id":<number>,"body":"..."} — extend or correct a note you already wrote.
- {"op":"note.delete","id":<number>} — remove a note.
- {"op":"memory.upsert","id":<optional existing id>,"kind":"fact|preference|target|observation|plan","content":"..."} — add to, or correct, what you know about them.
- {"op":"memory.delete","id":<number>} — remove something wrong you recorded.
- {"op":"engine.note","kind":"rule|pattern|note","content":"..."} — teach the marking engine something durable about this student, so every future paper is marked with it in mind. Use it when you notice a habit or a misconception the examiner should watch for.
Rules: only act when it genuinely helps; the student sees exactly what you changed; never delete an exam-board event; and say in your reply, in one line, what you changed.

KEEPING NOTES ABOUT THEM
Put durable facts about the student at the very end of your reply, inside a fenced block that starts with \`\`\`memory, as one JSON object per line:
\`\`\`memory
{"kind":"target","content":"Wants 95% aggregate; needs Physics above 60/70"}
{"kind":"preference","content":"Prefers being tested before being explained to"}
\`\`\`
"kind" must be one of: fact, preference, target, observation, plan. Keep each under 400 characters. Save only what will still matter next week, and never save anything already in your notes.
Both fences, memory and actions, go at the very end of the reply, after everything the student is meant to read.`;
