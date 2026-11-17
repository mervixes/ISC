import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { attempts, files, insights, resources } from "@/db/schema";
import { AiError, generate, isKeyFailure, isSafetyRejection, type AiPart } from "./ai";
import { detachAttemptFromInsights } from "./attempts";
import { guidelineText } from "./guidelines";
import { fmtDuration, pct } from "./format";
import { EXAMINER_DISCIPLINE, GENERAL_RUBRIC, subjectKey, TONE_RULES } from "./isc";
import { acceptsPdf, pdfPartsToText } from "./pdf";
import { gradingProgress } from "./progress";
import { engineNotesText, recordEngineNotes } from "./engine";
import { loadMemory } from "./tutor";
import { getAiConfigs, recordKeyResult, refreshModel, type AiConfig } from "./keys";
import {
  INSIGHT_TYPES,
  LOSS_CATEGORIES,
  type GradedQuestion,
  type InsightType,
  type LossCategory,
  type LostMark,
  type ProfileUpdate,
  type Report,
} from "./types";

/* ------------------------------------------------------------------ */
/* Prompt                                                              */
/* ------------------------------------------------------------------ */

function systemPrompt(subject: string): string {
  return `You are a senior CISCE examiner with twenty years of experience marking ISC (Class XII) ${subject} board scripts. You are marking one candidate's handwritten answer script against the attached question paper, exactly as scripts are marked at an ISC evaluation centre: point by point against a marking scheme, with step marking, and with no sympathy marks.

${EXAMINER_DISCIPLINE}

${GENERAL_RUBRIC}

${guidelineText(subject)}

${TONE_RULES}

OUTPUT
- Respond with one JSON object and nothing else. No markdown fences, no commentary before or after.
- Write mathematics, physical formulae and chemical equations in LaTeX between single dollar signs, e.g. $v^2 = u^2 + 2as$. Use \\mathrm{} and \\rightarrow for chemical equations; do not use \\ce.
- Because the output is JSON, every LaTeX backslash must be doubled inside strings: "$\\\\frac{1}{2}mv^2$".
- Never use the dollar sign for anything other than delimiting mathematics. Write currency as ₹ or Rs.
- You may use **bold** for the decisive word or value. No other markdown.
- Be compact. A long report is a report that gets cut off. Keep every field inside the word limits given below.`;
}

