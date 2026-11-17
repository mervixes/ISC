"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Rich from "./Rich";
import type { StudyPick, StudyPlan, StudyStats } from "@/lib/study-types";

const keyOf = (p: StudyPick) => `${p.subject}::${p.chapter}`;

/**
 * Keeps unchanged cards in their slots, so clicking Done on card 2 replaces card 2 and the other
 * two stay exactly where they were.
 */
function mergeStable(prev: StudyPick[], next: StudyPick[]): StudyPick[] {
  const byKey = new Map(next.map((n) => [keyOf(n), n]));
  const kept = prev.map((p) => byKey.get(keyOf(p)) ?? null);
  const used = new Set(kept.filter((k): k is StudyPick => k !== null).map(keyOf));
  const incoming = next.filter((n) => !used.has(keyOf(n)));
  const out: StudyPick[] = [];
  for (const k of kept) {
    if (k) out.push(k);
    else {
      const n = incoming.shift();
      if (n) out.push(n);
    }
  }
  while (out.length < Math.min(3, next.length) && incoming.length) out.push(incoming.shift() as StudyPick);
  return out.slice(0, 3);
}

interface Toast {
  id: number;
  text: string;
}

export default function StudyNow({ initial }: { initial: StudyPlan }) {
  const [picks, setPicks] = useState<StudyPick[]>(initial.picks);
  const [stats, setStats] = useState<StudyStats>(initial.stats);
  const [busy, setBusy] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 10_000);
    return () => clearTimeout(t);
  }, [toast]);

  function apply(next: StudyPlan) {
    const merged = mergeStable(picks, next.picks);
    const before = new Set(picks.map(keyOf));
    setFresh(new Set(merged.filter((m) => !before.has(keyOf(m))).map(keyOf)));
    setPicks(merged);
    setStats(next.stats);
  }

  async function act(p: StudyPick, action: "done" | "skip") {
    setBusy(keyOf(p));
    setError(null);
    try {
      const res = await fetch("/api/study", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, subject: p.subject, chapter: p.chapter }),
      });
      const j = (await res.json().catch(() => null)) as (StudyPlan & { logId?: number; error?: string }) | null;
      if (!res.ok || !j) throw new Error(j?.error ?? "That did not save. Try again.");
      apply(j);
      if (j.logId) {
        setToast({
          id: j.logId,
          text: action === "done" ? `${p.chapter} marked done.` : `${p.chapter} hidden for two days.`,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not save. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function undo() {
    if (!toast) return;
    const id = toast.id;
    setToast(null);
    setBusy("undo");
    try {
      const res = await fetch("/api/study", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "undo", id }),
      });
      const j = (await res.json().catch(() => null)) as StudyPlan | null;
      if (!res.ok || !j) throw new Error("Could not undo that.");
      apply(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not undo that.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-12" aria-labelledby="study-now-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker">Study plan</p>
          <h2 id="study-now-heading" className="display mt-2 text-4xl sm:text-5xl">
            Study this chapter right now
          </h2>
        </div>
        <p className="text-sm text-muted tabular-nums">
          Done today <span className="font-medium text-ink">{stats.today}</span> · this week{" "}
          <span className="font-medium text-ink">{stats.week}</span> · all time{" "}
          <span className="font-medium text-ink">{stats.total}</span>
        </p>
      </div>

      {picks.length === 0 ? (
        <div className="card mt-6 px-6 py-12 text-center">
          <p className="text-soft">
            Nothing to study right now. Every chapter is resting after you finished it, or your board papers are behind
            you.
          </p>
        </div>
      ) : (
        <ol className="mt-6 grid gap-4 lg:grid-cols-3">
          {picks.map((p, i) => {
            const k = keyOf(p);
            const practiceHref =
              p.practiceCount > 0
                ? `/practice?subject=${encodeURIComponent(p.subject)}&chapter=${encodeURIComponent(p.chapter)}`
                : `/types?s=${encodeURIComponent(p.subject)}&c=${encodeURIComponent(p.chapter)}`;
            return (
              <li key={k} className={`card flex flex-col p-5 sm:p-6 ${fresh.has(k) ? "animate-rise" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="font-serif text-4xl leading-none text-pen" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {p.returning && (
                      <span className="inline-flex h-6 items-center rounded-full bg-pen px-2.5 text-xs font-medium text-white">
                        Back again
                      </span>
                    )}
                    {p.daysToBoard !== null && (
                      <span
                        className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${
                          p.daysToBoard <= 21 ? "bg-pen-wash text-pen" : "bg-wash text-soft"
                        }`}
                      >
                        Board in {p.daysToBoard === 0 ? "today" : `${p.daysToBoard}d`}
                      </span>
                    )}
                  </div>
                </div>

                <p className="kicker mt-4">{p.subject}</p>
                <h3 className="mt-1 text-xl leading-snug font-medium">
                  <Link
                    href={`/types?s=${encodeURIComponent(p.subject)}&c=${encodeURIComponent(p.chapter)}`}
                    className="hover:underline"
                  >
                    {p.chapter}
                  </Link>
                </h3>
                <p className="mt-2 text-sm font-medium">{p.headline}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-soft">
                  <Rich text={p.why} />
                </p>

                {p.startWith.length > 0 && (
                  <div className="mt-4">
                    <p className="kicker">Start with</p>
                    <ul className="mt-1.5 space-y-1.5 text-sm text-soft">
                      {p.startWith.map((t) => (
                        <li key={t.type} className="flex gap-2">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
                          <span>
                            {t.type} <span className="text-muted">· {t.marks} marks</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                  <button
                    type="button"
                    onClick={() => void act(p, "done")}
                    disabled={busy !== null}
                    className="btn btn-primary btn-sm"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                      <path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {busy === k ? "Saving…" : "Done"}
                  </button>
                  <Link href={practiceHref} className="btn btn-ghost btn-sm">
                    {p.practiceCount > 0 ? `Practise (${p.practiceCount})` : "Practise a type"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void act(p, "skip")}
                    disabled={busy !== null}
                    className="rounded px-1 text-sm text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-50"
                  >
                    Not today
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {toast && (
        <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-wash px-4 py-3 text-[15px]">
          <span>{toast.text} The next chapter has taken its place.</span>
          <button type="button" onClick={() => void undo()} className="font-medium underline underline-offset-4">
            Undo
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-pen-wash px-4 py-3 text-[15px] text-pen">
          {error}
        </p>
      )}

      <p className="mt-4 text-sm text-muted">
        Ranked by marks at stake, how you have actually scored, open mistakes and days to the board. Done rests a chapter
        for a week, longer each time you finish it, and brings it back early if a new paper still loses marks there.
      </p>
    </section>
  );
}
