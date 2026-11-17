"use client";

import { useMemo, useState, type ReactNode } from "react";
import Rich from "./Rich";
import { KIND_META, KIND_ORDER, type VaultItem, type VaultKind } from "@/lib/vault/types";

const SUBJECTS = ["All", "Physics", "Chemistry", "Maths", "Literature"] as const;
type SubjectFilter = (typeof SUBJECTS)[number];
/** Kinds ranked by importance as one list, rather than grouped by chapter. */
const RANKED: VaultKind[] = ["derivation", "mechanism"];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function plain(i: VaultItem): string {
  return [
    i.title,
    i.chapter,
    i.when,
    i.math,
    i.conditions,
    i.reagents,
    i.observation,
    i.note,
    i.example?.q,
    i.example?.a,
    i.quote,
    i.speaker,
    i.source,
    i.context,
    ...(i.steps ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/[\\${}^_]/g, " ")
    .toLowerCase();
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1" role="img" aria-label={`Importance ${n} of 3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`h-1.5 w-4 rounded-full ${i <= n ? "bg-pen" : "bg-line"}`} />
      ))}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="kicker">{label}</dt>
      <dd className="mt-1 text-[15px] leading-relaxed text-soft">{children}</dd>
    </div>
  );
}

function Card({ item, rank }: { item: VaultItem; rank?: number }) {
  const open = item.kind === "derivation" || item.kind === "mechanism";
  const stepsLabel =
    item.kind === "derivation" ? "Derivation steps" : item.kind === "mechanism" ? "Mechanism steps" : "Steps";
  return (
    <article id={item.id} className="card scroll-mt-6 p-5 sm:p-6">
      <div className="flex items-start gap-4">
        {rank !== undefined && (
          <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink font-mono text-xs text-paper">
            {rank}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="kicker">
              {item.subject} · {item.chapter}
            </p>
            <Stars n={item.importance} />
          </div>
          {item.title && (
            <h3 className="mt-1.5 text-xl leading-snug font-medium">
              <Rich text={item.title} />
            </h3>
          )}
        </div>
      </div>

      {item.quote && (
        <div className="mt-4 border-l-2 border-ink pl-4">
          <blockquote className="font-serif text-[21px] leading-snug italic">
            <Rich text={item.quote} />
          </blockquote>
          {item.speaker && (
            <p className="mt-1.5 text-sm text-muted">
              — <span className="font-medium text-soft">{item.speaker}</span>
              {item.source ? `, ${item.source}` : ""}
            </p>
          )}
          {item.verified === false && (
            <p className="mt-2 inline-flex items-center rounded-full bg-warn-wash px-2.5 py-0.5 text-xs font-medium text-warn">
              Check the wording in your copy
            </p>
          )}
        </div>
      )}

      {item.math && (
        <div className="mt-4 overflow-x-auto rounded-xl bg-wash px-4 py-3 text-center">
          <Rich text={`$$${item.math}$$`} />
        </div>
      )}

      <dl className="mt-4 space-y-3">
        {item.reagents && (
          <Field label="Reagent">
            <Rich text={item.reagents} />
          </Field>
        )}
        {item.conditions && (
          <Field label={item.kind === "test" ? "Procedure" : "Conditions"}>
            <Rich text={item.conditions} />
          </Field>
        )}
        {item.observation && (
          <Field label="Positive result">
            <Rich text={item.observation} />
          </Field>
        )}
        {item.context && (
          <Field label="Where it sits">
            <Rich text={item.context} />
          </Field>
        )}
        {item.when && (
          <Field label="When to use">
            <Rich text={item.when} />
          </Field>
        )}
      </dl>

      {item.steps && item.steps.length > 0 && (
        <details className="group mt-4" open={open}>
          <summary className="cursor-pointer text-sm font-medium text-muted hover:text-ink">{stepsLabel}</summary>
          <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-[15px] leading-relaxed text-soft marker:text-muted">
            {item.steps.map((s, i) => (
              <li key={i}>
                <Rich text={s} />
              </li>
            ))}
          </ol>
        </details>
      )}

      {item.example && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-muted hover:text-ink">Worked example</summary>
          <div className="mt-3 space-y-2 rounded-xl border border-line px-4 py-3 text-[15px]">
            <p>
              <span className="font-medium">Q.</span> <Rich text={item.example.q} />
            </p>
            {item.example.work?.map((w, i) => (
              <p key={i} className="pl-4 text-soft">
                <Rich text={w} />
              </p>
            ))}
            <p>
              <span className="font-medium">Answer.</span> <Rich text={item.example.a} />
            </p>
          </div>
        </details>
      )}

      {item.note && (
        <p className="mt-4 border-l-2 border-pen pl-3 text-[15px] text-soft">
          <span className="font-medium text-pen">Trap. </span>
          <Rich text={item.note} />
        </p>
      )}
    </article>
  );
}

export default function VaultBrowser({ items }: { items: VaultItem[] }) {
  const [kind, setKind] = useState<VaultKind>("formula");
  const [subject, setSubject] = useState<SubjectFilter>("All");
  const [query, setQuery] = useState("");

  const inSubject = useMemo(
    () => items.filter((i) => subject === "All" || i.subject === subject),
    [items, subject],
  );

  const counts = useMemo(() => {
    const out = {} as Record<VaultKind, number>;
    for (const k of KIND_ORDER) out[k] = inSubject.filter((i) => i.kind === k).length;
    return out;
  }, [inSubject]);

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return inSubject.filter((i) => i.kind === kind && (!needle || plain(i).includes(needle)));
  }, [inSubject, kind, query]);

  const ranked = RANKED.includes(kind);

  const ordered = useMemo(() => [...list].sort((a, b) => b.importance - a.importance), [list]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, VaultItem[]>();
    for (const i of list) {
      if (!map.has(i.chapter)) {
        map.set(i.chapter, []);
        order.push(i.chapter);
      }
      map.get(i.chapter)?.push(i);
    }
    return order.map((chapter) => ({
      chapter,
      items: [...(map.get(chapter) ?? [])].sort((a, b) => b.importance - a.importance),
    }));
  }, [list]);

  return (
    <div>
      <div role="tablist" aria-label="Vault section" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {KIND_ORDER.map((k) => {
          const on = kind === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setKind(k)}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ink ${
                on ? "bg-ink font-medium text-paper" : "border border-line bg-card text-soft hover:bg-wash"
              }`}
            >
              {KIND_META[k].label}
              <span className={`font-mono text-xs ${on ? "text-paper/70" : "text-muted"}`}>{counts[k]}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 max-w-2xl text-[15px] text-muted">
        {KIND_META[kind].blurb}
        {ranked ? " Ranked by importance." : ""}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Subject" className="flex gap-1 rounded-full border border-line bg-card p-1">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={subject === s}
              onClick={() => setSubject(s)}
              className={`h-8 rounded-full px-3.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ink ${
                subject === s ? "bg-ink font-medium text-paper" : "text-muted hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <label className="min-w-[220px] flex-1">
          <span className="sr-only">Search the vault</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a formula, reagent, chapter…"
            className="input"
          />
        </label>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          {ranked ? (
            <p className="text-sm text-muted">Sorted by importance. Three stars means asked almost every year.</p>
          ) : (
            <nav aria-label="Chapters">
              <p className="kicker mb-3">Chapters</p>
              <ul className="space-y-0.5 text-[15px]">
                {groups.map((g) => (
                  <li key={g.chapter}>
                    <a
                      href={`#ch-${slug(g.chapter)}`}
                      className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-soft hover:bg-wash hover:text-ink"
                    >
                      <span className="truncate">{g.chapter}</span>
                      <span className="font-mono text-xs text-muted">{g.items.length}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </aside>

        <div className="min-w-0">
          {list.length === 0 ? (
            <p className="card px-6 py-12 text-center text-muted">Nothing matches. Try another subject or clear the search.</p>
          ) : ranked ? (
            <ol className="space-y-4">
              {ordered.map((i, idx) => (
                <li key={i.id}>
                  <Card item={i} rank={idx + 1} />
                </li>
              ))}
            </ol>
          ) : (
            <div className="space-y-12">
              {groups.map((g) => (
                <section key={g.chapter} id={`ch-${slug(g.chapter)}`} className="scroll-mt-6">
                  <h2 className="display text-3xl">{g.chapter}</h2>
                  <div className="mt-4 space-y-4">
                    {g.items.map((i) => (
                      <Card key={i.id} item={i} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