const OUTPUT_SPEC = `Return JSON in exactly this shape. Within each question, fill the fields in the order shown: decide the marking scheme, then record what is written, then reason, and only then award.

{
  "paper": {
    "title": "paper title as printed, or ''",
    "maxMarks": <maximum marks for the whole paper as printed, number>,
    "notes": "choice rules or instructions that affect marking, or ''"
  },
  "questions": [
    {
      "number": "label exactly as printed, e.g. 1(iv), 7(b)(ii)",
      "section": "A" | "B" | "C" | "D" | "",
      "unit": "syllabus unit or chapter, e.g. Electrostatics",
      "topic": "the precise concept tested, e.g. Gauss's law for an infinite line charge",
      "question": "restatement of the question in 35 words or fewer",
      "maxMarks": <number>,
      "markingScheme": "what each mark is for, e.g. 'formula ½ · substitution ½ · answer with unit 1'. 18 words or fewer",
      "attempted": <boolean>,
      "studentAnswer": "faithful account of what is written, quoting the decisive lines, values and steps. '' if not attempted",
      "verdict": "mark-by-mark reasoning: which creditable points were earned and where each lost mark went. For full marks, say why. 45 words or fewer",
      "awarded": <number, multiples of 0.5, never above maxMarks>,
      "lostMarks": [
        { "marks": <number>, "category": <one of the categories below>, "reason": "specific, citing the script" }
      ],
      "modelAnswer": "what a full-mark answer contains, compact, with working for numericals. 40 words or fewer",
      "readConfidence": "high" | "medium" | "low",
      "counted": <boolean, false only for surplus answers beyond the required number in a choice>
    }
  ],
  "summary": {
    "headline": "one blunt sentence that sums up this script",
    "examinerRemarks": "one to three sentences: what this script shows about the candidate's preparation",
    "timeAnalysis": "what the time taken says, set against the marks earned and the questions left unattempted",
    "biggestLeaks": ["the 3 to 5 biggest causes of lost marks, each with the marks it cost"],
    "nextSteps": ["3 to 6 concrete actions, most valuable first, each naming the exact topic, formula or habit"]
  },
  "insights": [  // at most 12 entries; be concise

    {
      "existingId": <id from the existing profile if this is the same underlying issue, else null>,
      "type": "concept_gap" | "formula" | "silly_mistake" | "exam_technique" | "time_management" | "strength",
      "unit": "syllabus unit or chapter",
      "title": "the specific finding in 12 words or fewer",
      "detail": "why the candidate made the mistake, with question numbers. 30 words or fewer",
      "fix": "the exact thing to do about it. 20 words or fewer",
      "severity": 1 | 2 | 3,
      "questions": ["question numbers that show it"],
      "formulaCorrect": "for type formula only: the correct formula in LaTeX, else ''",
      "formulaWrote": "for type formula only: what the candidate wrote, or 'not recalled', else ''"
    }
  ],
  "improvedIds": [<ids of existing weakness entries that this script tested and the candidate got fully right>]
}

"questions" must contain one entry for every smallest separately marked part the candidate was required to answer, including parts left blank (attempted false, awarded 0, one lostMarks entry with category "not_attempted"). For an either/or choice include the option attempted, or the first option if neither was. The maxMarks of all counted entries should add up to paper.maxMarks.

lostMarks must account for every mark not awarded: its marks must sum to maxMarks minus awarded. It is an empty array when full marks are awarded.

lostMarks categories:
- concept: did not know or understand the concept
- formula: recalled a wrong formula, equation or relation, or did not know it
- calculation: right method, arithmetic or algebra went wrong
- silly: careless slip such as a copying error, dropped sign, wrong question number, part skipped by oversight
- units: unit missing, wrong, or not converted
- presentation: steps skipped, working not shown, required format not followed, operative keywords missing
- diagram: required diagram or graph missing, wrong or unlabelled
- incomplete: answer stops short or gives fewer points than the marks need
- misread: answered something other than what was asked
- language: grammar, spelling or expression where it is assessed
- not_attempted: left blank

insights is the candidate's knowledge profile and matters as much as the marks. Be precise enough that the candidate could act on each entry tonight. For every entry, "detail" must say WHY the candidate made the mistake (the misconception, the misremembered rule, the habit, or the confusion that produced it), and "fix" must say HOW NOT to make it again (a concrete action, not "revise the chapter"). The candidate wants to understand themselves better than they understand themselves, so reason about what they were probably thinking.
- concept_gap: a concept the script proves the candidate does not understand. Name the concept, not the chapter. In "detail", name the wrong belief they were working from.
- formula: every formula, equation, law statement or standard result the candidate wrote wrongly or evidently could not recall. One entry per formula. In "detail", say what they wrote instead and what that suggests they confused it with.
- silly_mistake: knew the method and still dropped marks. Name the pattern (sign errors when transposing, copying values wrongly from the question, and so on). In "fix", give the check that would have caught it.
- exam_technique: habits that cost marks: missing units, skipped steps, unlabelled diagrams, missing keywords, ignoring the question's instructions. In "fix", give the habit to adopt.
- time_management: only if the time taken or the unattempted questions show a real problem.
- strength: only what the script proves has been mastered, with fully correct work worth 2 marks or more. Do not hand these out to be kind.
severity: 3 means it will keep costing marks in every paper until fixed, 1 means minor.`;

interface ExistingInsight {
  id: number;
  type: string;
  title: string;
  occurrences: number;
}

