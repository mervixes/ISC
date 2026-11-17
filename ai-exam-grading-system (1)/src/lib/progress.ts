export interface GradingProgress {
  stage: "reading" | "writing" | "saving";
  chars: number;
}

// Shared across route bundles in the same server process.
const g = globalThis as typeof globalThis & { __gradingProgress?: Map<number, GradingProgress> };

export const gradingProgress: Map<number, GradingProgress> = (g.__gradingProgress ??= new Map());
