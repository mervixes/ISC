import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { attempts, files, insights } from "@/db/schema";
import { gradingProgress } from "./progress";
import { hasAiKey } from "./keys";
import type { AttemptDTO, AttemptStatus, FileMeta } from "./types";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function loadAttempt(id: number): Promise<AttemptDTO | null> {
  let [a] = await db.select().from(attempts).where(eq(attempts.id, id));
  if (!a) return null;

  // A "grading" row with no live job means the server restarted mid-marking.
  if (a.status === "grading" && !gradingProgress.has(id)) {
    const age = a.gradingStartedAt ? Date.now() - a.gradingStartedAt.getTime() : Infinity;
    if (age > 15_000) {
      [a] = await db
        .update(attempts)
        .set({
          status: a.report ? "graded" : "finished",
          error: "Marking was interrupted before it finished. Run it again.",
        })
        .where(and(eq(attempts.id, id), eq(attempts.status, "grading")))
        .returning();
      if (!a) return loadAttempt(id);
    }
  }

  const fs = await db
    .select({ id: files.id, kind: files.kind, name: files.name, mime: files.mime, size: files.size })
    .from(files)
    .where(eq(files.attemptId, id))
    .orderBy(asc(files.position), asc(files.id));

  return {
    id: a.id,
    title: a.title,
    subject: a.subject,
    totalMarks: a.totalMarks,
    timeAllowedMin: a.timeAllowedMin,
    status: a.status as AttemptStatus,
    createdAt: a.createdAt.toISOString(),
    startedAt: iso(a.startedAt),
    pausedAt: iso(a.pausedAt),
    pausedMs: a.pausedMs,
    finishedAt: iso(a.finishedAt),
    timeTakenMs: a.timeTakenMs,
    gradedAt: iso(a.gradedAt),
    error: a.error,
    awardedMarks: a.awardedMarks,
    maxMarks: a.maxMarks,
    model: a.model,
    report: a.report ?? null,
    files: fs as FileMeta[],
    progress: a.status === "grading" ? (gradingProgress.get(id) ?? null) : null,
    hasKey: await hasAiKey(),
    serverNow: new Date().toISOString(),
  };
}

/** Papers in the recycle bin. */
export async function loadRecycledAttempts() {
  const rows = await db
    .select({
      id: attempts.id,
      title: attempts.title,
      subject: attempts.subject,
      status: attempts.status,
      createdAt: attempts.createdAt,
      deletedAt: attempts.deletedAt,
      awardedMarks: attempts.awardedMarks,
      maxMarks: attempts.maxMarks,
      report: attempts.report,
    })
    .from(attempts)
    .where(isNotNull(attempts.deletedAt))
    .orderBy(desc(attempts.deletedAt));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    subject: r.subject,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    deletedAt: (r.deletedAt as Date).toISOString(),
    awardedMarks: r.awardedMarks,
    maxMarks: r.maxMarks,
    questions: r.report?.questions?.length ?? 0,
  }));
}

/** Remove one attempt's evidence from the knowledge map (used on delete and before re-marking). */
export async function detachAttemptFromInsights(attemptId: number): Promise<void> {
  const rows = await db
    .select()
    .from(insights)
    .where(
      and(isNotNull(insights.evidence), sql`${insights.evidence} @> ${JSON.stringify([{ attemptId }])}::jsonb`),
    );
  for (const r of rows) {
    const rest = (r.evidence ?? []).filter((e) => e.attemptId !== attemptId);
    if (rest.length === 0) {
      await db.delete(insights).where(eq(insights.id, r.id));
    } else {
      await db
        .update(insights)
        .set({ evidence: rest, occurrences: Math.max(1, rest.length) })
        .where(eq(insights.id, r.id));
    }
  }
}
