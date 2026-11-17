"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BinActions({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "restore" | "purge") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/attempts/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "That did not work.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="shrink-0">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void act("restore")} disabled={busy !== null} className="btn btn-ghost btn-sm">
          {busy === "restore" ? "Restoring…" : "Restore"}
        </button>
        {confirming ? (
          <>
            <button type="button" onClick={() => void act("purge")} disabled={busy !== null} className="btn btn-pen btn-sm">
              {busy === "purge" ? "Deleting…" : "Delete forever"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy !== null} className="btn btn-ghost btn-sm">
              Keep
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy !== null}
            className="btn btn-sm text-muted hover:text-pen"
          >
            Delete forever
          </button>
        )}
      </div>
      <p className="mt-2 max-w-[220px] text-xs text-muted">
        Delete forever removes the paper, its files and its report, and pulls its evidence out of your knowledge map.
      </p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-pen">
          {error}
        </p>
      )}
    </div>
  );
}
