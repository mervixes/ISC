/** 1.5 -> "1½", 0.5 -> "½", 3 -> "3" */
export function fmtMarks(n: number): string {
  const r = Math.round(n * 2) / 2;
  const whole = Math.floor(r);
  const half = r - whole >= 0.5;
  if (!half) return String(whole);
  return whole === 0 ? "½" : `${whole}½`;
}

/** 9_660_000 -> "2h 41m" */
export function fmtDuration(ms: number): string {
  if (ms < 60000) return `${Math.max(0, Math.round(ms / 1000))}s`;
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** 9_667_000 -> "2:41:07" */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function fmtBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function pct(awarded: number, max: number): number {
  if (!max || max <= 0) return 0;
  return Math.round((awarded / max) * 1000) / 10;
}

/** Marks that may be fractional shares: halves print as "1½", anything else to one decimal. */
export function fmtLoss(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r * 2) ? fmtMarks(r) : r.toFixed(1);
}
