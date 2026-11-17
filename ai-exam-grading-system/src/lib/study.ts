import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { attempts, events, insights, questionBank, studyLog } from "@/db/schema";
import { dayKey, daysBetween } from "./dates";
import { fmtMarks } from "./format";
import { SUBJECTS } from "./isc";
import { PRACTICE } from "./practice-data";
import { canonicalChapter, TYPES, type ChapterTypes } from "./qtypes";
import type { StudyPick, StudyPlan } from "./study-types";

export type { StudyPick, StudyPlan } from "./study-types";

/* ------------------------------------------------------------------ */
/* Matching free-text units (from reports and insights) to chapters    */
/* ------------------------------------------------------------------ */

const STOP = new Set([
  "and", "the", "of", "for", "with", "from", "into", "its", "their", "in", "on", "to", "by", "as", "at",
  "or", "is", "are", "be", "use", "used", "using", "given", "find", "type", "types", "question",
  "questions", "chapter", "unit", "paper", "section", "marks", "mark", "one", "two", "its",
]);

/** Abbreviations the examiner model tends to use for units. */
const ALIASES: [RegExp, string][] = [
  [/\bemi\b/g, " electromagnetic induction "],
  [/\ba\.?c\.?\b/g, " alternating current "],
  [/\bem waves?\b/g, " electromagnetic waves "],
  [/\bydse\b/g, " young double slit "],
  [/\blpp\b/g, " linear programming "],
  [/\b3-?d\b/g, " three dimensional "],
  [/\bk-?maps?\b/g, " karnaugh map "],
  [/\boops?\b/g, " inheritance polymorphism "],
  [/\bsn[12]\b/g, " nucleophilic substitution "],
];

const norm = (s: string) =>
  ALIASES.reduce((acc, [re, to]) => acc.replace(re, to), s.toLowerCase())
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const stem = (t: string) => (t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t);

function tokens(s: string): string[] {
  return norm(s)
    .split(" ")
    .filter((t) => t.length > 2 && !STOP.has(t))
    .map(stem);
}

interface Profile {
  subject: string;
  chapter: ChapterTypes;
  weights: Map<string, number>;
}

let PROFILES: Profile[] | null = null;
let IDF = new Map<string, number>();

