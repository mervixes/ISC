import Link from "next/link";
import { and, asc, desc, eq, ne, sql, isNull} from "drizzle-orm";
import { db } from "@/db";
import { attempts, events, insights } from "@/db/schema";
import BoardCountdown, { type BoardEvent } from "@/components/BoardCountdown";
import CalendarView, { type PaperDay } from "@/components/CalendarView";
import LocalDate from "@/components/LocalDate";
import StudyNow from "@/components/StudyNow";
import { fmtDuration, fmtMarks } from "@/lib/format";
import { hasAiKey } from "@/lib/keys";
import { predictAll, type Overall, type SubjectPrediction } from "@/lib/predict";
import { computeStudyPlan, EMPTY_PLAN } from "@/lib/study";
import type { EventKind, EventRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const TREND = { up: "↑ rising", down: "↓ falling", flat: "→ steady" } as const;
const CONFIDENCE = {
  none: "No papers yet",
  low: "One paper: rough",
  medium: "2 or 3 papers",
  good: "4 or more papers",
} as const;

function PredictionCard({ p }: { p: SubjectPrediction }) {
  const hasPrediction = p.predicted !== null && p.low !== null && p.high !== null;
  const trendTone = p.trend === "up" ? "text-pass" : p.trend === "down" ? "text-pen" : "text-muted";
  return (
    <li className="bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/analysis/${p.key}`} className="font-medium hover:underline">
          {p.name}
        </Link>
        {p.trend && <span className={`shrink-0 text-sm ${trendTone}`}>{TREND[p.trend]}</span>}
      </div>
      {hasPrediction ? (
        <>
          <p className="mt-4 font-serif text-5xl leading-none">
            {fmtMarks(p.predicted ?? 0)}
            <span className="text-2xl text-muted"> / {p.boardMax}</span>
          </p>
          <p className="mt-2 text-sm text-muted">
            Range {fmtMarks(p.low ?? 0)} to {fmtMarks(p.high ?? 0)} · last paper {p.lastPercent}%
          </p>
        </>
      ) : (
        <p className="mt-4 text-soft">No marked paper yet. Sit one and the prediction appears here.</p>
      )}
      <p className="mt-4 text-xs text-muted">
        {p.boardNote} · {CONFIDENCE[p.confidence]}
      </p>
      <Link href={`/analysis/${p.key}`} className="mt-2 inline-block text-sm font-medium text-muted hover:text-ink">
        See the full analysis →
      </Link>
    </li>
  );
}

function OverallCard({ o }: { o: Overall | null }) {
  return (
    <div className="card flex flex-col justify-between p-6 sm:p-8">
      <div>
        <p className="kicker">Projected board total</p>
        {o ? (
          <>
            <p className="mt-3 font-serif text-6xl leading-none">
              {fmtMarks(o.predicted)}
              <span className="text-3xl text-muted"> / {o.max}</span>
            </p>
            <p className="mt-3 text-[15px] text-soft">
              {o.percent}% across the {o.subjects} subject{o.subjects === 1 ? "" : "s"} you have marked.
            </p>
          </>
        ) : (
          <p className="mt-3 text-soft">Mark a paper in any subject and your projected board total appears here.</p>
        )}
      </div>
      <p className="mt-6 text-sm text-muted">
        Weighted to your latest papers. A projection from practice, not a promise.
      </p>
    </div>
  );
}

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

export default async function Dashboard() {
  const rows = await db
    .select({
      id: attempts.id,
      title: attempts.title,
      subject: attempts.subject,
      status: attempts.status,
      createdAt: attempts.createdAt,
      startedAt: attempts.startedAt,
      gradedAt: attempts.gradedAt,
      pausedAt: attempts.pausedAt,
      timeTakenMs: attempts.timeTakenMs,
      timeAllowedMin: attempts.timeAllowedMin,
      awardedMarks: attempts.awardedMarks,
      maxMarks: attempts.maxMarks,
    })
    .from(attempts)
    .where(isNull(attempts.deletedAt))
    .orderBy(desc(attempts.createdAt));
  const evs = await db.select().from(events).orderBy(asc(events.day));
  const keyReady = await hasAiKey();
  const [{ n: openIssues }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(insights)
    .where(and(ne(insights.type, "strength"), eq(insights.status, "active")));

  const graded = rows.filter((r) => r.status === "graded" && (r.maxMarks ?? 0) > 0);
  const percentOf = (r: { awardedMarks: number | null; maxMarks: number | null }) =>
    ((r.awardedMarks ?? 0) / (r.maxMarks ?? 1)) * 100;
  const { subjects, overall } = predictAll(
    graded.map((r) => ({ subject: r.subject, percent: percentOf(r), at: r.gradedAt ?? r.createdAt })),
  );

  const boards: BoardEvent[] = evs
    .filter((e) => e.kind === "board")
    .map((e) => ({ id: e.id, day: e.day, title: e.title, subject: e.subject }));
  const eventRows: EventRow[] = evs.map((e) => ({
    id: e.id,
    day: e.day,
    kind: e.kind as EventKind,
    title: e.title,
    subject: e.subject,
  }));
  const papers: PaperDay[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    subject: r.subject,
    iso: (r.startedAt ?? r.createdAt).toISOString(),
  }));

  let studyPlan = EMPTY_PLAN;
  try {
    studyPlan = await computeStudyPlan();
  } catch (e) {
    console.error("[study] could not build the plan:", e);
  }

  const avg = graded.length ? graded.reduce((s, r) => s + percentOf(r), 0) / graded.length : null;
  const timed = rows.reduce((s, r) => s + (r.timeTakenMs ?? 0), 0);

  return (
    <div className="pt-8 sm:pt-12">
      {!keyReady && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warn/30 bg-warn-wash px-5 py-4">
          <p className="text-[15px] text-warn">
            No API key yet. You can sit papers, but marking needs a key from Anthropic, OpenAI, Google or OpenRouter.
          </p>
          <Link href="/keys" className="btn btn-ghost btn-sm">
            Add a key
          </Link>
        </div>
      )}

      <p className="kicker">Dashboard</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">
        Where you <span className="text-pen italic">stand.</span>
      </h1>

      <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        {[
          ["Papers marked", String(graded.length), null],
          ["Average score", avg === null ? "—" : `${Math.round(avg)}%`, null],
          ["Time on the clock", timed ? fmtDuration(timed) : "—", null],
          ["Open weaknesses", String(openIssues), "/knowledge"],
        ].map(([label, value, href]) => (
          <div key={label} className="bg-card px-5 py-5">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-1 font-serif text-[40px] leading-none">
              {href ? (
                <Link href={href} className="link decoration-1">
                  {value}
                </Link>
              ) : (
                value
              )}
            </dd>
          </div>
        ))}
      </dl>

      <StudyNow initial={studyPlan} />

      <section className="mt-14 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <BoardCountdown boards={boards} />
        <OverallCard o={overall} />
      </section>

      <section className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="display text-4xl">Predicted board marks</h2>
          <Link href="/analysis" className="text-sm text-muted hover:text-ink">
            Analysis by subject →
          </Link>
        </div>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">
          Built from your last six marked papers in each subject, weighted to the most recent. The band widens when your
          results swing.
        </p>
        <ul className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((p) => (
            <PredictionCard key={p.key} p={p} />
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="display text-4xl">Calendar</h2>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">
          CISCE&rsquo;s 2027 board timetable, your sittings, and anything you add. Click a day to see or edit it.
        </p>
        <div className="mt-6">
          <CalendarView events={eventRows} papers={papers} />
        </div>
      </section>

      <section className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="display text-4xl">Recent papers</h2>
          <Link href="/papers" className="text-sm text-muted hover:text-ink">
            All papers →
          </Link>
        </div>
        {rows.length === 0 ? (
          <div className="card mt-6 px-6 py-10 text-center">
            <p className="text-soft">No papers yet.</p>
            <Link href="/new" className="btn btn-primary mt-5">
              Start your first paper
            </Link>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {rows.slice(0, 5).map((r) => {
              const done = r.status === "graded" && (r.maxMarks ?? 0) > 0;
              return (
                <li key={r.id}>
                  <Link
                    href={`/attempt/${r.id}`}
                    className="group -mx-3 flex items-center justify-between gap-4 rounded-xl px-3 py-4 transition-colors hover:bg-wash focus-visible:outline-2 focus-visible:outline-ink"
                  >
                    <div className="min-w-0">
                      <p className="kicker">{r.subject}</p>
                      <p className="mt-0.5 truncate font-medium">{r.title}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        <LocalDate iso={r.createdAt.toISOString()} />
                        {r.timeTakenMs != null && <> · {fmtDuration(r.timeTakenMs)} taken</>}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {done ? (
                        <p className="font-serif text-3xl leading-none">
                          {fmtMarks(r.awardedMarks ?? 0)}
                          <span className="text-xl text-muted"> / {fmtMarks(r.maxMarks ?? 0)}</span>
                        </p>
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
      </section>
    </div>
  );
}
