"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import LocalDate from "./LocalDate";
import Rich from "./Rich";
import { fmtDuration, fmtLoss, fmtMarks, pct } from "@/lib/format";
import {
  INSIGHT_SHORT,
  LOSS_CATEGORIES,
  LOSS_COLOR,
  LOSS_LABEL,
  type AttemptDTO,
  type GradedQuestion,
} from "@/lib/types";

type Filter = "all" | "lost" | "full";

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="kicker">{label}</dt>
      <dd className="mt-1.5 text-[15px] leading-relaxed text-soft">{children}</dd>
    </div>
  );
}

function QuestionCard({ q }: { q: GradedQuestion }) {
  const full = q.maxMarks > 0 && q.awarded >= q.maxMarks;
  const zero = q.awarded <= 0;
  const badge = full ? "bg-pass-wash text-pass" : zero ? "bg-pen-wash text-pen" : "bg-warn-wash text-warn";
  const meta = [q.section && `Section ${q.section}`, q.unit].filter(Boolean).join(" · ");

  return (
    <article className={`card p-5 sm:p-7 ${q.counted ? "" : "opacity-70"}`}>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {meta && <p className="kicker">{meta}</p>}
          <h3 className="mt-1 font-serif text-[32px] leading-tight">Q {q.number}</h3>
          {q.topic && (
            <p className="mt-0.5 text-[15px] font-medium">
              <Rich text={q.topic} />
            </p>
          )}
        </div>
        <p
          className={`inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium tabular-nums ${badge}`}
          aria-label={`${fmtMarks(q.awarded)} out of ${fmtMarks(q.maxMarks)} marks`}
        >
          {fmtMarks(q.awarded)} / {fmtMarks(q.maxMarks)}
        </p>
      </header>

      {q.question && (
        <p className="mt-4 border-l-2 border-line pl-4 text-[15px] text-muted">
          <Rich text={q.question} />
        </p>
      )}

      <dl className="mt-5 space-y-5">
        <Block label="You wrote">
          {q.attempted ? (
            <Rich text={q.studentAnswer || "Nothing the examiner could credit."} />
          ) : (
            <span className="text-pen">Left blank.</span>
          )}
        </Block>

        {q.verdict && (
          <Block label={full ? "Why this earned full marks" : "Examiner's verdict"}>
            <Rich text={q.verdict} className="text-ink" />
          </Block>
        )}

        {q.lostMarks.length > 0 && (
          <Block label="Where the marks went">
            <ul className="space-y-2.5">
              {q.lostMarks.map((l, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-9 shrink-0 pt-px text-sm font-medium text-pen tabular-nums">
                    {l.marks > 0 ? `−${fmtMarks(l.marks)}` : "−"}
                  </span>
                  <span className="min-w-0">
                    <span
                      className="mr-2 inline-flex h-6 items-center rounded-full px-2.5 align-middle text-xs font-medium text-white"
                      style={{ background: LOSS_COLOR[l.category] }}
                    >
                      {LOSS_LABEL[l.category]}
                    </span>
                    <Rich text={l.reason} />
                  </span>
                </li>
              ))}
            </ul>
          </Block>
        )}

        {!full && q.modelAnswer && (
          <Block label="What a full-mark answer has">
            <Rich text={q.modelAnswer} />
          </Block>
        )}
      </dl>

      {(q.markingScheme || (full && q.modelAnswer)) && (
        <details className="mt-5 border-t border-line pt-4">
          <summary className="cursor-pointer text-sm font-medium text-muted hover:text-ink">
            Marking scheme{full && q.modelAnswer ? " and model answer" : ""}
          </summary>
          <dl className="mt-3 space-y-4">
            {q.markingScheme && (
              <Block label="How the marks are split">
                <Rich text={q.markingScheme} />
              </Block>
            )}
            {full && q.modelAnswer && (
              <Block label="Model answer">
                <Rich text={q.modelAnswer} />
              </Block>
            )}
          </dl>
        </details>
      )}

      {!q.counted && (
        <p className="mt-4 rounded-lg bg-wash px-3 py-2 text-sm text-soft">
          Surplus answer. You attempted more than the paper required, so this one is not counted in the total.
        </p>
      )}
      {q.readConfidence !== "high" && (
        <p className="mt-4 rounded-lg bg-warn-wash px-3 py-2 text-sm text-warn">
          {q.readConfidence === "low"
            ? "The handwriting or photo here was hard to read. Check this mark against your script."
            : "Parts of this answer were not fully legible. The mark may be off by a little."}
        </p>
      )}
    </article>
  );
}

