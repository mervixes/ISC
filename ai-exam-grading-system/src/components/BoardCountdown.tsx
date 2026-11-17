"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { dayKey, daysBetween, prettyDay } from "@/lib/dates";

export interface BoardEvent {
  id: number;
  day: string;
  title: string;
  subject: string;
}

/** Days until the next board date. Recomputed each minute so it stays correct across midnight. */
export default function BoardCountdown({ boards }: { boards: BoardEvent[] }) {
  const router = useRouter();
  const [today, setToday] = useState<string | null>(null);
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setToday(dayKey(new Date()));
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  if (!today) return <div className="card h-[280px] animate-pulse" aria-hidden="true" />;

  const upcoming = boards.filter((b) => b.day >= today).sort((a, b) => a.day.localeCompare(b.day));
  const next = upcoming[0];

  async function addBoard(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ day, kind: "board", title: "ISC board exam", subject: "" }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Could not save that date.");
        return;
      }
      setDay("");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!next) {
    return (
      <div className="card flex flex-col justify-between p-6 sm:p-8">
        <div>
          <p className="kicker">Board exams</p>
          <h2 className="display mt-3 text-4xl">No board date set.</h2>
          <p className="mt-3 text-soft">Add the first paper date and the countdown starts.</p>
        </div>
        <form onSubmit={addBoard} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            type="date"
            aria-label="Board exam date"
            className="input"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            required
          />
          <button className="btn btn-primary shrink-0" disabled={busy || !day}>
            {busy ? "Saving…" : "Set date"}
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-3 text-sm text-pen">
            {error}
          </p>
        )}
      </div>
    );
  }

  const left = daysBetween(today, next.day);
  const subjectNext = upcoming.find((b) => b.subject !== "" && b.id !== next.id);
  const list = upcoming.slice(0, 5);

  return (
    <div className="card flex flex-col p-6 sm:p-8">
      <p className="kicker">Board exams · countdown</p>
      <div className="mt-4 flex items-end gap-4">
        <p className="font-serif text-[88px] leading-[0.85] text-pen sm:text-[108px]">{left}</p>
        <p className="pb-2 text-lg text-soft">{left === 0 ? "today" : left === 1 ? "day to go" : "days to go"}</p>
      </div>
      <p className="mt-5 font-medium">{next.title}</p>
      <p className="text-sm text-muted">{prettyDay(next.day)}</p>
      {subjectNext && (
        <p className="mt-3 text-sm text-soft">
          Next subject paper: <span className="font-medium text-ink">{subjectNext.title}</span>, in{" "}
          {daysBetween(today, subjectNext.day)} days.
        </p>
      )}
      <ul className="mt-6 divide-y divide-line border-t border-line text-[15px]">
        {list.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0 truncate">{b.title}</span>
            <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{prettyDay(b.day)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