function contextText(
  a: typeof attempts.$inferSelect,
  existing: ExistingInsight[],
  knownUnits: string[],
  paperCount: number,
  answerCount: number,
): string {
  const lines: string[] = [];
  lines.push("CONTEXT");
  lines.push(`Subject: ISC Class XII ${a.subject}`);
  lines.push(`Paper name given by the candidate: ${a.title}`);
  lines.push(
    a.totalMarks
      ? `Maximum marks stated by the candidate: ${a.totalMarks}`
      : "Maximum marks: read it from the question paper",
  );
  lines.push(`Time allowed: ${a.timeAllowedMin} minutes`);
  if (a.timeTakenMs != null) {
    const allowed = a.timeAllowedMin * 60000;
    const diff = allowed - a.timeTakenMs;
    lines.push(
      `Time the candidate actually took: ${fmtDuration(a.timeTakenMs)} (${
        diff >= 0 ? `${fmtDuration(diff)} under` : `${fmtDuration(-diff)} over`
      } the limit)`,
    );
  }
  lines.push(
    `Files above: ${paperCount} question paper file(s), any official reference material, then ${answerCount} answer page(s) in the order uploaded.`,
  );
  if (knownUnits.length) {
    lines.push("");
    lines.push(
      `Unit names already used in this candidate's records (reuse the same spelling where the unit is the same): ${knownUnits.join("; ")}`,
    );
  }
  lines.push("");
  if (existing.length) {
    lines.push(
      "EXISTING KNOWLEDGE PROFILE for this subject, from earlier papers. Use existingId to link a finding that is the same underlying issue instead of creating a duplicate:",
    );
    for (const e of existing) lines.push(`[${e.id}] (${e.type}) ${e.title}: seen ${e.occurrences}×`);
  } else {
    lines.push(
      "EXISTING KNOWLEDGE PROFILE: none yet. This is the first paper in this subject. Set existingId to null and improvedIds to [].",
    );
  }
  lines.push("");
  lines.push(OUTPUT_SPEC);
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Official reference material                                         */
/* ------------------------------------------------------------------ */

const REF_ORDER = ["marking_scheme", "specimen_paper", "syllabus", "notes"];
const REF_LABEL: Record<string, string> = {
  marking_scheme: "Marking scheme and acceptable answers",
  specimen_paper: "Specimen question paper",
  syllabus: "Syllabus",
  notes: "Notes",
};
/** Keeps the request under the providers' size limits. */
const REF_BUDGET = 14 * 1024 * 1024;

async function loadReferences(subjectName: string) {
  const key = subjectKey(subjectName);
  if (!key) return [];
  const rows = await db
    .select()
    .from(resources)
    .where(eq(resources.subject, key))
    .orderBy(asc(resources.createdAt));
  rows.sort((x, y) => REF_ORDER.indexOf(x.kind) - REF_ORDER.indexOf(y.kind));
  const picked: typeof rows = [];
  let used = 0;
  for (const r of rows) {
    if (used + r.size > REF_BUDGET) continue;
    used += r.size;
    picked.push(r);
  }
  return picked;
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

/**
 * Models sometimes under-escape LaTeX inside JSON ("\frac" is a form feed, "\sqrt" is invalid).
 * Walk the text and repair escapes inside strings before parsing.
 */
export function fixEscapes(src: string): string {
  let out = "";
  let inStr = false;
  let math = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"') {
      inStr = !inStr;
      math = false;
      out += c;
      continue;
    }
    if (!inStr) {
      out += c;
      continue;
    }
    if (c === "\n") {
      out += "\\n";
      continue;
    }
    if (c === "\r") continue;
    if (c === "\t") {
      out += "\\t";
      continue;
    }
    if (c === "$") {
      math = !math;
      out += c;
      continue;
    }
    if (c !== "\\") {
      out += c;
      continue;
    }
    const n = src[i + 1] ?? "";
    const letterAfter = /[A-Za-z]/.test(src[i + 2] ?? "");
    if (n === "\\" || n === '"' || n === "/") {
      out += c + n;
      i++;
      continue;
    }
    if (n === "u" && /^[0-9a-fA-F]{4}$/.test(src.slice(i + 2, i + 6))) {
      out += src.slice(i, i + 6);
      i += 5;
      continue;
    }
    let keep = false;
    if (n === "b" || n === "f" || n === "r") keep = !letterAfter; // \beta, \frac, \rho are LaTeX
    else if (n === "n" || n === "t") keep = !(math && letterAfter); // \nu, \theta inside $...$
    if (keep) {
      out += c + n;
      i++;
    } else {
      out += "\\\\";
    }
  }
  return out;
}

