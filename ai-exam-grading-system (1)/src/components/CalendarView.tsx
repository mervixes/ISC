"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { dayKey, daysBetween, prettyDay } from "@/lib/dates";
import { SUBJECTS } from "@/lib/isc";
import { EVENT_KINDS, EVENT_LABEL, type EventKind, type EventRow } from "@/lib/types";

export interface PaperDay {
  id: number;
  title: string;
  subject: string;
  /** ISO timestamp of when the paper was sat or created. */
  iso: string;
}

type Shown = EventKind | "paper";

interface Item {
  key: string;
  kind: Shown;
  label: string;
  subject: string;
  id: number;
  deletable: boolean;
  href?: string;
}

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DOT: Record<Shown, string> = {
  board: "bg-pen",
  mock: "bg-ink",
  revision: "bg-[#2f7f86]",
  custom: "bg-muted",
  paper: "bg-pass",
};
const BADGE: Record<Shown, string> = {
  board: "bg-pen-wash text-pen",
  mock: "bg-wash text-ink",
  revision: "bg-[#e2f0f1] text-[#2f6f75]",
  custom: "bg-wash text-soft",
  paper: "bg-pass-wash text-pass",
};
const LABEL: Record<Shown, string> = { ...EVENT_LABEL, paper: "Sat paper" };
const subjectName = (v: string) => SUBJECTS.find((s) => s.key === v)?.name ?? v;

