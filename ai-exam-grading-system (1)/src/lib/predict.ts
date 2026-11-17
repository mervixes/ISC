import { SUBJECTS } from "./isc";

export interface PaperPoint {
  subject: string;
  /** Percent of the paper's maximum that was awarded. */
  percent: number;
  at: Date;
}

export type Confidence = "none" | "low" | "medium" | "good";
export type Trend = "up" | "down" | "flat";

export interface SubjectPrediction {
  key: string;
  name: string;
  short: string;
  boardMax: number;
  boardNote: string;
  papers: number;
  lastPercent: number | null;
  /** Predicted board theory marks, in half-mark steps. */
  predicted: number | null;
  low: number | null;
  high: number | null;
  trend: Trend | null;
  confidence: Confidence;
}

export interface Overall {
  predicted: number;
  max: number;
  percent: number;
  subjects: number;
}

const DECAY = 0.75;
const WINDOW = 6;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const halfMark = (x: number) => Math.round(x * 2) / 2;
const oneDp = (x: number) => Math.round(x * 10) / 10;

function trendOf(delta: number): Trend {
  if (delta > 3) return "up";
  if (delta < -3) return "down";
  return "flat";
}

/**
 * Weighted recent average per subject. The newest paper counts most (weight 0.75 per step back),
 * the window is the last six marked papers, and the band widens with the spread of results.
 */
export function predictAll(points: PaperPoint[]): { subjects: SubjectPrediction[]; overall: Overall | null } {
  const subjects: SubjectPrediction[] = SUBJECTS.map((s) => {
    const pts = points
      .filter((p) => p.subject === s.name)
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, WINDOW);
    const n = pts.length;
    const base = {
      key: s.key,
      name: s.name,
      short: s.short,
      boardMax: s.boardMax,
      boardNote: s.boardNote,
      papers: n,
    };
    if (n === 0) {
      return { ...base, lastPercent: null, predicted: null, low: null, high: null, trend: null, confidence: "none" };
    }

    const w = pts.map((_, i) => Math.pow(DECAY, i));
    const W = w.reduce((a, b) => a + b, 0);
    const mean = pts.reduce((a, p, i) => a + w[i] * p.percent, 0) / W;
    const variance = pts.reduce((a, p, i) => a + w[i] * (p.percent - mean) ** 2, 0) / W;
    const band = clamp(Math.sqrt(variance) + 2, 3, 12);

    const toBoard = (percent: number) => halfMark((clamp(percent, 0, 100) / 100) * s.boardMax);

    let trend: Trend | null = null;
    if (n >= 4) {
      const recent = (pts[0].percent + pts[1].percent) / 2;
      const earlier = (pts[2].percent + pts[3].percent) / 2;
      trend = trendOf(recent - earlier);
    } else if (n >= 2) {
      trend = trendOf(pts[0].percent - pts[1].percent);
    }

    return {
      ...base,
      lastPercent: oneDp(pts[0].percent),
      predicted: toBoard(mean),
      low: toBoard(mean - band),
      high: toBoard(mean + band),
      trend,
      confidence: n >= 4 ? "good" : n >= 2 ? "medium" : "low",
    };
  });

  const counted = subjects.filter((s) => s.predicted !== null);
  if (counted.length === 0) return { subjects, overall: null };

  const predicted = halfMark(counted.reduce((a, s) => a + (s.predicted ?? 0), 0));
  const max = counted.reduce((a, s) => a + s.boardMax, 0);
  return {
    subjects,
    overall: { predicted, max, percent: oneDp((predicted / max) * 100), subjects: counted.length },
  };
}
