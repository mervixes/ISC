import Link from "next/link";
import { db } from "@/db";
import { questionBank } from "@/db/schema";
import { eq } from "drizzle-orm";
import BinActions from "@/components/BinActions";
import LocalDate from "@/components/LocalDate";
import { loadRecycledAttempts } from "@/lib/attempts";
import { fmtMarks, fmtBytes } from "@/lib/format";
import { SUBJECTS } from "@/lib/isc";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recycle bin" };

export default async function BinPage() {
  const papers = await loadRecycledAttempts();
  const savedQuestions = await Promise.all(
    papers.map(async (p) => ({
      id: p.id,
      n: (await db.select({ id: questionBank.id }).from(questionBank).where(eq(questionBank.attemptId, p.id))).length,
    })),
  );
  const saved = new Map(savedQuestions.map((q) => [q.id, q.n]));

  return (
    <div className="pt-8 sm:pt-12">
      <Link href="/papers" className="text-sm text-muted hover:text-ink">
        ← Papers
      </Link>
      <p className="kicker mt-5">Recycle bin</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">Deleted, not destroyed.</h1>
      <p className="mt-4 max-w-2xl text-soft">
        A recycled paper keeps its question paper, its report and its place in your knowledge map. Restore it and it
        comes back exactly as it was. Purging is the only destructive action, and it is deliberate.
      </p>

      {papers.length === 0 ? (
        <div className="card mt-10 px-6 py-14 text-center">
          <p className="text-soft">The bin is empty.</p>
          <Link href="/papers" className="btn btn-ghost mt-5">
            Back to papers
          </Link>
        </div>
      ) : (
        <ul className="mt-10 space-y-4">
          {papers.map((p) => {
            const subject = SUBJECTS.find((s) => s.name === p.subject);
            const qn = saved.get(p.id) ?? 0;
            return (
              <li key={p.id} className="card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="kicker">{p.subject}</p>
                    <h2 className="mt-1 truncate text-lg font-medium">{p.title}</h2>
                    <p className="mt-0.5 text-sm text-muted">
                      Deleted <LocalDate iso={p.deletedAt} withTime /> · sat{" "}
                      <LocalDate iso={p.createdAt} />
                      {p.maxMarks ? (
                        <>
                          {" · "}
                          {fmtMarks(p.awardedMarks ?? 0)} / {fmtMarks(p.maxMarks)}
                        </>
                      ) : (
                        <> · {p.status}</>
                      )}
                    </p>
                    {qn > 0 && (
                      <p className="mt-2 text-sm text-pass">
                        {qn} question{qn === 1 ? "" : "s"} from this paper remain in your practice bank.
                      </p>
                    )}
                    {p.questions > 0 && (
                      <p className="mt-1 text-sm text-muted">{p.questions} marked parts kept with the report.</p>
                    )}
                  </div>
                  <BinActions id={p.id} />
                </div>
                {subject && (
                  <p className="mt-4 border-t border-line pt-3 text-sm text-muted">
                    Restoring returns it to Papers, Analysis and your knowledge map.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