export function parseJson(raw: string): unknown {
  let t = raw.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) throw new AiError("The model did not return a report. Run the marking again.");
  t = t.slice(start, end + 1);
  try {
    return JSON.parse(fixEscapes(t));
  } catch {
    try {
      return JSON.parse(t);
    } catch {
      throw new AiError("The model returned a malformed report. Run the marking again.");
    }
  }
}

const num = (v: unknown, d = 0): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : d;
};
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const half = (n: number) => Math.round(n * 2) / 2;
const strList = (v: unknown, max: number) =>
  arr(v)
    .map(str)
    .filter(Boolean)
    .slice(0, max);

interface RawInsight {
  existingId: number | null;
  type: InsightType;
  unit: string;
  title: string;
  detail: string;
  fix: string;
  severity: number;
  questions: string[];
  formulaCorrect: string;
  formulaWrote: string;
}

export interface Parsed {
  report: Report;
  insights: RawInsight[];
  improvedIds: number[];
}

export function normalise(data: unknown, userMax: number | null): Parsed {
  const root = obj(data);
  const paper = obj(root.paper);

  const questions: GradedQuestion[] = arr(root.questions)
    .map((q): GradedQuestion | null => {
      const o = obj(q);
      const number = str(o.number);
      const maxMarks = Math.max(0, half(num(o.maxMarks)));
      if (!number && maxMarks === 0) return null;
      const attempted = o.attempted !== false && str(o.attempted) !== "false";
      const awarded = attempted ? Math.min(maxMarks, Math.max(0, half(num(o.awarded)))) : 0;
      const gap = maxMarks - awarded;
      let lostMarks: LostMark[] = arr(o.lostMarks)
        .map((l): LostMark | null => {
          const lo = obj(l);
          const cat = str(lo.category).toLowerCase().replace(/[\s-]+/g, "_");
          const marks = Math.max(0, num(lo.marks));
          const reason = str(lo.reason);
          if (!reason && marks === 0) return null;
          return {
            marks,
            reason,
            category: (LOSS_CATEGORIES as readonly string[]).includes(cat)
              ? (cat as LossCategory)
              : attempted
                ? "incomplete"
                : "not_attempted",
          };
        })
        .filter((l): l is LostMark => l !== null);
      if (gap <= 0) lostMarks = [];
      else if (lostMarks.length === 0) {
        lostMarks = [
          {
            marks: gap,
            category: attempted ? "incomplete" : "not_attempted",
            reason: attempted ? "See the verdict above." : "Left blank.",
          },
        ];
      }
      const conf = str(o.readConfidence).toLowerCase();
      return {
        number: number || "?",
        section: str(o.section),
        unit: str(o.unit) || "Unclassified",
        topic: str(o.topic),
        question: str(o.question),
        maxMarks,
        markingScheme: str(o.markingScheme),
        attempted,
        studentAnswer: str(o.studentAnswer),
        verdict: str(o.verdict),
        awarded,
        lostMarks,
        modelAnswer: str(o.modelAnswer),
        readConfidence: conf === "low" || conf === "medium" ? conf : "high",
        counted: o.counted !== false && str(o.counted) !== "false",
      };
    })
    .filter((q): q is GradedQuestion => q !== null);

  if (questions.length === 0) {
    throw new AiError("The model returned a report with no questions in it. Run the marking again.");
  }

  const counted = questions.filter((q) => q.counted);
  const sumMax = counted.reduce((s, q) => s + q.maxMarks, 0);
  const sumAwarded = counted.reduce((s, q) => s + q.awarded, 0);
  const paperMax = num(paper.maxMarks);

  let max = sumMax;
  let maxSource: Report["totals"]["maxSource"] = "questions";
  if (userMax && userMax > 0) {
    max = userMax;
    maxSource = "you";
  } else if (paperMax > 0) {
    max = paperMax;
    maxSource = "paper";
  }
  const awarded = Math.min(sumAwarded, max);

  // Marks lost per category, scaled so each question's entries account for its exact gap.
  const lossByCategory: Partial<Record<LossCategory, number>> = {};
  for (const q of counted) {
    const gap = q.maxMarks - q.awarded;
    const listed = q.lostMarks.reduce((s, l) => s + l.marks, 0);
    for (const l of q.lostMarks) {
      const share = listed > 0 ? (l.marks / listed) * gap : gap / q.lostMarks.length;
      lossByCategory[l.category] = (lossByCategory[l.category] ?? 0) + share;
    }
  }

  const summary = obj(root.summary);
  const report: Report = {
    paper: { title: str(paper.title), notes: str(paper.notes) },
    questions,
    summary: {
      headline: str(summary.headline),
      examinerRemarks: str(summary.examinerRemarks),
      timeAnalysis: str(summary.timeAnalysis),
      biggestLeaks: strList(summary.biggestLeaks, 8),
      nextSteps: strList(summary.nextSteps, 8),
    },
    totals: { awarded, max, percent: pct(awarded, max), sumMax, maxSource },
    lossByCategory,
    profileUpdates: [],
    improvedCount: 0,
  };

  const rawInsights: RawInsight[] = arr(root.insights)
    .map((x): RawInsight | null => {
      const o = obj(x);
      const type = str(o.type).toLowerCase().replace(/[\s-]+/g, "_");
      const title = str(o.title);
      if (!title || !(INSIGHT_TYPES as readonly string[]).includes(type)) return null;
      const existingId = num(o.existingId, NaN);
      return {
        existingId: Number.isInteger(existingId) && existingId > 0 ? existingId : null,
        type: type as InsightType,
        unit: str(o.unit),
        title,
        detail: str(o.detail),
        fix: str(o.fix),
        severity: Math.min(3, Math.max(1, Math.round(num(o.severity, 2)))),
        questions: strList(o.questions, 20),
        formulaCorrect: str(o.formulaCorrect),
        formulaWrote: str(o.formulaWrote),
      };
    })
    .filter((x): x is RawInsight => x !== null)
    .slice(0, 40);

  const improvedIds = arr(root.improvedIds)
    .map((v) => num(v, NaN))
    .filter((n) => Number.isInteger(n) && n > 0);

  return { report, insights: rawInsights, improvedIds };
}

