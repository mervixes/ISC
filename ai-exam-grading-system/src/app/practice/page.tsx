import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { attempts, insights, questionBank } from "@/db/schema";
import PracticeBrowser from "@/components/PracticeBrowser";
import { PRACTICE } from "@/lib/practice-data";
import { canonicalChapter, chapterWeight } from "@/lib/qtypes";
import { SUBJECTS } from "@/lib/isc";

export const dynamic = "force-dynamic";
export const metadata = { title: "Practice" };

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ subject?: string; chapter?: string }> }) {
  const sp = await searchParams;
  const graded = await db
    .select({ id: attempts.id, subject: attempts.subject, report: attempts.report })
    .from(attempts)
    .where(and(eq(attempts.status, "graded"), isNull(attempts.deletedAt)));
  const rows = await db.select().from(insights).orderBy(desc(insights.occurrences), desc(insights.lastSeenAt));

  const mistakeUnits = new Set<string>();
  for (const r of rows) {
    if (r.type === "strength") continue;
    const key = `${r.subject}::${r.unit.toLowerCase()}`;
    mistakeUnits.add(key);
  }

  // Weightage comes from the syllabus chapter table, so the two pages never disagree.
  // Two sources: the specimen papers shipped with the app, and questions read out of papers the
  // student uploaded. Uploaded ones are kept even after the paper is recycled.
  const uploaded = await db.select().from(questionBank).orderBy(desc(questionBank.createdAt));
  const specimen = PRACTICE.map((q) => ({
    subject: q.subject,
    n: q.n,
    section: q.section,
    marks: q.marks,
    chapter: q.chapter,
    text: q.text,
    source: "ISC specimen paper" as const,
    sourceId: null as number | null,
  }));
  const mine = uploaded.map((q) => ({
    subject: q.subject,
    n: q.number,
    section: q.section,
    marks: q.marks,
    chapter: q.chapter,
    text: q.text,
    source: q.sourceName || "your uploaded paper",
    sourceId: q.attemptId as number | null,
  }));

  const questions = [...specimen, ...mine].map((q) => {
    const key = `${q.subject}::${q.chapter.toLowerCase()}`;
    const w = chapterWeight(q.subject, q.chapter);
    return {
      ...q,
      chapter: canonicalChapter(q.subject, q.chapter),
      weightage: w,
      isMistake: mistakeUnits.has(key),
      isHigh: w >= 8,
      isEasy: (q.marks ?? 99) <= 2,
    };
  });

  return (
    <div className="pt-8 sm:pt-12">
      <p className="kicker">Practice</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">Practise what costs you.</h1>
      <p className="mt-4 max-w-2xl text-soft">
        Every question below is from the ISC specimen papers in your Library. Filter to the chapters where you lose
        marks, to the high-weightage chapters, or to the short questions that are easy marks.
      </p>
      <div className="mt-10">
        <PracticeBrowser
          questions={questions}
          subjects={SUBJECTS.map((s) => s.name)}
          initialSubject={sp.subject}
          initialChapter={sp.chapter}
        />
      </div>
    </div>
  );
}
