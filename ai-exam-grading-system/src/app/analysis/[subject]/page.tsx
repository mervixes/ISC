import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { attempts, insights } from "@/db/schema";
import Rich from "@/components/Rich";
import LocalDate from "@/components/LocalDate";
import { fmtDuration, fmtMarks, pct } from "@/lib/format";
import { SUBJECTS } from "@/lib/isc";
import { predictAll } from "@/lib/predict";
import { LOSS_CATEGORIES, LOSS_COLOR, LOSS_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SubjectAnalysis({ params }: { params: Promise<{ subject: string }> }) {
  const raw = decodeURIComponent((await params).subject);
  const subject = SUBJECTS.find((s) => s.key === raw || s.name.toLowerCase() === raw.toLowerCase());
  if (!subject) notFound();

  const papers = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.subject, subject.name), isNull(attempts.deletedAt)))
    .orderBy(desc(attempts.createdAt));
  const graded = papers.filter((p) => p.status === "graded" && (p.maxMarks ?? 0) > 0);
  const tips = await db
    .select()
    .from(insights)
    .where(eq(insights.subject, subject.name))
    .orderBy(desc(insights.occurrences), desc(insights.lastSeenAt));

  const { subjects } = predictAll(
    graded.map((p) => ({ subject: p.subject, percent: pct(p.awardedMarks ?? 0, p.maxMarks ?? 1), at: p.gradedAt ?? p.createdAt })),
  );
  const pred = subjects.find((s) => s.key === subject.key);

  const chapterAgg = new Map<string, { awarded: number; max: number; questions: number }>();
  const lossTotals = new Map<string, number>();
  const unitQuestions: string[] = [];
  for (const p of graded) {
    for (const q of p.report?.questions ?? []) {
      if (!q.counted || q.maxMarks <= 0) continue;
      const v = chapterAgg.get(q.unit) ?? { awarded: 0, max: 0, questions: 0 };
      v.awarded += q.awarded;
      v.max += q.maxMarks;
      v.questions += 1;
      chapterAgg.set(q.unit, v);
      if (q.awarded < q.maxMarks) unitQuestions.push(`${q.number}: ${q.unit}`);
    }
    for (const [cat, marks] of Object.entries(p.report?.lossByCategory ?? {})) {
      lossTotals.set(cat, (lossTotals.get(cat) ?? 0) + (marks ?? 0));
    }
  }
  const chapters = [...chapterAgg.entries()]
    .map(([unit, v]) => ({ unit, ...v, percent: pct(v.awarded, v.max) }))
    .sort((a, b) => a.percent - b.percent);
  const losses = LOSS_CATEGORIES.filter((c) => (lossTotals.get(c) ?? 0) > 0.01)
    .map((c) => ({ c, marks: lossTotals.get(c) ?? 0 }))
    .sort((a, b) => b.marks - a.marks);
  const maxLoss = losses[0]?.marks ?? 1;

  const strengths = tips.filter((t) => t.type === "strength");
  const weaknesses = tips.filter((t) => t.type !== "strength" && t.status === "active");
  const recent = graded.slice(0, 8).reverse();
  const timeUsed = graded.reduce((a, p) => a + (p.timeTakenMs ?? 0), 0);
  const allowed = graded.reduce((a, p) => a + p.timeAllowedMin * 60000, 0);

  return (
    <div className="pt-8 sm:pt-12">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← Dashboard
      </Link>
      <p className="kicker mt-5">Analysis · {subject.boardNote}</p>
      <h1 className="display mt-2 text-5xl sm:text-6xl">{subject.name}</h1>

      {graded.length === 0 ? (
        <div className="card mt-10 px-6 py-14 text-center">
          <p className="text-soft">No marked {subject.short} paper yet, so there is nothing to analyse.</p>
          <Link href="/new" className="btn btn-primary mt-6">
            Sit a paper
          </Link>
        </div>
      ) : (
        <>
          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
            <div className="bg-card px-5 py-5">
              <dt className="text-sm text-muted">Predicted board mark</dt>
              <dd className="mt-1 font-serif text-[40px] leading-none">
                {pred?.predicted != null ? `${fmtMarks(pred.predicted)}/${subject.boardMax}` : "—"}
              </dd>
              {pred?.low != null && (
                <p className="mt-1 text-sm text-muted">
                  range {fmtMarks(pred.low)} to {fmtMarks(pred.high ?? 0)}
                </p>
              )}
            </div>
            <div className="bg-card px-5 py-5">
              <dt className="text-sm text-muted">Papers marked</dt>
              <dd className="mt-1 font-serif text-[40px] leading-none">{graded.length}</dd>
              <p className="mt-1 text-sm text-muted">
                {pred?.trend ? `trend ${pred.trend}` : "not enough papers for a trend"}
              </p>
            </div>
            <div className="bg-card px-5 py-5">
              <dt className="text-sm text-muted">Average</dt>
              <dd className="mt-1 font-serif text-[40px] leading-none">
                {Math.round(graded.reduce((a, p) => a + pct(p.awardedMarks ?? 0, p.maxMarks ?? 0), 0) / graded.length)}%
              </dd>
            </div>
            <div className="bg-card px-5 py-5">
              <dt className="text-sm text-muted">Time used</dt>
              <dd className="mt-1 font-serif text-[40px] leading-none">{fmtDuration(timeUsed)}</dd>
              <p className="mt-1 text-sm text-muted">of {fmtDuration(allowed)} allowed</p>
            </div>
          </dl>

          <section className="mt-12">
            <h2 className="display text-4xl">Score history</h2>
            <div className="card mt-4 flex items-end gap-2 p-5" style={{ minHeight: 180 }}>
              {recent.map((p) => {
                const pctv = pct(p.awardedMarks ?? 0, p.maxMarks ?? 0);
                return (
                  <div key={p.id} className="flex min-w-0 flex-1 flex-col items-center gap-2" title={`${p.title}: ${pctv}%`}>
                    <span className="text-xs text-muted tabular-nums">{Math.round(pctv)}%</span>
                    <div className="flex h-[100px] w-full items-end">
                      <div
                        className={`w-full rounded-t ${pctv >= 80 ? "bg-pass" : pctv < 50 ? "bg-pen" : "bg-ink"}`}
                        style={{ height: `${Math.max(4, pctv)}%` }}
                      />
                    </div>
                    <Link href={`/attempt/${p.id}`} className="w-full truncate text-center text-[11px] text-muted hover:text-ink">
                      {p.title}
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="mt-12 grid gap-12 lg:grid-cols-2">
            <section>
              <h2 className="display text-4xl">By chapter, weakest first</h2>
              {chapters.length === 0 ? (
                <p className="mt-3 text-soft">No chapter-level data was recorded in these reports.</p>
              ) : (
                <ul className="mt-4 divide-y divide-line border-y border-line">
                  {chapters.map((c) => (
                    <li key={c.unit} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3">
                      <span className="min-w-0 truncate">{c.unit}</span>
                      <span className="text-right text-sm tabular-nums text-muted">
                        {fmtMarks(c.awarded)}/{fmtMarks(c.max)} · {c.percent}%
                      </span>
                      <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                        <span
                          className={`block h-full rounded-full ${c.percent >= 80 ? "bg-pass" : c.percent < 50 ? "bg-pen" : "bg-ink"}`}
                          style={{ width: `${c.percent}%` }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="display text-4xl">Where the marks go</h2>
              {losses.length === 0 ? (
                <p className="mt-3 text-soft">No losses recorded. Suspicious, but that is what the reports say.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {losses.map((l) => (
                    <li key={l.c}>
                      <div className="flex items-baseline justify-between gap-3 text-[15px]">
                        <span>{LOSS_LABEL[l.c]}</span>
                        <span className="font-medium text-pen">−{Math.round(l.marks * 10) / 10}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
                        <div className="h-full rounded-full" style={{ width: `${(l.marks / maxLoss) * 100}%`, background: LOSS_COLOR[l.c] }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {unitQuestions.length > 0 && (
                <p className="mt-4 text-sm text-muted">
                  Questions that lost marks: {unitQuestions.slice(0, 12).join(" · ")}
                </p>
              )}
            </section>
          </div>

          <section className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="display text-4xl">Mistakes to fix in {subject.short}</h2>
              <Link href={`/mistakes?s=${encodeURIComponent(subject.name)}`} className="btn btn-ghost btn-sm">
                Full mistakes log
              </Link>
            </div>
            {weaknesses.length === 0 ? (
              <p className="mt-3 text-soft">Nothing active. Either you are clean or nothing has been marked.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {weaknesses.slice(0, 8).map((r) => (
                  <li key={r.id} className="card p-5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="kicker">{[r.unit, r.type.replace("_", " ")].filter(Boolean).join(" · ")}</p>
                      {r.occurrences > 1 && (
                        <span className="inline-flex h-6 items-center rounded-full bg-pen px-2.5 text-xs font-medium text-white">
                          Seen {r.occurrences}×
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-medium">
                      <Rich text={r.title} />
                    </p>
                    {r.detail && (
                      <p className="mt-1 text-[15px] text-soft">
                        <Rich text={r.detail} />
                      </p>
                    )}
                    {r.fix && (
                      <p className="mt-2 border-l-2 border-ink pl-3 text-[15px]">
                        <span className="font-medium">Fix: </span>
                        <Rich text={r.fix} />
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {strengths.length > 0 && (
              <>
                <h3 className="display mt-8 text-3xl">What you actually know</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {strengths.map((s) => (
                    <li key={s.id} className="rounded-full bg-pass-wash px-3 py-1 text-sm text-pass">
                      <Rich text={s.title} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="mt-12">
            <h2 className="display text-4xl">Every {subject.short} paper</h2>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {papers.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/attempt/${p.id}`} className="font-medium hover:underline">
                      {p.title}
                    </Link>
                    <p className="text-sm text-muted">
                      <LocalDate iso={p.createdAt.toISOString()} />
                      {p.timeTakenMs != null && ` · ${fmtDuration(p.timeTakenMs)}`} · {p.status}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums">
                    {p.maxMarks ? `${fmtMarks(p.awardedMarks ?? 0)} / ${fmtMarks(p.maxMarks)} (${pct(p.awardedMarks ?? 0, p.maxMarks)}%)` : "—"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