/* ------------------------------------------------------------------ */
/* Job                                                                 */
/* ------------------------------------------------------------------ */

/** On success, `task` is the marking job. The route must pass it to after() so serverless
 *  platforms (Vercel among them) do not freeze the function the moment the response is sent. */
export type StartResult =
  | { ok: true; task: Promise<void> }
  | { ok: false; code: string; error: string };

export async function startGrading(id: number): Promise<StartResult> {
  const cfgs = await getAiConfigs();
  if (cfgs.length === 0) {
    return { ok: false, code: "no_key", error: "Add an AI API key on the API keys page before marking." };
  }
  const meta = await db.select({ kind: files.kind }).from(files).where(eq(files.attemptId, id));
  if (!meta.some((f) => f.kind === "paper")) {
    return { ok: false, code: "no_paper", error: "This attempt has no question paper attached." };
  }
  if (!meta.some((f) => f.kind === "answer")) {
    return { ok: false, code: "no_answers", error: "Upload at least one photo of your answers first." };
  }

  gradingProgress.set(id, { stage: "reading", chars: 0 });
  const claimed = await db
    .update(attempts)
    .set({ status: "grading", gradingStartedAt: new Date(), error: null })
    .where(and(eq(attempts.id, id), inArray(attempts.status, ["finished", "graded"])))
    .returning({ id: attempts.id });
  if (claimed.length === 0) {
    gradingProgress.delete(id);
    return { ok: false, code: "bad_state", error: "This paper cannot be marked right now." };
  }

  const task = run(id, cfgs).catch(async (e: unknown) => {
      const message =
        e instanceof AiError ? e.message : `Marking failed: ${(e as Error)?.message ?? "unknown error"}`;
      console.error(`[grader] attempt ${id} failed:`, e);
      try {
        const [row] = await db.select({ report: attempts.report }).from(attempts).where(eq(attempts.id, id));
        await db
          .update(attempts)
          .set({ status: row?.report ? "graded" : "finished", error: message.slice(0, 600) })
          .where(eq(attempts.id, id));
      } catch (inner) {
        console.error("[grader] could not record failure:", inner);
      }
    })
    .finally(() => gradingProgress.delete(id));

  return { ok: true, task };
}

