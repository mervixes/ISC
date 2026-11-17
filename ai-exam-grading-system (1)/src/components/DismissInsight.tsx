"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DismissInsight({ id }: { id: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirm" | "busy" | "error">("idle");

  async function remove() {
    setState("busy");
    try {
      const res = await fetch(`/api/insights/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setState("error");
    }
  }

  if (state === "confirm" || state === "busy") {
    return (
      <span className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={remove}
          disabled={state === "busy"}
          className="rounded font-medium text-pen hover:underline focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-50"
        >
          {state === "busy" ? "Removing…" : "Remove"}
        </button>
        <button
          type="button"
          onClick={() => setState("idle")}
          disabled={state === "busy"}
          className="rounded text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
        >
          Keep
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setState("confirm")}
      className="rounded text-sm text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
    >
      {state === "error" ? "Could not remove. Retry" : "Dismiss"}
    </button>
  );
}
