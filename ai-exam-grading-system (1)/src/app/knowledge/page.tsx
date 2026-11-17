import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { attempts, insights } from "@/db/schema";
import DismissInsight from "@/components/DismissInsight";
import LocalDate from "@/components/LocalDate";
import Rich from "@/components/Rich";
import { fmtMarks, pct } from "@/lib/format";
import { INSIGHT_LABEL, INSIGHT_TYPES, type InsightType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Knowledge map" };

type Row = typeof insights.$inferSelect;

const BLURB: Record<InsightType, string> = {
  formula: "Formulae, equations and standard results you wrote wrongly or could not recall.",
  concept_gap: "Ideas your answers show you do not understand yet.",
  silly_mistake: "Marks you threw away while knowing the method.",
  exam_technique: "Habits on the page that cost marks regardless of what you know.",
  time_management: "What the clock says about how you sit a paper.",
  strength: "Only what your scripts have proved. Nothing here is a compliment.",
};

const weight = (r: Row) => (r.status === "active" ? 100 : 0) + r.occurrences * 10 + r.severity;

function InsightCard({ r, titles, showSubject }: { r: Row; titles: Map<number, string>; showSubject: boolean }) {
  const strength = r.type === "strength";
  const evidence = [...(r.evidence ?? [])].reverse().slice(0, 4);
  return (
    <li className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="kicker">{[showSubject && r.subject, r.unit].filter(Boolean).join(" · ") || r.subject}</p>
        {!strength && r.occurrences > 1 && (
          <span className="inline-flex h-6 items-center rounded-full bg-pen px-2.5 text-xs font-medium text-white">
            Seen {r.occurrences} times
          </span>
        )}
        {strength && r.occurrences > 1 && (
          <span className="inline-flex h-6 items-center rounded-full bg-pass-wash px-2.5 text-xs font-medium text-pass">
            Shown {r.occurrences} times
          </span>
        )}
        {!strength && r.status === "improving" && (
          <span className="inline-flex h-6 items-center rounded-full bg-pass-wash px-2.5 text-xs font-medium text-pass">
            Got it right last time
          </span>
        )}
        {!strength && r.severity >= 3 && r.status === "active" && (
          <span className="inline-flex h-6 items-center rounded-full bg-pen-wash px-2.5 text-xs font-medium text-pen">
            Costly
          </span>
        )}
      </div>

      <h3 className="mt-2 text-lg leading-snug font-medium">
        <Rich text={r.title} />
      </h3>

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
        <p className="mt-3 text-[15px] leading-relaxed text-soft">
          <Rich text={r.detail} />
        </p>
      )}
      {r.fix && !strength && (
        <p className="mt-3 border-l-2 border-ink pl-4 text-[15px] leading-relaxed">
          <span className="font-medium">Fix: </span>
          <Rich text={r.fix} />
        </p>
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

export default async function Knowledge({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const sp = await searchParams;
  const all = await db.select().from(insights).orderBy(desc(insights.lastSeenAt));
  const papers = await db
    .select({ id: attempts.id, title: attempts.title, subject: attempts.subject, report: attempts.report })
    .from(attempts)
    .where(eq(attempts.status, "graded"));

  const titles = new Map(papers.map((p) => [p.id, p.title]));
  const subjects = [...new Set([...all.map((r) => r.subject), ...papers.map((p) => p.subject)])].sort();
  const subject = sp.subject && subjects.includes(sp.subject) ? sp.subject : null;

  const rows = subject ? all.filter((r) => r.subject === subject) : all;
  const scoped = subject ? papers.filter((p) => p.subject === subject) : papers;

  // Marks by unit across every marked paper in scope.
  const unitMap = new Map<string, { label: string; awarded: number; max: number; papers: Set<number> }>();
  for (const p of scoped) {
    for (const q of p.report?.questions ?? []) {
      if (!q.counted || q.maxMarks <= 0) continue;
      const key = `${p.subject}::${q.unit.toLowerCase()}`;
      const u = unitMap.get(key) ?? {
        label: subject ? q.unit : `${p.subject} · ${q.unit}`,
        awarded: 0,
        max: 0,
        papers: new Set<number>(),
      };
      u.awarded += q.awarded;
      u.max += q.maxMarks;
      u.papers.add(p.id);
      unitMap.set(key, u);
    }
  }
  const units = [...unitMap.values()]
    .map((u) => ({ ...u, p: pct(u.awarded, u.max) }))
    .sort((a, b) => a.p - b.p || b.max - a.max);

  const weaknesses = rows.filter((r) => r.type !== "strength");
  const priority = weaknesses
    .filter((r) => r.status === "active")
    .sort((a, b) => weight(b) - weight(a))
    .slice(0, 3);

  const tab = (label: string, href: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ink ${
        active ? "bg-ink font-medium text-paper" : "border border-line bg-card text-soft hover:bg-wash"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="pt-8 sm:pt-12">
      <p className="kicker">Knowledge map</p>
      <h1 className="display mt-3 max-w-3xl text-5xl sm:text-6xl">
        What you <span className="text-pen italic">don&rsquo;t</span> know yet.
      </h1>
      <p className="mt-4 max-w-xl text-soft">
        Every marked paper adds to this record. Anything that shows up twice is a pattern, and patterns are what cost
        you marks in the boards.
      </p>

      {subjects.length > 0 && (
        <nav aria-label="Subjects" className="-mx-5 mt-8 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {tab("All subjects", "/knowledge", subject === null)}
          {subjects.map((s) => tab(s, `/knowledge?subject=${encodeURIComponent(s)}`, subject === s))}
        </nav>
      )}

      {rows.length === 0 && units.length === 0 ? (
        <div className="card mt-10 px-7 py-16 text-center">
          <h2 className="display text-4xl">Nothing recorded yet.</h2>
          <p className="mx-auto mt-3 max-w-md text-soft">
            Sit a paper and have it marked. Your wrong formulae, concept gaps and careless habits will be listed here,
            with the questions that exposed them.
          </p>
          <Link href="/new" className="btn btn-primary mt-7">
            New paper
          </Link>
        </div>
      ) : (
        <>
          {priority.length > 0 && (
            <section className="mt-12">
              <h2 className="display text-4xl">Fix these first</h2>
              <ol className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-3">
                {priority.map((r, i) => (
                  <li key={r.id} className="bg-card p-6">
                    <span className="font-serif text-5xl leading-none text-pen">{i + 1}</span>
                    <p className="kicker mt-3">{[!subject && r.subject, r.unit].filter(Boolean).join(" · ") || r.subject}</p>
                    <p className="mt-1.5 font-medium">
                      <Rich text={r.title} />
                    </p>
                    {r.fix && (
                      <p className="mt-2 text-[15px] text-soft">
                        <Rich text={r.fix} />
                      </p>
                    )}
                    {r.occurrences > 1 && <p className="mt-3 text-sm font-medium text-pen">Seen {r.occurrences} times</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {units.length > 0 && (
            <section className="mt-14">
              <h2 className="display text-4xl">Marks by unit, weakest first</h2>
              <p className="mt-2 text-[15px] text-muted">Across every marked paper{subject ? ` in ${subject}` : ""}.</p>
              <ul className="mt-5 divide-y divide-line border-y border-line">
                {units.map((u) => (
                  <li
                    key={u.label}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 py-3.5 sm:grid-cols-[1fr_200px_110px]"
                  >
                    <span className="min-w-0 truncate">{u.label}</span>
                    <span className="order-3 col-span-2 h-2 overflow-hidden rounded-full bg-line sm:order-none sm:col-span-1" aria-hidden="true">
                      <span
                        className={`block h-full rounded-full ${u.p >= 80 ? "bg-pass" : u.p < 50 ? "bg-pen" : "bg-ink"}`}
                        style={{ width: `${u.p}%` }}
                      />
                    </span>
                    <span className="text-right text-sm tabular-nums">
                      {fmtMarks(u.awarded)} / {fmtMarks(u.max)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {INSIGHT_TYPES.map((type) => {
            const list = rows.filter((r) => r.type === type).sort((a, b) => weight(b) - weight(a));
            if (list.length === 0) return null;
            return (
              <section key={type} className="mt-14">
                <div className="flex items-baseline gap-3">
                  <h2 className="display text-4xl">{INSIGHT_LABEL[type]}</h2>
                  <span className="font-mono text-sm text-muted">{list.length}</span>
                </div>
                <p className="mt-2 text-[15px] text-muted">{BLURB[type]}</p>
                <ul className="mt-5 grid gap-4 lg:grid-cols-2">
                  {list.map((r) => (
                    <InsightCard key={r.id} r={r} titles={titles} showSubject={!subject} />
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
