"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ExamStage from "./ExamStage";
import FilePicker from "./FilePicker";
import PaperViewer from "./PaperViewer";
import ReportView from "./ReportView";
import { uploadFile } from "@/lib/client-upload";
import { fmtClock, fmtDuration } from "@/lib/format";
import type { AttemptDTO } from "@/lib/types";

const OFFLINE = "Could not reach the server. Check your connection and try again.";

export default function AttemptView({ initial }: { initial: AttemptDTO }) {
  const router = useRouter();
  const [a, setA] = useState(initial);
  const [skew, setSkew] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const id = initial.id;

  const apply = useCallback((next: AttemptDTO) => {
    setSkew(Date.parse(next.serverNow) - Date.now());
    setA(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/attempts/${id}`, { cache: "no-store" });
      if (res.ok) apply((await res.json()) as AttemptDTO);
    } catch {
      /* keep showing what we have; the next poll or action will retry */
    }
  }, [id, apply]);

  // Sync once on mount so the timer is measured against the server's clock.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (a.status !== "grading") return;
    const t = setInterval(() => void refresh(), 2500);
    return () => clearInterval(t);
  }, [a.status, refresh]);

  async function call(label: string, url: string, init: RequestInit): Promise<boolean> {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(url, init);
      const j = (await res.json().catch(() => null)) as (AttemptDTO & { error?: string }) | null;
      if (!res.ok || !j) {
        setError(j?.error ?? "Something went wrong. Try again.");
        return false;
      }
      if (typeof j.id === "number") apply(j);
      return true;
    } catch {
      setError(OFFLINE);
      return false;
    } finally {
      setBusy(null);
    }
  }

  const act = (action: string, extra: Record<string, unknown> = {}) =>
    void call(action, `/api/attempts/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });

  const grade = () => void call("grade", `/api/attempts/${id}/grade`, { method: "POST" });

  async function destroy() {
    setBusy("delete");
    try {
      const res = await fetch(`/api/attempts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not move this paper to the bin. Try again.");
      setBusy(null);
    }
  }

  const errorBox = error && (
    <p role="alert" className="mt-6 rounded-xl bg-pen-wash px-4 py-3 text-[15px] text-pen">
      {error}
    </p>
  );

  if (a.status === "in_progress") {
    return (
      <>
        <ExamStage a={a} skew={skew} busy={busy} act={act} />
        {errorBox}
      </>
    );
  }

  const paper = a.files.filter((f) => f.kind === "paper");
  const answers = a.files.filter((f) => f.kind === "answer");
  const allowed = a.timeAllowedMin * 60000;

  return (
    <div className="pt-8 sm:pt-12">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← Papers
      </Link>
      <p className="kicker mt-5">{a.subject}</p>
      <h1 className="display mt-2 text-4xl sm:text-5xl">{a.title}</h1>

      {a.status === "ready" && (
        <ReadyStage a={a} busy={busy} act={act} paperCount={paper.length} allowed={allowed} />
      )}

      {a.status === "finished" && (
        <SubmitStage a={a} busy={busy} grade={grade} refresh={refresh} setError={setError} allowed={allowed} />
      )}

      {a.status === "grading" && <GradingStage a={a} />}

      {a.status === "graded" && a.report && (
        <>
          {a.error && (
            <p role="alert" className="mt-6 rounded-xl bg-pen-wash px-4 py-3 text-[15px] text-pen">
              Re-marking failed, so the previous report is shown. {a.error}
            </p>
          )}
          <ReportView a={a} />
        </>
      )}

      {errorBox}

      {a.status !== "grading" && (
        <section className="mt-14 border-t border-line pt-8">
          {a.status !== "ready" && (
            <div className="space-y-3">
              <details className="group">
                <summary className="cursor-pointer text-[15px] font-medium text-soft hover:text-ink">
                  Question paper ({paper.length} file{paper.length === 1 ? "" : "s"})
                </summary>
                <div className="mt-4">
                  <PaperViewer files={paper} />
                </div>
              </details>
              {a.status === "graded" && (
                <details>
                  <summary className="cursor-pointer text-[15px] font-medium text-soft hover:text-ink">
                    Your answer script ({answers.length} page{answers.length === 1 ? "" : "s"})
                  </summary>
                  <div className="mt-4">
                    <PaperViewer files={answers} />
                  </div>
                </details>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {a.status === "graded" && (
              <button className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={grade}>
                {busy === "grade" ? "Starting…" : "Mark it again"}
              </button>
            )}
            {confirmDelete ? (
              <>
                <span className="text-sm text-soft">
                  Move this paper to the recycle bin? Its question paper stays in your practice bank and its report is
                  kept, so you can restore it intact.
                </span>
                <button className="btn btn-pen btn-sm" disabled={busy !== null} onClick={destroy}>
                  {busy === "delete" ? "Moving…" : "Move to bin"}
                </button>
                <button className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => setConfirmDelete(false)}>
                  Keep it
                </button>
              </>
            ) : (
              <button
                className="btn btn-sm text-muted hover:text-pen"
                disabled={busy !== null}
                onClick={() => setConfirmDelete(true)}
              >
                Move to recycle bin
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ReadyStage({
  a,
  busy,
  act,
  paperCount,
  allowed,
}: {
  a: AttemptDTO;
  busy: string | null;
  act: (action: string, extra?: Record<string, unknown>) => void;
  paperCount: number;
  allowed: number;
}) {
  const [minutes, setMinutes] = useState("");
  return (
    <>
      <section className="card mt-10 p-7 sm:p-10">
        <h2 className="display text-4xl sm:text-5xl">Ready when you are.</h2>
        <p className="mt-4 max-w-xl text-soft">
          The paper appears and the clock starts the moment you press the button. Have your answer sheets, pen and
          instruments on the desk first.
        </p>
        <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
          <div>
            <dt className="text-sm text-muted">Time allowed</dt>
            <dd className="font-serif text-3xl">{fmtDuration(allowed)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Maximum marks</dt>
            <dd className="font-serif text-3xl">{a.totalMarks ?? "From paper"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Paper</dt>
            <dd className="font-serif text-3xl">
              {paperCount} file{paperCount === 1 ? "" : "s"}
            </dd>
          </div>
        </dl>
        <button className="btn btn-pen btn-lg mt-9" disabled={busy !== null} onClick={() => act("start")}>
          {busy === "start" ? "Starting…" : "Start the clock"}
        </button>
      </section>

      <details className="mt-6">
        <summary className="cursor-pointer text-[15px] text-muted hover:text-ink">
          Already wrote this paper? Enter your time instead
        </summary>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            act("manual", { minutes: Number(minutes) });
          }}
        >
          <div>
            <label htmlFor="manual-min" className="label">
              Minutes you took
            </label>
            <input
              id="manual-min"
              className="input w-40"
              type="number"
              inputMode="numeric"
              min={1}
              max={900}
              required
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="e.g. 165"
            />
          </div>
          <button className="btn btn-ghost" disabled={busy !== null || !minutes}>
            Skip the timer
          </button>
        </form>
      </details>
    </>
  );
}

/* ------------------------------------------------------------------ */

function SubmitStage({
  a,
  busy,
  grade,
  refresh,
  setError,
  allowed,
}: {
  a: AttemptDTO;
  busy: string | null;
  grade: () => void;
  refresh: () => Promise<void>;
  setError: (e: string | null) => void;
  allowed: number;
}) {
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const answers = a.files.filter((f) => f.kind === "answer");
  const taken = a.timeTakenMs ?? 0;
  const diff = allowed - taken;

  async function add(list: File[]) {
    setError(null);
    const failures: string[] = [];
    setUploading({ done: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      try {
        await uploadFile(a.id, "answer", list[i]);
      } catch (e) {
        failures.push(e instanceof Error ? e.message : `Upload of "${list[i].name}" failed.`);
      }
      setUploading({ done: i + 1, total: list.length });
    }
    await refresh();
    setUploading(null);
    if (failures.length) setError(failures.join(" "));
  }

  async function remove(fileId: number) {
    setRemoving(fileId);
    try {
      const res = await fetch(`/api/files/${fileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await refresh();
    } catch {
      setError("Could not remove that page. Try again.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <>
      <section className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
        <div className="bg-card px-6 py-6">
          <p className="text-sm text-muted">Time taken</p>
          <p className="mt-1 font-serif text-5xl leading-none">{fmtDuration(taken)}</p>
        </div>
        <div className="bg-card px-6 py-6">
          <p className="text-sm text-muted">Allowed</p>
          <p className="mt-1 font-serif text-5xl leading-none">{fmtDuration(allowed)}</p>
        </div>
        <div className="bg-card px-6 py-6">
          <p className="text-sm text-muted">{diff >= 0 ? "Finished early by" : "Over time by"}</p>
          <p className={`mt-1 font-serif text-5xl leading-none ${diff >= 0 ? "" : "text-pen"}`}>
            {fmtDuration(Math.abs(diff))}
          </p>
        </div>
      </section>

      {a.error && (
        <div role="alert" className="mt-6 rounded-xl bg-pen-wash px-4 py-3 text-[15px] text-pen">
          <p className="font-medium">Marking did not finish.</p>
          <p className="mt-0.5">{a.error}</p>
        </div>
      )}

      <section className="mt-12">
        <h2 className="display text-4xl">Now show your work.</h2>
        <p className="mt-3 max-w-xl text-soft">
          Photograph every page you wrote, in order, straight-on and in good light. Anything the examiner cannot read
          earns nothing, exactly as in the hall.
        </p>

        <div className="mt-6">
          <FilePicker
            accept="image/*"
            title={uploading ? `Uploading ${uploading.done} of ${uploading.total}…` : "Add photos of your answers"}
            hint="JPG or PNG. Select several at once in page order, or drag them here."
            disabled={uploading !== null || busy !== null}
            onFiles={add}
          />
        </div>

        {answers.length > 0 && (
          <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {answers.map((f, i) => (
              <li key={f.id} className="relative">
                <a
                  href={`/api/files/${f.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-xl border border-line bg-card focus-visible:outline-2 focus-visible:outline-ink"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/files/${f.id}`}
                    alt={`Answer page ${i + 1}`}
                    loading="lazy"
                    className="aspect-[3/4] w-full object-cover"
                  />
                </a>
                <span className="absolute top-2 left-2 rounded-full bg-ink px-2 py-0.5 font-mono text-xs text-paper">
                  {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  disabled={removing !== null || uploading !== null}
                  aria-label={`Remove answer page ${i + 1}`}
                  className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-card text-ink shadow-sm ring-1 ring-line hover:bg-pen hover:text-white focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-50"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        {!a.hasKey && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warn/30 bg-warn-wash px-5 py-4">
            <p className="text-[15px] text-warn">Marking needs an AI key. Your paper and photos are saved meanwhile.</p>
            <Link href="/keys" className="btn btn-ghost btn-sm">
              Add your key
            </Link>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            className="btn btn-pen btn-lg"
            disabled={answers.length === 0 || uploading !== null || busy !== null || !a.hasKey}
            onClick={grade}
          >
            {busy === "grade" ? "Handing it in…" : a.error ? "Try marking again" : "Mark my paper"}
          </button>
          <p className="text-sm text-muted">
            {answers.length === 0
              ? "Add at least one page."
              : `${answers.length} page${answers.length === 1 ? "" : "s"} ready. Marking takes one to four minutes.`}
          </p>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */

function GradingStage({ a }: { a: AttemptDTO }) {
  const [t0] = useState(() => Date.now());
  const [now, setNow] = useState(t0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const stage = a.progress?.stage ?? "reading";
  const steps: [string, string][] = [
    ["reading", "Reading your script against the paper"],
    ["writing", "Awarding marks and writing the report"],
    ["saving", "Updating your knowledge map"],
  ];
  const current = steps.findIndex(([k]) => k === stage);

  return (
    <section className="card mt-10 px-7 py-14 sm:px-10" aria-live="polite">
      <div className="flex items-center gap-4">
        <span
          className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-line border-t-pen"
          aria-hidden="true"
        />
        <h2 className="display text-4xl sm:text-5xl">The examiner has your script.</h2>
      </div>
      <ol className="mt-8 space-y-3">
        {steps.map(([key, label], i) => (
          <li key={key} className="flex items-center gap-3 text-[15px]">
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-medium ${
                i < current ? "bg-pass text-white" : i === current ? "bg-ink text-paper" : "bg-wash text-muted"
              }`}
              aria-hidden="true"
            >
              {i < current ? "✓" : i + 1}
            </span>
            <span className={i === current ? "font-medium" : i < current ? "text-soft" : "text-muted"}>{label}</span>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-sm text-muted">
        <span className="font-mono tabular-nums">{fmtClock(now - t0)}</span> on this page. Usually one to four minutes
        in total. You can leave; marking carries on and the report will be here when you come back.
      </p>
    </section>
  );
}