/** Each chapter's vocabulary: its name (weighted 3) plus every question type written for it. */
function profiles(): Profile[] {
  if (PROFILES) return PROFILES;
  const list: Profile[] = [];
  for (const s of TYPES) {
    for (const c of s.chapters) {
      const w = new Map<string, number>();
      for (const t of tokens(c.chapter)) w.set(t, (w.get(t) ?? 0) + 3);
      for (const ty of c.types) for (const t of new Set(tokens(ty.type))) w.set(t, (w.get(t) ?? 0) + 1);
      list.push({ subject: s.subject, chapter: c, weights: w });
    }
  }
  const df = new Map<string, number>();
  for (const p of list) for (const t of p.weights.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  IDF = new Map([...df].map(([t, n]) => [t, Math.log(1 + list.length / n)]));
  PROFILES = list;
  return list;
}

/** Best syllabus chapter for a unit name such as "Optics" or "Coulomb's law", or null if unclear. */
export function matchChapter(
  subject: string,
  text: string | null | undefined,
  opts: { minScore?: number } = {},
): ChapterTypes | null {
  if (!text) return null;
  const candidates = profiles().filter((p) => p.subject === subject);
  const wanted = norm(text);
  const exact = candidates.find((p) => norm(p.chapter.chapter) === wanted);
  if (exact) return exact.chapter;
  const toks = [...new Set(tokens(text))];
  if (toks.length === 0) return null;
  let best: Profile | null = null;
  let bestScore = 0;
  for (const p of candidates) {
    let sc = 0;
    for (const t of toks) {
      const w = p.weights.get(t);
      if (w) sc += Math.min(w, 4) * (IDF.get(t) ?? 1);
    }
    // On a tie, the heavier chapter wins: "Optics" means ray optics more often than wave optics.
    sc += p.chapter.weightage * 0.001;
    if (sc > bestScore) {
      bestScore = sc;
      best = p;
    }
  }
  return best && bestScore >= (opts.minScore ?? 1) ? best.chapter : null;
}

/** Units the examiner uses when a finding belongs to no particular chapter. */
const GENERIC_UNIT = /^(general|overall|unclassified|whole paper|paper|all|mixed|various|exam technique|time management|presentation|n\/?a|none|-)?$/i;

/**
 * Chapter for an insight. Habits (exam technique, time management) only count against a chapter
 * when the examiner named one; their titles are never guessed at, because "not attempted within
 * time" is about the clock, not about any topic that happens to mention time.
 */
export function chapterForInsight(subject: string, type: string, unit: string, title: string): ChapterTypes | null {
  const named = GENERIC_UNIT.test(unit.trim()) ? null : matchChapter(subject, unit);
  if (named) return named;
  if (type === "exam_technique" || type === "time_management") return null;
  return matchChapter(subject, title, { minScore: 2.5 });
}

export function isKnownChapter(subject: string, chapter: string): boolean {
  return TYPES.some((s) => s.subject === subject && s.chapters.some((c) => c.chapter === chapter));
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/** Need assumed for a chapter that has never been tested: a typical student holds about 65% of it. */
const NEED_UNTESTED = 0.35;
/** A finished chapter rests for this many days per time it has been finished, up to four times. */
const REST_DAYS = 7;
const SKIP_DAYS = 2;

const DAY_MS = 86_400_000;
const ageDays = (ms: number) => (Date.now() - ms) / DAY_MS;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const shortDate = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
/** English Language and Literature are separate papers but compete for the same kind of study time. */
const family = (key: string) => (key.startsWith("english") ? "english" : key);

function urgency(days: number | null): number {
  if (days === null) return 1;
  if (days <= 7) return 2;
  if (days <= 21) return 1.6;
  if (days <= 45) return 1.3;
  return 1;
}

interface Evidence {
  aw: number;
  mx: number;
  rawAw: number;
  rawMx: number;
  questions: number;
  papers: Set<number>;
  weakAt: number;
}

interface InsightLoad {
  load: number;
  open: { title: string; occurrences: number; severity: number }[];
  strength: number;
  lastSeen: number;
}

interface Candidate {
  pick: StudyPick;
  family: string;
}

export interface StudyDebug {
  all: { subject: string; chapter: string; score: number; mastery: number | null; status: string }[];
  units: { subject: string; unit: string; chapter: string | null }[];
}

/** Ranks every chapter and returns the three worth studying right now. */
export async function computeStudyPlan(opts: { debug?: boolean } = {}): Promise<StudyPlan & { debug?: StudyDebug }> {
  const now = Date.now();
  const today = dayKey(new Date());
  const debugUnits: StudyDebug["units"] = [];
  const debugAll: StudyDebug["all"] = [];

  // --- Evidence from marked papers, newest weighted most ---
  const graded = await db
    .select({ id: attempts.id, subject: attempts.subject, report: attempts.report, gradedAt: attempts.gradedAt, createdAt: attempts.createdAt })
    .from(attempts)
    .where(and(eq(attempts.status, "graded"), isNull(attempts.deletedAt), isNotNull(attempts.report)))
    .orderBy(desc(attempts.gradedAt));

  const evidence = new Map<string, Evidence>();
  const paperIndex = new Map<string, number>();
  for (const p of graded) {
    const qs = p.report?.questions ?? [];
    // A paper with nothing attempted says nothing about what the student knows: it is a time or
    // upload problem, and it must not paint every chapter as unknown.
    if (!qs.some((q) => q.attempted)) continue;
    const k = paperIndex.get(p.subject) ?? 0;
    paperIndex.set(p.subject, k + 1);
    const decay = Math.pow(0.75, k);
    const at = (p.gradedAt ?? p.createdAt).getTime();
    for (const q of qs) {
      if (!q.counted || q.maxMarks <= 0) continue;
      const ch =
        (GENERIC_UNIT.test((q.unit ?? "").trim()) ? null : matchChapter(p.subject, q.unit)) ??
        matchChapter(p.subject, q.topic, { minScore: 2.5 });
      if (opts.debug) debugUnits.push({ subject: p.subject, unit: q.unit, chapter: ch?.chapter ?? null });
      if (!ch) continue;
      const key = `${p.subject}::${ch.chapter}`;
      // An unattempted part is weaker evidence of not knowing than a wrong answer.
      const w = decay * (q.attempted ? 1 : 0.5);
      const e = evidence.get(key) ?? { aw: 0, mx: 0, rawAw: 0, rawMx: 0, questions: 0, papers: new Set<number>(), weakAt: 0 };
      e.aw += q.awarded * w;
      e.mx += q.maxMarks * w;
      e.rawAw += q.awarded;
      e.rawMx += q.maxMarks;
      e.questions += 1;
      e.papers.add(p.id);
      if (q.awarded < q.maxMarks * 0.7) e.weakAt = Math.max(e.weakAt, at);
      evidence.set(key, e);
    }
  }

  // --- Open mistakes and proven strengths ---
  const insightRows = await db.select().from(insights);
  const loads = new Map<string, InsightLoad>();
  for (const r of insightRows) {
    const ch = chapterForInsight(r.subject, r.type, r.unit, r.title);
    if (!ch) continue;
    const key = `${r.subject}::${ch.chapter}`;
    const l = loads.get(key) ?? { load: 0, open: [], strength: 0, lastSeen: 0 };
    if (r.type === "strength") l.strength += 1;
    else if (r.status === "active") {
      l.load += r.severity * r.occurrences;
      l.open.push({ title: r.title, occurrences: r.occurrences, severity: r.severity });
      l.lastSeen = Math.max(l.lastSeen, r.lastSeenAt.getTime());
    }
    loads.set(key, l);
  }

  // --- What the student has already finished or skipped ---
  const logs = await db.select().from(studyLog).where(isNull(studyLog.revokedAt)).orderBy(desc(studyLog.createdAt));
  const doneAgg = new Map<string, { last: number; count: number }>();
  const skipAt = new Map<string, number>();
  for (const l of logs) {
    const key = `${l.subject}::${l.chapter}`;
    if (l.action === "done") {
      const d = doneAgg.get(key);
      if (d) d.count += 1;
      else doneAgg.set(key, { last: l.createdAt.getTime(), count: 1 });
    } else if (l.action === "skip" && !skipAt.has(key)) {
      skipAt.set(key, l.createdAt.getTime());
    }
  }

  // --- Days to each subject's board paper ---
  const boardRows = await db.select({ day: events.day, subject: events.subject }).from(events).where(eq(events.kind, "board"));
  const board = new Map<string, { next: number | null; over: boolean }>();
  for (const s of SUBJECTS) {
    const days = boardRows.filter((e) => e.subject === s.key).map((e) => daysBetween(today, e.day));
    if (days.length === 0) board.set(s.key, { next: null, over: false });
    else {
      const future = days.filter((d) => d >= 0);
      board.set(s.key, future.length ? { next: Math.min(...future), over: false } : { next: null, over: true });
    }
  }

  // --- Practice questions available per chapter (same mapping the Practice page uses) ---
  const practiceCount = new Map<string, number>();
  const addPractice = (subject: string, chapter: string) => {
    const key = `${subject}::${canonicalChapter(subject, chapter)}`;
    practiceCount.set(key, (practiceCount.get(key) ?? 0) + 1);
  };
  for (const q of PRACTICE) addPractice(q.subject, q.chapter);
  for (const q of await db.select({ subject: questionBank.subject, chapter: questionBank.chapter }).from(questionBank)) {
    addPractice(q.subject, q.chapter);
  }

  // --- Score every chapter ---
  const candidates: Candidate[] = [];
  for (const s of TYPES) {
    const meta = SUBJECTS.find((x) => x.name === s.subject);
    if (!meta) continue;
    const b = board.get(meta.key) ?? { next: null, over: false };
    if (b.over) continue; // that board paper is behind them
    const urg = urgency(b.next);

    for (const c of s.chapters) {
      const key = `${s.subject}::${c.chapter}`;
      const ev = evidence.get(key);
      const ld = loads.get(key);
      const mastery = ev && ev.mx > 0 ? ev.aw / ev.mx : null;

      let need = mastery === null ? NEED_UNTESTED : 1 - mastery;
      if (ld) need += Math.min(0.5, ld.load * 0.06) - (ld.strength > 0 ? 0.15 : 0);
      need = Math.max(0.05, Math.min(1.5, need));

      let doneFactor = 1;
      let returning = false;
      let status = "ranked";
      const done = doneAgg.get(key);
      if (done) {
        const newerWeak = Math.max(ev?.weakAt ?? 0, ld?.lastSeen ?? 0) > done.last;
        if (newerWeak) returning = true;
        else if (ageDays(done.last) < REST_DAYS * Math.min(done.count, 4)) status = "resting";
        else doneFactor = 0.6;
      }
      const skipped = skipAt.get(key);
      if (status === "ranked" && skipped && ageDays(skipped) < SKIP_DAYS) status = "skipped";

      const score = c.weightage * need * urg * doneFactor;
      if (opts.debug) debugAll.push({ subject: s.subject, chapter: c.chapter, score: Math.round(score * 100) / 100, mastery, status });
      if (status !== "ranked") continue;

      // Why this, why now.
      const why: string[] = [];
      if (returning && done) why.push(`You marked it done on ${shortDate(done.last)}, but a later paper still lost marks here.`);
      if (ev) {
        why.push(
          `Across ${plural(ev.papers.size, "marked paper")} you have ${fmtMarks(ev.rawAw)} of ${fmtMarks(ev.rawMx)} marks here.`,
        );
      } else {
        why.push(`You have not been tested on it yet, and it carries ${c.weightage} of the ${meta.boardMax} theory marks.`);
      }
      const worst = ld?.open.sort((x, y) => y.severity * y.occurrences - x.severity * x.occurrences)[0];
      if (ld && ld.open.length && worst) {
        why.push(`${plural(ld.open.length, "open mistake")}, the worst being “${worst.title}”.`);
      }
      if (b.next !== null) {
        why.push(b.next === 0 ? `${meta.name} board paper is today.` : `${meta.name} board paper in ${plural(b.next, "day")}.`);
      }
      if (done && !returning) why.push(`Last finished ${shortDate(done.last)}; back because it still costs marks.`);

      const order = { high: 0, medium: 1, low: 2 } as const;
      const startWith = [...c.types]
        .sort((x, y) => order[x.weight] - order[y.weight])
        .slice(0, 2)
        .map((t) => ({ type: t.type, marks: t.marks }));

      candidates.push({
        family: family(meta.key),
        pick: {
          subject: s.subject,
          subjectShort: meta.short,
          chapter: c.chapter,
          weightage: c.weightage,
          boardMax: meta.boardMax,
          score: Math.round(score * 100) / 100,
          mastery: mastery === null ? null : Math.round(mastery * 1000) / 1000,
          daysToBoard: b.next,
          headline:
            mastery === null
              ? `Worth ${c.weightage} marks · not tested yet`
              : `Worth ${c.weightage} marks · ${Math.round(mastery * 100)}% earned so far`,
          why: why.join(" "),
          startWith,
          openMistakes: ld?.open.length ?? 0,
          practiceCount: practiceCount.get(key) ?? 0,
          timesDone: done?.count ?? 0,
          returning,
        },
      });
    }
  }

  // --- Choose three, spread across subjects ---
  const tieBreak = (a: Candidate, b: Candidate) => {
    const da = a.pick.daysToBoard ?? Infinity;
    const dbb = b.pick.daysToBoard ?? Infinity;
    if (da !== dbb) return da - dbb;
    if (a.pick.weightage !== b.pick.weightage) return b.pick.weightage - a.pick.weightage;
    return a.pick.chapter.localeCompare(b.pick.chapter);
  };
  const pool = [...candidates];
  const chosen: Candidate[] = [];
  const famCount = new Map<string, number>();
  while (chosen.length < 3 && pool.length) {
    let bestI = -1;
    let bestS = -Infinity;
    pool.forEach((c, i) => {
      const s = c.pick.score * Math.pow(0.5, famCount.get(c.family) ?? 0);
      if (bestI < 0 || s > bestS + 1e-9 || (Math.abs(s - bestS) <= 1e-9 && tieBreak(c, pool[bestI]) < 0)) {
        bestS = s;
        bestI = i;
      }
    });
    const [c] = pool.splice(bestI, 1);
    chosen.push(c);
    famCount.set(c.family, (famCount.get(c.family) ?? 0) + 1);
  }

  const dones = logs.filter((l) => l.action === "done");
  const plan: StudyPlan & { debug?: StudyDebug } = {
    picks: chosen.map((c) => c.pick),
    stats: {
      today: dones.filter((l) => dayKey(l.createdAt) === today).length,
      week: dones.filter((l) => now - l.createdAt.getTime() < 7 * DAY_MS).length,
      total: dones.length,
    },
    recentDone: dones.slice(0, 8).map((l) => ({ subject: l.subject, chapter: l.chapter, at: l.createdAt.toISOString() })),
  };
  if (opts.debug) {
    debugAll.sort((a, b) => b.score - a.score);
    plan.debug = { all: debugAll, units: debugUnits };
  }
  return plan;
}

export const EMPTY_PLAN: StudyPlan = { picks: [], stats: { today: 0, week: 0, total: 0 }, recentDone: [] };
