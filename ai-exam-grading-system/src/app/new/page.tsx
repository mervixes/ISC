"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import FilePicker from "@/components/FilePicker";
import { uploadFile } from "@/lib/client-upload";
import { fmtBytes } from "@/lib/format";
import { SUBJECTS } from "@/lib/isc";

export default function NewPaper() {
  const router = useRouter();
  const [subject, setSubject] = useState(SUBJECTS[2].name);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("180");
  const [marks, setMarks] = useState("");
  const [picked, setPicked] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const current = SUBJECTS.find((s) => s.name === subject);

  function addFiles(list: File[]) {
    setError(null);
    const ok = list.filter(
      (f) => f.type === "application/pdf" || f.type.startsWith("image/") || /\.(pdf|heic|heif)$/i.test(f.name),
    );
    if (ok.length < list.length) setError("Only PDFs and images can be used as a question paper.");
    setPicked((prev) => [...prev, ...ok]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (picked.length === 0) return setError("Attach the question paper first.");

    setProgress("Creating paper");
    let id: number | null = null;
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject,
          title: title.trim() || `${subject} paper`,
          timeAllowedMin: Number(minutes),
          totalMarks: marks.trim() === "" ? null : Number(marks),
        }),
      });
      const j = (await res.json().catch(() => null)) as { id?: number; error?: string } | null;
      if (!res.ok || !j?.id) throw new Error(j?.error ?? "Could not create the paper.");
      id = j.id;
      for (let i = 0; i < picked.length; i++) {
        setProgress(`Uploading ${i + 1} of ${picked.length}`);
        await uploadFile(id, "paper", picked[i]);
      }
      router.push(`/attempt/${id}`);
    } catch (err) {
      // Do not leave a half-created paper behind.
      if (id) await fetch(`/api/attempts/${id}`, { method: "DELETE" }).catch(() => {});
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setProgress(null);
    }
  }

  const busy = progress !== null;

  return (
    <div className="mx-auto max-w-2xl pt-8 sm:pt-12">
      <Link href="/papers" className="text-sm text-muted hover:text-ink">
        ← Papers
      </Link>
      <h1 className="display mt-4 text-5xl sm:text-6xl">New paper</h1>
      <p className="mt-3 text-soft">Attach the question paper. It stays hidden until you start the clock.</p>

      <form onSubmit={submit} className="mt-10 space-y-7" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="subject" className="label">
              Subject
            </label>
            <select
              id="subject"
              className="input select"
              value={subject}
              disabled={busy}
              onChange={(e) => setSubject(e.target.value)}
            >
              {SUBJECTS.map((s) => (
                <option key={s.key} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
            {current && <p className="mt-2 text-sm text-muted">{current.boardNote}</p>}
          </div>
          <div>
            <label htmlFor="minutes" className="label">
              Time allowed (minutes)
            </label>
            <input
              id="minutes"
              className="input"
              type="number"
              inputMode="numeric"
              min={5}
              max={600}
              value={minutes}
              disabled={busy}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="title" className="label">
            Name this paper
          </label>
          <input
            id="title"
            className="input"
            value={title}
            disabled={busy}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`e.g. ${subject}, specimen paper 1`}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="marks" className="label">
              Maximum marks <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="marks"
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              value={marks}
              disabled={busy}
              onChange={(e) => setMarks(e.target.value)}
              placeholder="Read from the paper"
            />
          </div>
        </div>

        <div>
          <p className="label">Question paper</p>
          <FilePicker
            accept="application/pdf,image/*"
            title="Choose a PDF or photos of the paper"
            hint="Or drag files here. Add photos in page order."
            disabled={busy}
            onFiles={addFiles}
          />
          {picked.length > 0 && (
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-card">
              {picked.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="text-muted">{i + 1}.</span> {f.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-muted">{fmtBytes(f.size)}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setPicked((prev) => prev.filter((_, j) => j !== i))}
                      className="rounded px-1.5 py-0.5 text-muted hover:text-pen focus-visible:outline-2 focus-visible:outline-ink"
                      aria-label={`Remove ${f.name}`}
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-pen-wash px-4 py-3 text-[15px] text-pen">
            {error}
          </p>
        )}

        <div className="flex items-center gap-4">
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? `${progress}…` : "Create paper"}
          </button>
          {!busy && (
            <Link href="/papers" className="text-sm text-muted hover:text-ink">
              Cancel
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
