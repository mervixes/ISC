"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RemoveEngineNote({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    await fetch(`/api/engine/notes/${id}`, { method: "DELETE" });
    router.refresh();
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={() => void remove()}
      disabled={busy}
      className="shrink-0 rounded text-sm text-muted hover:text-pen focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-50"
    >
      {busy ? "Removing…" : "Remove"}
    </button>
  );
}
