"use client";

import { useEffect, useState } from "react";
import PaperViewer from "./PaperViewer";
import { fmtClock, fmtDuration } from "@/lib/format";
import type { AttemptDTO } from "@/lib/types";

function useNow(active: boolean): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

interface Props {
  a: AttemptDTO;
  /** server clock minus this device's clock, in ms */
  skew: number;
  busy: string | null;
  act: (action: string) => void;
}

export default function ExamStage({ a, skew, busy, act }: Props) {
  const paused = !!a.pausedAt;
  const now = useNow(!paused);
  const [confirming, setConfirming] = useState(false);

  const start = a.startedAt ? Date.parse(a.startedAt) : 0;
  const end = paused && a.pausedAt ? Date.parse(a.pausedAt) : now != null ? now + skew : null;
  const elapsed = end != null ? Math.max(0, end - start - a.pausedMs) : null;
  const allowed = a.timeAllowedMin * 60000;
  const remaining = elapsed != null ? allowed - elapsed : null;
  const over = remaining != null && remaining < 0;
  const low = remaining != null && remaining >= 0 && remaining <= 15 * 60000;
  const fraction = elapsed != null ? Math.min(1, elapsed / allowed) : 0;

  const clock = elapsed != null ? fmtClock(elapsed) : "–:––:––";
  useEffect(() => {
    const prev = document.title;
    document.title = `${paused ? "Paused " : ""}${clock} · ${a.title}`;
    return () => {
      document.title = prev;
    };
  }, [clock, paused, a.title]);

  const paper = a.files.filter((f) => f.kind === "paper");

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-5 border-b border-line bg-paper/92 px-5 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
          <div className="min-w-0">
            <p className="hidden truncate text-sm text-muted sm:block">
              {a.subject} · {a.title}
            </p>
            <div className="flex items-baseline gap-3">
              <p
                role="timer"
                aria-label="Time elapsed"
                className={`font-mono text-[40px] leading-none font-medium tabular-nums sm:text-5xl ${
                  over ? "text-pen" : ""
                }`}
              >
                {clock}
              </p>
              <p className={`text-sm tabular-nums ${over ? "font-medium text-pen" : low ? "font-medium text-warn" : "text-muted"}`}>
                {remaining == null
                  ? ""
                  : paused
                    ? "Paused"
                    : over
                      ? `${fmtClock(-remaining)} over time`
                      : `${fmtClock(remaining)} left`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {confirming ? (
              <>
                <span className="mr-1 hidden text-sm text-soft sm:inline">Stop the clock for good?</span>
                <button className="btn btn-pen btn-sm" disabled={busy !== null} onClick={() => act("finish")}>
                  {busy === "finish" ? "Finishing…" : "Yes, I'm done"}
                </button>
                <button className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => setConfirming(false)}>
                  Keep writing
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy !== null}
                  onClick={() => act(paused ? "resume" : "pause")}
                >
                  {paused ? "Resume" : "Pause"}
                </button>
                <button className="btn btn-primary btn-sm" disabled={busy !== null} onClick={() => setConfirming(true)}>
                  Finish
                </button>
              </>
            )}
          </div>
        </div>
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label="Time used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fraction * 100)}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${over ? "bg-pen" : low ? "bg-warn" : "bg-ink"}`}
            style={{ width: `${fraction * 100}%` }}
          />
        </div>
      </div>

      <div className="pt-6">
        {paused ? (
          <div className="card flex flex-col items-center px-6 py-20 text-center">
            <h2 className="display text-4xl">Clock stopped.</h2>
            <p className="mt-3 max-w-sm text-soft">
              The paper is hidden while you are paused. The board does not pause, so use this sparingly.
            </p>
            <button className="btn btn-primary mt-7" disabled={busy !== null} onClick={() => act("resume")}>
              Resume
            </button>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">
              {fmtDuration(allowed)} allowed. Write on paper. Press Finish the moment you put your pen down.
            </p>
            <PaperViewer files={paper} />
          </>
        )}
      </div>
    </div>
  );
}
