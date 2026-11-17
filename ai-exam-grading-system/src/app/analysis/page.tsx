import Link from "next/link";
import { desc, eq, isNull} from "drizzle-orm";
import { db } from "@/db";
import { attempts } from "@/db/schema";
import { fmtMarks, pct } from "@/lib/format";
import { SUBJECTS } from "@/lib/isc";
import { predictAll } from "@/lib/predict";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analysis by subject" };

export default async function AnalysisIndex() {
  const papers = await db
    .select({ subject: attempts.subject, status: attempts.status, awarded: attempts.awardedMarks, max: attempts.maxMarks, at: attempts.gradedAt, created: attempts.createdAt })
    .from(attempts)
    .where(isNull(attempts.deletedAt))
    .orderBy(desc(attempts.createdAt));
  const graded = papers.filter((p) => p.status === "graded" && (p.max ?? 0) > 0);
  const { subjects } = predictAll(
    graded.map((p) => ({ subject: p.subject, percent: pct(p.awarded ?? 0, p.max ?? 1), at: p.at ?? p.created })),
  );

  return (
    <div className="pt-8 sm:pt-12">
      <p className="kicker">Analysis</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">Every subject, on its own.</h1>
      <p className="mt-4 max-w-2xl text-soft">
        One page per subject: predicted marks, score history, the chapters that cost you, where the marks go and the
        mistakes still open. Nothing pooled across subjects, so nothing hides.
      </p>

      <ul className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {SUBJECTS.map((s) => {
          const p = subjects.find((x) => x.key === s.key);
          const count = graded.filter((g) => g.subject === s.name).length;
          return (
            <li key={s.key} className="bg-card p-6">
              <Link href={`/analysis/${s.key}`} className="font-medium hover:underline">
                {s.name}
              </Link>
              <p className="mt-3 font-serif text-4xl leading-none">
                {p?.predicted != null ? fmtMarks(p.predicted) : "—"}
                <span className="text-xl text-muted"> / {s.boardMax}</span>
              </p>
              <p className="mt-2 text-sm text-muted">
                {count === 0 ? "No marked papers yet" : `${count} paper${count === 1 ? "" : "s"} · projected`}
              </p>
              <Link href={`/analysis/${s.key}`} className="mt-3 inline-block text-sm font-medium text-muted hover:text-ink">
                Open analysis →
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
