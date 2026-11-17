"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import FilePicker from "./FilePicker";
import { prepareFile } from "@/lib/client-upload";
import { fmtBytes } from "@/lib/format";
import {
  RESOURCE_HINT,
  RESOURCE_KINDS,
  RESOURCE_LABEL,
  type ResourceKind,
  type ResourceMeta,
} from "@/lib/types";

export default function LibraryUpload({ subject, items }: { subject: string; items: ResourceMeta[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<ResourceKind | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(kind: ResourceKind, files: File[]) {
    setBusy(kind);
    setError(null);
    const failed: string[] = [];
    for (const f of files) {
      try {
        const ready = await prepareFile(f);
        const form = new FormData();
        form.set("subject", subject);
        form.set("kind", kind);
        form.set("file", ready, ready.name);
        const res = await fetch("/api/resources", { method: "POST", body: form });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          failed.push(j?.error ?? `${f.name} could not be uploaded.`);
        }
      } catch (e) {
        failed.push(e instanceof Error ? e.message : `${f.name} could not be uploaded.`);
      }
    }
    setBusy(null);
    if (failed.length) setError(failed.join(" "));
    router.refresh();
  }

  async function remove(id: number) {
    setRemoving(id);
    try {
      await fetch(`/api/resources/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="rounded-xl bg-pen-wash px-4 py-3 text-[15px] text-pen">
          {error}
        </p>
      )}
      {RESOURCE_KINDS.map((kind) => {
        const mine = items.filter((i) => i.kind === kind);
        return (
          <section key={kind} className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-medium">{RESOURCE_LABEL[kind]}</h3>
              <span className="text-sm text-muted">
                {mine.length} file{mine.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{RESOURCE_HINT[kind]}</p>
            {mine.length > 0 && (
              <ul className="mt-4 divide-y divide-line">
                {mine.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <a
                      href={`/api/resources/${m.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="link min-w-0 truncate text-soft"
                    >
                      {m.name}
                    </a>
                    <span className="flex shrink-0 items-center gap-3 text-muted">
                      {fmtBytes(m.size)}
                      <button
                        type="button"
                        onClick={() => remove(m.id)}
                        disabled={removing !== null}
                        className="rounded hover:text-pen focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-50"
                      >
                        {removing === m.id ? "Removing…" : "Remove"}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <FilePicker
                accept="application/pdf,image/*"
                title={busy === kind ? "Uploading…" : "Add files"}
                hint="PDF or photos. You can select several at once."
                disabled={busy !== null}
                onFiles={(f) => upload(kind, f)}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}
