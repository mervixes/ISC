import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { attempts, insights } from "@/db/schema";
import DismissInsight from "@/components/DismissInsight";
import LocalDate from "@/components/LocalDate";
import Rich from "@/components/Rich";
import { INSIGHT_LABEL, INSIGHT_TYPES, type InsightType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mistakes log" };

type Row = typeof insights.$inferSelect;

const WHY: Record<string, string> = {
  formula: "You did not know the formula, or recalled it wrong.",
  concept_gap: "The idea itself was not understood.",
  silly_mistake: "You knew the method and slipped anyway.",
  exam_technique: "The habit on the page cost the mark, not the knowledge.",
  time_management: "The clock, not the subject, was the problem.",
};

export default async function MistakesPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const sp = await searchParams;
  const all = await db.select().from(insights).orderBy(desc(insights.lastSeenAt));
  const papers = await db
    .select({ id: attempts.id, title: attempts.title, subject: attempts.subject })
    .from(attempts)
    .where(and(eq(attempts.status, "graded"), isNull(attempts.deletedAt)));
  const titles = new Map(papers.map((p) => [p.id, p.title]));

  const subjects = [...new Set(all.map((r) => r.subject))].sort();
  const subject = sp.s && subjects.includes(sp.s) ? sp.s : null;
  const rows = (subject ? all.filter((r) => r.subject === subject) : all).filter((r) => r.type !== "strength");
  const active = rows.filter((r) => r.status === "active");
  const recurring = rows.filter((r) => r.occurrences > 1 && r.status === "active");

  const byType = INSIGHT_TYPES.filter((t) => t !== "strength").map((t) => ({
    type: t as InsightType,
    items: rows.filter((r) => r.type === t),
  }));

  return (
    <div className="pt-8 sm:pt-12">
      <p className="kicker">Mistakes log</p>
      <h1 className="display mt-3 max-w-3xl text-5xl sm:text-6xl">Every mistake, and why you made it.</h1>
      <p className="mt-4 max-w-2xl text-soft">
        Each entry names the question that exposed it, what went wrong, why it happened, and how to stop it happening.
        Anything seen more than once is a pattern, and patterns are what cost you marks in the boards.
      </p>

      {subjects.length > 0 && (
        <nav aria-label="Subjects" className="-mx-5 mt-8 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Link
            href="/mistakes"
            aria-current={subject === null ? "page" : undefined}
            className={`inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ink ${
              subject === null ? "bg-ink font-medium text-paper" : "border border-line bg-card text-soft hover:bg-wash"
            }`}
          >
            All subjects
          </Link>
          {subjects.map((s) => (
            <Link
              key={s}
              href={`/mistakes?s=${encodeURIComponent(s)}`}
              aria-current={subject === s ? "page" : undefined}
              className={`inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ink ${
                subject === s ? "bg-ink font-medium text-paper" : "border border-line bg-card text-soft hover:bg-wash"
              }`}
            >
              {s}
            </Link>
          ))}
        </nav>
      )}

      {rows.length === 0 ? (
        <div className="card mt-10 px-7 py-16 text-center">
          <h2 className="display text-4xl">No mistakes recorded yet.</h2>
          <p className="mx-auto mt-3 max-w-md text-soft">
            Sit a paper and have it marked. Every lost mark lands here with the question, the reason and the fix.
          </p>
          <Link href="/new" className="btn btn-primary mt-7">
            New paper
          </Link>
        </div>
      ) : (
        <>
          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
            {[
              ["Mistakes logged", String(rows.length)],
              ["Still active", String(active.length)],
              ["Seen more than once", String(recurring.length)],
              ["Marks at stake", recurring.length ? "high" : "low"],
            ].map(([label, value]) => (
              <div key={label} className="bg-card px-5 py-5">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="mt-1 font-serif text-[40px] leading-none">{value}</dd>
              </div>
            ))}
          </dl>

          {recurring.length > 0 && (
            <section className="mt-12">
              <h2 className="display text-4xl">Patterns: seen more than once</h2>
              <p className="mt-2 text-[15px] text-muted">
                These keep costing you. Fixing one of these is worth more than revising a whole chapter.
              </p>
              <ul className="mt-5 grid gap-4 lg:grid-cols-2">
                {recurring.map((r) => (
                  <MistakeCard key={r.id} r={r} titles={titles} />
                ))}
              </ul>
            </section>
          )}

          {byType.map(({ type, items }) => {
            if (items.length === 0) return null;
            const rest = items.filter((r) => !(r.occurrences > 1 && r.status === "active"));
            if (rest.length === 0) return null;
            return (
              <section key={type} className="mt-14">
                <div className="flex items-baseline gap-3">
                  <h2 className="display text-4xl">{INSIGHT_LABEL[type]}</h2>
                  <span className="font-mono text-sm text-muted">{items.length}</span>
                </div>
                <p className="mt-2 text-[15px] text-muted">{WHY[type]}</p>
                <ul className="mt-5 grid gap-4 lg:grid-cols-2">
                  {rest.map((r) => (
                    <MistakeCard key={r.id} r={r} titles={titles} />
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

function MistakeCard({ r, titles }: { r: Row; titles: Map<number, string> }) {
  const evidence = [...(r.evidence ?? [])].reverse().slice(0, 4);
  const questions = [...new Set(evidence.flatMap((e) => e.questions))];
  return (
    <li className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="kicker">
          {[r.subject, r.unit].filter(Boolean).join(" · ")}
        </p>
        {r.occurrences > 1 && (
          <span className="inline-flex h-6 items-center rounded-full bg-pen px-2.5 text-xs font-medium text-white">
            Seen {r.occurrences} times
          </span>
        )}
        {r.severity >= 3 && r.status === "active" && (
          <span className="inline-flex h-6 items-center rounded-full bg-pen-wash px-2.5 text-xs font-medium text-pen">
            Costly
          </span>
        )}
        {r.status === "improving" && (
          <span className="inline-flex h-6 items-center rounded-full bg-pass-wash px-2.5 text-xs font-medium text-pass">
            Got it right last time
          </span>
        )}
      </div>

      <h3 className="mt-2 text-lg leading-snug font-medium">
        <Rich text={r.title} />
      </h3>

      {questions.length > 0 && (
        <p className="mt-2 text-sm text-muted">
          Question{questions.length === 1 ? "" : "s"}: <span className="font-medium text-ink">{questions.join(", ")}</span>
        </p>
      )}

      {r.type === "formula" && (r.formulaCorrect || r.formulaWrote) && (
        <div className="mt-4 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          <div className="bg-pen-wash px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-pen uppercase">You wrote</p>
            <p className="mt-1 text-[17px] text-ink">
              <Rich text={r.formulaWrote || "Not recalled"} />
            </p>
          </div>
          <div className="bg-pass-wash px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-pass uppercase">Correct</p>
            <p className="mt-1 text-[17px] text-ink">
              <Rich text={r.formulaCorrect || "See the report"} />
            </p>
          </div>
        </div>
      )}

      {r.detail && (
        <div className="mt-4">
          <p className="kicker">Why you made it</p>
          <p className="mt-1 text-[15px] leading-relaxed text-soft">
            <Rich text={r.detail} />
          </p>
        </div>
      )}
      {r.fix && (
        <div className="mt-4 border-l-2 border-ink pl-4">
          <p className="kicker">How to stop it</p>
          <p className="mt-1 text-[15px] leading-relaxed">
            <Rich text={r.fix} />
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line pt-3">
        <p className="min-w-0 text-sm text-muted">
          {evidence.map((e, i) => (
            <span key={`${e.attemptId}-${i}`}>
              {i > 0 && " · "}
              <Link href={`/attempt/${e.attemptId}`} className="link text-soft">
                {titles.get(e.attemptId) ?? "Deleted paper"}
              </Link>
              {e.questions.length > 0 && ` Q ${e.questions.slice(0, 5).join(", ")}`}
            </span>
          ))}
          {evidence.length > 0 && " · "}
          last seen <LocalDate iso={r.lastSeenAt.toISOString()} />
        </p>
        <DismissInsight id={r.id} />
      </div>
    </li>
  );
}