export default function ReportView({ a }: { a: AttemptDTO }) {
  const r = a.report!;
  const [filter, setFilter] = useState<Filter>("all");
  const { awarded, max, percent, sumMax } = r.totals;

  const counted = useMemo(() => r.questions.filter((q) => q.counted), [r.questions]);
  const lostQs = r.questions.filter((q) => q.awarded < q.maxMarks);
  const fullQs = r.questions.filter((q) => q.maxMarks > 0 && q.awarded >= q.maxMarks);
  const shown = filter === "lost" ? lostQs : filter === "full" ? fullQs : r.questions;
  const lowRead = r.questions.filter((q) => q.readConfidence === "low").length;

  const losses = LOSS_CATEGORIES.map((c) => ({ c, marks: r.lossByCategory[c] ?? 0 }))
    .filter((x) => x.marks > 0.01)
    .sort((x, y) => y.marks - x.marks);
  const listedLoss = losses.reduce((s, x) => s + x.marks, 0);
  const unlisted = Math.max(0, max - awarded - listedLoss);

  const units = useMemo(() => {
    const m = new Map<string, { awarded: number; max: number }>();
    for (const q of counted) {
      const u = m.get(q.unit) ?? { awarded: 0, max: 0 };
      u.awarded += q.awarded;
      u.max += q.maxMarks;
      m.set(q.unit, u);
    }
    return [...m.entries()]
      .map(([unit, v]) => ({ unit, ...v, p: pct(v.awarded, v.max) }))
      .filter((u) => u.max > 0)
      .sort((x, y) => x.p - y.p);
  }, [counted]);

  const scoreTone = percent >= 80 ? "text-pass" : percent < 50 ? "text-pen" : "text-ink";
  const allowed = a.timeAllowedMin * 60000;

  return (
    <div className="mt-10">
      {/* Score */}
      <section className="grid items-end gap-8 border-b border-line pb-10 lg:grid-cols-[auto_1fr] lg:gap-14">
        <div>
          <p className="kicker">Marks awarded</p>
          <p className="mt-2 font-serif leading-[0.9] whitespace-nowrap">
            <span className={`text-[104px] sm:text-[136px] ${scoreTone}`}>{fmtMarks(awarded)}</span>
            <span className="text-[44px] text-muted sm:text-[56px]"> / {fmtMarks(max)}</span>
          </p>
          <p className="mt-3 text-[15px] text-muted">
            <span className="font-medium text-ink">{percent}%</span>
            {a.timeTakenMs != null && (
              <>
                {" · "}
                {fmtDuration(a.timeTakenMs)} of {fmtDuration(allowed)}
              </>
            )}
          </p>
        </div>
        {r.summary.headline && (
          <blockquote className="font-serif text-[28px] leading-[1.2] italic sm:text-4xl">
            <Rich text={r.summary.headline} />
          </blockquote>
        )}
      </section>

      {(Math.abs(sumMax - max) > 0.5 || lowRead > 0) && (
        <div className="mt-6 space-y-2">
          {sumMax < max - 0.5 && (
            <p className="rounded-xl bg-warn-wash px-4 py-3 text-sm text-warn">
              The examiner listed questions worth {fmtMarks(sumMax)} marks, but the paper is out of {fmtMarks(max)}. The
              remaining {fmtMarks(max - sumMax)} are counted as lost. If you did answer them, check that every page was
              uploaded and mark it again.
            </p>
          )}
          {sumMax > max + 0.5 && (
            <p className="rounded-xl bg-warn-wash px-4 py-3 text-sm text-warn">
              The questions listed add up to {fmtMarks(sumMax)} marks against a paper total of {fmtMarks(max)}. A choice
              question may have been counted twice, so treat the total with care.
            </p>
          )}
          {lowRead > 0 && (
            <p className="rounded-xl bg-warn-wash px-4 py-3 text-sm text-warn">
              {lowRead} answer{lowRead === 1 ? " was" : "s were"} hard to read. Those are flagged below. Clearer photos
              give a more reliable mark.
            </p>
          )}
        </div>
      )}

      {/* Where the marks went */}
      {max > 0 && (
        <section className="mt-12">
          <h2 className="display text-4xl">Where the marks went</h2>
          <div className="mt-5 flex h-4 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
            {awarded > 0 && <div className="bg-pass" style={{ width: `${(awarded / max) * 100}%` }} />}
            {losses.map((x) => (
              <div key={x.c} style={{ width: `${(x.marks / max) * 100}%`, background: LOSS_COLOR[x.c] }} />
            ))}
          </div>
          <ul className="mt-5 grid gap-x-8 gap-y-2.5 text-[15px] sm:grid-cols-2 lg:grid-cols-3">
            <li className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5">
                <span className="h-3 w-3 rounded-full bg-pass" aria-hidden="true" />
                Earned
              </span>
              <span className="tabular-nums">{fmtMarks(awarded)}</span>
            </li>
            {losses.map((x) => (
              <li key={x.c} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full" style={{ background: LOSS_COLOR[x.c] }} aria-hidden="true" />
                  {LOSS_LABEL[x.c]}
                </span>
                <span className="text-pen tabular-nums">−{fmtLoss(x.marks)}</span>
              </li>
            ))}
            {unlisted > 0.5 && (
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full bg-line" aria-hidden="true" />
                  Not listed by the examiner
                </span>
                <span className="text-pen tabular-nums">−{fmtMarks(unlisted)}</span>
              </li>
            )}
          </ul>
        </section>
      )}

      {/* Remarks */}
      <section className="mt-14 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="display text-4xl">Examiner&rsquo;s remarks</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-soft">
            <Rich text={r.summary.examinerRemarks} />
          </p>
          {r.summary.timeAnalysis && (
            <>
              <h3 className="kicker mt-8">Time</h3>
              <p className="mt-2 leading-relaxed text-soft">
                <Rich text={r.summary.timeAnalysis} />
              </p>
            </>
          )}
        </div>
        <div className="space-y-10">
          {r.summary.biggestLeaks.length > 0 && (
            <div>
              <h2 className="display text-4xl">Biggest leaks</h2>
              <ol className="mt-4 space-y-3">
                {r.summary.biggestLeaks.map((s, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="font-serif text-3xl leading-none text-pen">{i + 1}</span>
                    <span className="pt-0.5 text-soft">
                      <Rich text={s} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {r.summary.nextSteps.length > 0 && (
            <div>
              <h2 className="display text-4xl">Do this next</h2>
              <ol className="mt-4 space-y-3">
                {r.summary.nextSteps.map((s, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="font-serif text-3xl leading-none text-ink">{i + 1}</span>
                    <span className="pt-0.5 text-soft">
                      <Rich text={s} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>

      {/* Units */}
      {units.length > 1 && (
        <section className="mt-14">
          <h2 className="display text-4xl">By unit, weakest first</h2>
          <ul className="mt-5 divide-y divide-line border-y border-line">
            {units.map((u) => (
              <li key={u.unit} className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 py-3.5 sm:grid-cols-[1fr_200px_auto]">
                <span className="min-w-0 truncate">{u.unit}</span>
                <span className="order-3 col-span-2 h-2 overflow-hidden rounded-full bg-line sm:order-none sm:col-span-1" aria-hidden="true">
                  <span
                    className={`block h-full rounded-full ${u.p >= 80 ? "bg-pass" : u.p < 50 ? "bg-pen" : "bg-ink"}`}
                    style={{ width: `${u.p}%` }}
                  />
                </span>
                <span className="text-sm tabular-nums">
                  {fmtMarks(u.awarded)} / {fmtMarks(u.max)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Questions */}
      <section className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="display text-4xl">Question by question</h2>
          <div role="group" aria-label="Filter questions" className="flex gap-1 rounded-full border border-line bg-card p-1">
            {(
              [
                ["all", `All ${r.questions.length}`],
                ["lost", `Lost marks ${lostQs.length}`],
                ["full", `Full marks ${fullQs.length}`],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={`h-8 rounded-full px-3.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ink ${
                  filter === key ? "bg-ink font-medium text-paper" : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 space-y-4">
          {shown.length === 0 ? (
            <p className="card px-6 py-10 text-center text-muted">
              {filter === "full" ? "No question earned full marks." : "Nothing here."}
            </p>
          ) : (
            shown.map((q, i) => <QuestionCard key={`${q.number}-${i}`} q={q} />)
          )}
        </div>
      </section>

      {/* Mistakes log */}
      {r.profileUpdates.filter((u) => u.type !== "strength").length > 0 && (
        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="display text-4xl">Mistakes log</h2>
            <Link href="/mistakes" className="btn btn-ghost btn-sm">
              Open the full log
            </Link>
          </div>
          <p className="mt-2 max-w-2xl text-[15px] text-muted">
            Every mistake in this paper, the question that exposed it, why you made it, and how to stop it.
          </p>
          <ol className="mt-6 space-y-4">
            {r.profileUpdates
              .filter((u) => u.type !== "strength")
              .map((u) => (
                <li key={u.id} className="card p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="inline-flex h-6 items-center rounded-full bg-wash px-2.5 text-xs font-medium text-soft">
                      {INSIGHT_SHORT[u.type]}
                    </span>
                    {u.unit && <span className="kicker">{u.unit}</span>}
                    {u.questions.length > 0 && (
                      <span className="text-sm text-muted">
                        Question{u.questions.length === 1 ? "" : "s"}:{" "}
                        <span className="font-medium text-ink">{u.questions.join(", ")}</span>
                      </span>
                    )}
                    {u.recurring && (
                      <span className="text-sm font-medium text-pen">Seen {u.occurrences} times now.</span>
                    )}
                  </div>
                  <h3 className="mt-2 text-lg font-medium">
                    <Rich text={u.title} />
                  </h3>
                  {u.detail && (
                    <div className="mt-3">
                      <p className="kicker">Why you made it</p>
                      <p className="mt-1 text-[15px] text-soft">
                        <Rich text={u.detail} />
                      </p>
                    </div>
                  )}
                  {u.fix && (
                    <div className="mt-3 border-l-2 border-ink pl-4">
                      <p className="kicker">How to stop it</p>
                      <p className="mt-1 text-[15px]">
                        <Rich text={u.fix} />
                      </p>
                    </div>
                  )}
                </li>
              ))}
          </ol>
        </section>
      )}

      {/* Knowledge map */}
      {(r.profileUpdates.length > 0 || r.improvedCount > 0) && (
        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="display text-4xl">Added to your knowledge map</h2>
            <Link href={`/knowledge?subject=${encodeURIComponent(a.subject)}`} className="btn btn-ghost btn-sm">
              Open the map
            </Link>
          </div>
          <ul className="mt-5 divide-y divide-line border-y border-line">
            {r.profileUpdates.map((u) => (
              <li key={u.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
                <span
                  className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium ${
                    u.type === "strength" ? "bg-pass-wash text-pass" : "bg-wash text-soft"
                  }`}
                >
                  {INSIGHT_SHORT[u.type]}
                </span>
                <span className="min-w-0 text-[15px]">
                  <Rich text={u.title} />
                </span>
                {u.recurring && u.type !== "strength" && (
                  <span className="text-sm font-medium text-pen">Again. Seen {u.occurrences} times now.</span>
                )}
              </li>
            ))}
          </ul>
          {r.improvedCount > 0 && (
            <p className="mt-3 text-sm text-pass">
              {r.improvedCount} earlier weakness{r.improvedCount === 1 ? "" : "es"} handled correctly this time.
            </p>
          )}
        </section>
      )}

      <p className="mt-10 text-sm text-muted">
        Marked{a.model ? ` by ${a.model}` : ""}
        {a.gradedAt && (
          <>
            {" on "}
            <LocalDate iso={a.gradedAt} withTime />
          </>
        )}
        . {r.totals.maxSource === "you" ? "Paper total as you entered it." : r.totals.maxSource === "paper" ? "Paper total read from the question paper." : "Paper total taken as the sum of the questions listed."}
      </p>
    </div>
  );
}