export default function CalendarView({ events, papers }: { events: EventRow[]; papers: PaperDay[] }) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [cursor, setCursor] = useState<Date | null>(null);
  const [selected, setSelected] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ day: "", kind: "mock" as EventKind, title: "", subject: "" });

  useEffect(() => {
    const d = new Date();
    setNow(d);
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelected(dayKey(d));
    setForm((f) => ({ ...f, day: dayKey(d) }));
  }, []);

  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>();
    const push = (k: string, it: Item) => {
      const arr = m.get(k) ?? [];
      arr.push(it);
      m.set(k, arr);
    };
    for (const e of events) {
      push(e.day, {
        key: `e${e.id}`,
        kind: e.kind,
        label: e.title,
        subject: e.subject ? subjectName(e.subject) : "",
        id: e.id,
        deletable: true,
      });
    }
    for (const p of papers) {
      push(dayKey(new Date(p.iso)), {
        key: `p${p.id}`,
        kind: "paper",
        label: p.title,
        subject: p.subject,
        id: p.id,
        deletable: false,
        href: `/attempt/${p.id}`,
      });
    }
    return m;
  }, [events, papers]);

  if (!now || !cursor) return <div className="card h-[480px] animate-pulse" aria-hidden="true" />;

  const today = dayKey(now);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(dayKey(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);

  const upcoming = [...byDay.keys()].filter((k) => k >= today).sort();
  const comingUp = upcoming.flatMap((k) => (byDay.get(k) ?? []).map((it) => ({ k, it }))).slice(0, 8);
  const chosen = byDay.get(selected) ?? [];

  function pick(k: string) {
    setSelected(k);
    setForm((f) => ({ ...f, day: k }));
    setAdding(false);
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Could not save that.");
        return;
      }
      setSelected(form.day);
      setAdding(false);
      setForm((f) => ({ ...f, title: "", subject: "" }));
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    await fetch(`/api/events/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="card p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="font-serif text-3xl">
            {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
              className="grid h-9 w-9 place-items-center rounded-full border border-line text-lg hover:bg-wash"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => {
                setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
                pick(today);
              }}
              className="h-9 rounded-full border border-line px-3.5 text-sm hover:bg-wash"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              className="grid h-9 w-9 place-items-center rounded-full border border-line text-lg hover:bg-wash"
            >
              ›
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-1 text-center text-xs text-muted">
          {WEEK.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((k, i) =>
            k === null ? (
              <div key={`e${i}`} />
            ) : (
              <button
                key={k}
                type="button"
                onClick={() => pick(k)}
                aria-pressed={k === selected}
                aria-label={`${prettyDay(k)}${(byDay.get(k)?.length ?? 0) > 0 ? `, ${byDay.get(k)?.length} item(s)` : ""}`}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-ink ${
                  k === selected ? "bg-ink text-paper" : "hover:bg-wash"
                } ${k === today && k !== selected ? "ring-1 ring-ink" : ""}`}
              >
                <span>{Number(k.slice(8))}</span>
                <span className="mt-1 flex h-1.5 gap-0.5">
                  {(byDay.get(k) ?? []).slice(0, 3).map((it) => (
                    <span key={it.key} className={`h-1.5 w-1.5 rounded-full ${DOT[it.kind]}`} />
                  ))}
                </span>
              </button>
            ),
          )}
        </div>

        <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
          {(["board", "mock", "revision", "custom", "paper"] as const).map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${DOT[k]}`} aria-hidden="true" />
              {LABEL[k]}
            </li>
          ))}
        </ul>
      </div>

      <aside className="space-y-6">
        <div className="card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="kicker">Selected day</p>
              <p className="mt-1 font-medium">{selected ? prettyDay(selected) : ""}</p>
            </div>
            <button
              type="button"
              onClick={() => setAdding((a) => !a)}
              className="btn btn-ghost btn-sm"
              aria-expanded={adding}
            >
              {adding ? "Cancel" : "Add"}
            </button>
          </div>

          {adding && (
            <form onSubmit={create} className="mt-4 space-y-3 border-t border-line pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="ev-day" className="label">
                    Date
                  </label>
                  <input
                    id="ev-day"
                    type="date"
                    className="input"
                    value={form.day}
                    onChange={(e) => setForm({ ...form, day: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="ev-kind" className="label">
                    Type
                  </label>
                  <select
                    id="ev-kind"
                    className="input select"
                    value={form.kind}
                    onChange={(e) => setForm({ ...form, kind: e.target.value as EventKind })}
                  >
                    {EVENT_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {EVENT_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="ev-title" className="label">
                  What
                </label>
                <input
                  id="ev-title"
                  className="input"
                  value={form.title}
                  maxLength={140}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Physics mock, full three hours"
                  required
                />
              </div>
              <div>
                <label htmlFor="ev-subject" className="label">
                  Subject <span className="font-normal text-muted">(optional)</span>
                </label>
                <select
                  id="ev-subject"
                  className="input select"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                >
                  <option value="">None</option>
                  {SUBJECTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary btn-sm" disabled={busy}>
                {busy ? "Saving…" : "Save to calendar"}
              </button>
              {error && (
                <p role="alert" className="text-sm text-pen">
                  {error}
                </p>
              )}
            </form>
          )}

          <ul className="mt-4 space-y-2">
            {chosen.length === 0 && <li className="text-sm text-muted">Nothing scheduled.</li>}
            {chosen.map((it) => (
              <li
                key={it.key}
                className="flex items-start justify-between gap-3 rounded-xl bg-wash px-3.5 py-2.5 text-sm"
              >
                <span className="min-w-0">
                  <span
                    className={`mr-2 inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium ${BADGE[it.kind]}`}
                  >
                    {LABEL[it.kind]}
                  </span>
                  {it.href ? (
                    <a href={it.href} className="link">
                      {it.label}
                    </a>
                  ) : (
                    it.label
                  )}
                  {it.subject && <span className="block text-xs text-muted">{it.subject}</span>}
                </span>
                {it.deletable && (
                  <button
                    type="button"
                    onClick={() => remove(it.id)}
                    className="shrink-0 text-xs text-muted hover:text-pen"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5 sm:p-6">
          <p className="kicker">Coming up</p>
          <ul className="mt-3 divide-y divide-line">
            {comingUp.length === 0 && <li className="py-2 text-sm text-muted">Nothing ahead.</li>}
            {comingUp.map(({ k, it }) => (
              <li key={it.key} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate">{it.label}</span>
                <span className="shrink-0 font-mono text-xs text-muted tabular-nums">
                  {daysBetween(today, k) === 0 ? "today" : `${daysBetween(today, k)}d`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