/**
 * One call with one key. If the saved model has been retired (404), look up the current model,
 * store it on the key, and retry once with it.
 */
async function generateWithKey(
  cfg: AiConfig,
  system: string,
  parts: AiPart[],
  id: number,
): Promise<{ raw: string; model: string }> {
  const call = (model: string) =>
    generate({
      provider: cfg.provider,
      apiKey: cfg.apiKey,
      model,
      system,
      parts,
      json: true,
      signal: AbortSignal.timeout(14 * 60 * 1000),
      onDelta: (chars) => gradingProgress.set(id, { stage: "writing", chars }),
    });
  try {
    return { raw: await call(cfg.model), model: cfg.model };
  } catch (e) {
    if (cfg.id !== null && e instanceof AiError && e.status === 404) {
      const fresh = await refreshModel(cfg.id, cfg.provider, cfg.apiKey);
      if (fresh && fresh !== cfg.model) return { raw: await call(fresh), model: fresh };
    }
    throw e;
  }
}

async function run(id: number, cfgs: AiConfig[]): Promise<void> {
  const [a] = await db.select().from(attempts).where(eq(attempts.id, id));
  if (!a) throw new AiError("Attempt not found.");

  const fs = await db
    .select()
    .from(files)
    .where(eq(files.attemptId, id))
    .orderBy(asc(files.position), asc(files.id));
  const paper = fs.filter((f) => f.kind === "paper");
  const answers = fs.filter((f) => f.kind === "answer");

  // Existing profile for this subject, ignoring entries that only exist because of this same attempt.
  const profileRows = await db
    .select()
    .from(insights)
    .where(eq(insights.subject, a.subject))
    .orderBy(desc(insights.occurrences), desc(insights.lastSeenAt))
    .limit(120);
  const existing = profileRows
    .filter((r) => (r.evidence ?? []).some((e) => e.attemptId !== id))
    .slice(0, 80)
    .map((r) => ({ id: r.id, type: r.type, title: r.title, occurrences: r.occurrences }));

  const prior = await db
    .select({ report: attempts.report })
    .from(attempts)
    .where(and(eq(attempts.subject, a.subject), eq(attempts.status, "graded"), ne(attempts.id, id)));
  const knownUnits = [
    ...new Set(prior.flatMap((p) => (p.report?.questions ?? []).map((q) => q.unit)).filter(Boolean)),
  ].slice(0, 40);

  const parts: AiPart[] = [];
  parts.push({ type: "text", text: `QUESTION PAPER (${paper.length} file${paper.length === 1 ? "" : "s"}):` });
  for (const f of paper) parts.push({ type: "file", mime: f.mime, base64: f.data, name: f.name });

  const refs = await loadReferences(a.subject);
  if (refs.length > 0) {
    parts.push({
      type: "text",
      text: `OFFICIAL REFERENCE MATERIAL uploaded by the candidate for ${a.subject} (${refs.length} file${refs.length === 1 ? "" : "s"}). If a marking scheme or acceptable answers is attached, it is the authoritative answer key: award marks exactly as it allows, cite it in the verdict (for example "per the specimen scheme"), and use your own knowledge only where it is silent. Use the specimen paper to calibrate depth and the syllabus to judge scope.`,
    });
    for (const r of refs) {
      parts.push({ type: "text", text: `Reference: ${REF_LABEL[r.kind] ?? r.kind} · ${r.name}` });
      parts.push({ type: "file", mime: r.mime, base64: r.data, name: r.name });
    }
  }

  parts.push({
    type: "text",
    text: `CANDIDATE'S HANDWRITTEN ANSWER SCRIPT (${answers.length} page${answers.length === 1 ? "" : "s"}, in order):`,
  });
  answers.forEach((f, idx) => {
    parts.push({ type: "text", text: `Answer page ${idx + 1}` });
    parts.push({ type: "file", mime: f.mime, base64: f.data, name: f.name });
  });
  // Notes the marking engine has accumulated across this candidate's papers.
  const engine = await engineNotesText();
  if (engine) parts.push({ type: "text", text: engine });

  // Anything the tutor has learned about this candidate belongs in front of the examiner too.
  const notes = await loadMemory();
  if (notes.length > 0) {
    parts.push({
      type: "text",
      text:
        "NOTES THE STUDENT'S TUTOR HAS RECORDED ABOUT THEM. Use them to judge the script against what this candidate was working on, and to make the analysis specific to them. They are not an excuse: they do not change what any answer is worth.\n" +
        notes.map((n) => `- (${n.kind}) ${n.content}`).join("\n"),
    });
  }
  parts.push({ type: "text", text: contextText(a, existing, knownUnits, paper.length, answers.length) });

  // Try each key in order. A key that is rejected, out of quota or down hands over to the next.
  const system = systemPrompt(a.subject);
  let raw = "";
  let used: AiConfig | null = null;
  let lastErr: unknown = null;
  // Providers that cannot read PDF documents get the extracted text instead. Sending a 19-page
  // paper as images is large and can be rejected by a provider's image safety screening.
  let textParts: AiPart[] | null = null;
  let liteParts: AiPart[] | null = null;
  for (const cfg of cfgs) {
    try {
      let send = parts;
      if (!acceptsPdf(cfg.provider)) {
        gradingProgress.set(id, { stage: "reading", chars: 0 });
        textParts ??= await pdfPartsToText(parts, { maxCharsPerFile: 45_000 });
        send = textParts;
      }
      const got = await generateWithKey(cfg, system, send, id);
      raw = got.raw;
      used = { ...cfg, model: got.model };
      if (cfg.id !== null) await recordKeyResult(cfg.id, true, null);
      break;
    } catch (e) {
      lastErr = e;
      // A content-safety rejection is about the input, not the key. Retry once with a leaner
      // request (paper text and answers only, no reference material or notes).
      if (isSafetyRejection(e)) {
        try {
          const lean = parts.filter((p) => p.type === "file" || p.type === "text");
          const base = acceptsPdf(cfg.provider) ? lean : (liteParts ??= await pdfPartsToText(lean, { maxCharsPerFile: 30_000 }));
          const got = await generateWithKey(cfg, system, base, id);
          raw = got.raw;
          used = { ...cfg, model: got.model };
          if (cfg.id !== null) await recordKeyResult(cfg.id, true, null);
          break;
        } catch (inner) {
          lastErr = inner;
        }
      }
      if (cfg.id !== null && isKeyFailure(e)) {
        await recordKeyResult(cfg.id, false, e instanceof Error ? e.message : null);
      }
      if (!isKeyFailure(e) && !isSafetyRejection(e)) throw e;
    }
  }
  if (!used) {
    if (isSafetyRejection(lastErr)) {
      throw new AiError(
        "Every key rejected the input on content-safety grounds. This is a provider filter on the request, not the key. Try again: marking is retried with the paper's extracted text. If it keeps happening, use a key from another provider for this paper.",
        (lastErr as AiError).status,
      );
    }
    if (lastErr instanceof AiError) throw lastErr;
    throw new AiError(
      `Marking failed on every saved key. ${lastErr instanceof Error ? lastErr.message : ""}`.trim(),
    );
  }
  const chosen: AiConfig = used;

  gradingProgress.set(id, { stage: "saving", chars: raw.length });
  let parsed;
  try {
    parsed = normalise(parseJson(raw), a.totalMarks);
  } catch (e) {
    // Keep the tail of a bad response so a failure can be diagnosed without re-running.
    try {
      const fs = await import("node:fs/promises");
      await fs.writeFile(`/tmp/grader-raw-${id}.txt`, raw.slice(-4000));
    } catch {
      /* diagnostics only */
    }
    throw e;
  }
  const { report } = parsed;

  // Re-marking: drop what the previous marking of this attempt contributed.
  await detachAttemptFromInsights(id);

  const now = new Date();
  const evidence = (questions: string[]) => ({ attemptId: id, questions, at: now.toISOString() });
  const current = await db.select().from(insights).where(eq(insights.subject, a.subject));
  const byId = new Map(current.map((r) => [r.id, r]));
  // Fallback for when the model repeats a finding without linking it by id.
  const titleKey = (type: string, title: string) => `${type}::${title.toLowerCase().replace(/\s+/g, " ").trim()}`;
  const byTitle = new Map(current.map((r) => [titleKey(r.type, r.title), r]));
  const touched = new Set<number>();
  const updates: ProfileUpdate[] = [];

  for (const ins of parsed.insights) {
    const hit =
      (ins.existingId ? byId.get(ins.existingId) : undefined) ?? byTitle.get(titleKey(ins.type, ins.title));
    if (hit && touched.has(hit.id)) continue; // two findings mapped to one entry: count it once
    if (hit) {
      touched.add(hit.id);
      const occurrences = hit.occurrences + 1;
      await db
        .update(insights)
        .set({
          occurrences,
          status: "active",
          lastSeenAt: now,
          severity: Math.max(hit.severity, ins.severity),
          detail: ins.detail || hit.detail,
          fix: ins.fix || hit.fix,
          formulaCorrect: ins.formulaCorrect || hit.formulaCorrect,
          formulaWrote: ins.formulaWrote || hit.formulaWrote,
          evidence: [...(hit.evidence ?? []), evidence(ins.questions)],
        })
        .where(eq(insights.id, hit.id));
      updates.push({
        id: hit.id,
        type: hit.type as InsightType,
        title: hit.title,
        recurring: true,
        occurrences,
        unit: ins.unit || hit.unit,
        detail: ins.detail || hit.detail,
        fix: ins.fix || hit.fix,
        questions: ins.questions,
      });
    } else {
      const [row] = await db
        .insert(insights)
        .values({
          subject: a.subject,
          type: ins.type,
          unit: ins.unit,
          title: ins.title,
          detail: ins.detail,
          fix: ins.fix,
          severity: ins.severity,
          formulaCorrect: ins.formulaCorrect,
          formulaWrote: ins.formulaWrote,
          evidence: [evidence(ins.questions)],
          firstSeenAt: now,
          lastSeenAt: now,
        })
        .returning({ id: insights.id });
      updates.push({
        id: row.id,
        type: ins.type,
        title: ins.title,
        recurring: false,
        occurrences: 1,
        unit: ins.unit,
        detail: ins.detail,
        fix: ins.fix,
        questions: ins.questions,
      });
    }
  }

  let improvedCount = 0;
  for (const impId of parsed.improvedIds) {
    const hit = byId.get(impId);
    if (!hit || touched.has(impId) || hit.type === "strength") continue;
    touched.add(impId);
    await db.update(insights).set({ status: "improving" }).where(eq(insights.id, impId));
    improvedCount++;
  }

  report.profileUpdates = updates;
  report.improvedCount = improvedCount;

  await db
    .update(attempts)
    .set({
      status: "graded",
      gradedAt: now,
      error: null,
      report,
      awardedMarks: report.totals.awarded,
      maxMarks: report.totals.max,
      model: chosen.model,
    })
    .where(eq(attempts.id, id));

  // Keep what this paper taught the engine, so the next run is sharper.
  try {
    await recordEngineNotes(id, a.subject, {
      questions: report.questions.map((q) => ({ unit: q.unit, awarded: q.awarded, maxMarks: q.maxMarks, counted: q.counted })),
      lossByCategory: report.lossByCategory as unknown as Record<string, number>,
    });
  } catch (e) {
    console.error(`[engine] could not record notes for attempt ${id}:`, e);
  }
}
