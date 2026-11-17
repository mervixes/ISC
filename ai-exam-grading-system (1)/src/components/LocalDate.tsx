"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Formats a timestamp in the viewer's own timezone without a hydration mismatch. */
export default function LocalDate({ iso, withTime = false }: { iso: string; withTime?: boolean }) {
  const text = useSyncExternalStore(
    subscribe,
    () => {
      const d = new Date(iso);
      const date = d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
      if (!withTime) return date;
      return `${date}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    },
    () => "",
  );
  return <time dateTime={iso}>{text}</time>;
}
