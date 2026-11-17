import Link from "next/link";
import { desc, isNull} from "drizzle-orm";
import { db } from "@/db";
import { attempts } from "@/db/schema";
import LocalDate from "@/components/LocalDate";
import { fmtDuration, fmtMarks, pct } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Papers" };

function StatusPill({ status, paused }: { status: string; paused: boolean }) {
  const map: Record<string, { label: string; cls: string }> = {
    ready: { label: "Not started", cls: "bg-wash text-soft" },
    in_progress: paused
      ? { label: "Paused", cls: "bg-warn-wash text-warn" }
      : { label: "Clock running", cls: "bg-pen-wash text-pen" },
    finished: { label: "Awaiting answers", cls: "bg-warn-wash text-warn" },
    grading: { label: "Being marked", cls: "bg-wash text-soft" },
  };
  const s = map[status] ?? map.ready;
  return <span className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export default async function Papers() {
  const rows = await db
    .select({
      id: attempts.id,
      title: attempts.title,
      subject: attempts.subject,
      status: attempts.status,
      createdAt: attempts.createdAt,
      pausedAt: attempts.pausedAt,
      timeTakenMs: attempts.timeTakenMs,
      timeAllowedMin: attempts.timeAllowedMin,
      awardedMarks: attempts.awardedMarks,
      maxMarks: attempts.maxMarks,
    })
    .from(attempts)
    .where(isNull(attempts.deletedAt))
    .orderBy(desc(attempts.createdAt));

  return (
    <div className="pt-8 sm:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Papers</p>
          <h1 className="display mt-3 text-5xl sm:text-6xl">Every paper you have sat</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/papers/bin" className="btn btn-ghost">
            Recycle bin
          </Link>
          <Link href="/new" className="btn btn-primary">
            New paper
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card mt-10 px-6 py-14 text-center">
          <p className="text-soft">Nothing sat yet.</p>
          <Link href="/new" className="btn btn-primary mt-6">
            Start your first paper
          </Link>
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-line border-y border-line">
          {rows.map((r) => {
            const done = r.status === "graded" && (r.maxMarks ?? 0) > 0;
            const p = done ? pct(r.awardedMarks ?? 0, r.maxMarks ?? 0) : 0;
            return (
              <li key={r.id}>
                <Link
                  href={`/attempt/${r.id}`}
                  className="group -mx-3 flex items-center justify-between gap-4 rounded-xl px-3 py-5 transition-colors hover:bg-wash focus-visible:outline-2 focus-visible:outline-ink"
                >
                  <div className="min-w-0">
                    <p className="kicker">{r.subject}</p>
                    <p className="mt-1 truncate text-lg font-medium">{r.title}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      <LocalDate iso={r.createdAt.toISOString()} />
                      {r.timeTakenMs != null && (
                        <>
                          {" · "}
                          {fmtDuration(r.timeTakenMs)} of {fmtDuration(r.timeAllowedMin * 60000)}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {done ? (
                      <>
                        <p className="font-serif text-4xl leading-none">
                          <span className={p >= 80 ? "text-pass" : p < 50 ? "text-pen" : ""}>
                            {fmtMarks(r.awardedMarks ?? 0)}
                          </span>
                          <span className="text-2xl text-muted"> / {fmtMarks(r.maxMarks ?? 0)}</span>
                        </p>
                        <p className="mt-1 text-sm text-muted">{p}%</p>
                      </>
                    ) : (
                      <StatusPill status={r.status} paused={!!r.pausedAt} />
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
