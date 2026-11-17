import type { Provider } from "./providers";

export type AttemptStatus = "ready" | "in_progress" | "finished" | "grading" | "graded";

export const LOSS_CATEGORIES = [
  "concept",
  "formula",
  "calculation",
  "silly",
  "units",
  "presentation",
  "diagram",
  "incomplete",
  "misread",
  "language",
  "not_attempted",
] as const;
export type LossCategory = (typeof LOSS_CATEGORIES)[number];

export const LOSS_LABEL: Record<LossCategory, string> = {
  concept: "Concept not known",
  formula: "Wrong formula",
  calculation: "Calculation error",
  silly: "Careless slip",
  units: "Units",
  presentation: "Steps / keywords",
  diagram: "Diagram",
  incomplete: "Incomplete answer",
  misread: "Misread question",
  language: "Language",
  not_attempted: "Not attempted",
};

export const LOSS_COLOR: Record<LossCategory, string> = {
  concept: "#c8321e",
  formula: "#8e2a6b",
  calculation: "#d9822b",
  silly: "#d4a72c",
  units: "#2f7f86",
  presentation: "#4a6fa5",
  diagram: "#6b8e4e",
  incomplete: "#8a7f6d",
  misread: "#b0567a",
  language: "#5b5ea6",
  not_attempted: "#2b2924",
};

export const INSIGHT_TYPES = [
  "formula",
  "concept_gap",
  "silly_mistake",
  "exam_technique",
  "time_management",
  "strength",
] as const;
export type InsightType = (typeof INSIGHT_TYPES)[number];

export const INSIGHT_LABEL: Record<InsightType, string> = {
  formula: "Formulae you get wrong",
  concept_gap: "Concept gaps",
  silly_mistake: "Careless mistakes",
  exam_technique: "Exam technique",
  time_management: "Time management",
  strength: "What you actually know",
};

export const INSIGHT_SHORT: Record<InsightType, string> = {
  formula: "Formula",
  concept_gap: "Concept gap",
  silly_mistake: "Careless",
  exam_technique: "Technique",
  time_management: "Time",
  strength: "Strength",
};

export interface LostMark {
  marks: number;
  category: LossCategory;
  reason: string;
}

export interface GradedQuestion {
  number: string;
  section: string;
  unit: string;
  topic: string;
  question: string;
  maxMarks: number;
  markingScheme: string;
  attempted: boolean;
  studentAnswer: string;
  verdict: string;
  awarded: number;
  lostMarks: LostMark[];
  modelAnswer: string;
  readConfidence: "high" | "medium" | "low";
  counted: boolean;
}

export interface ProfileUpdate {
  id: number;
  type: InsightType;
  title: string;
  recurring: boolean;
  occurrences: number;
  unit: string;
  detail: string;
  fix: string;
  questions: string[];
}

export interface Report {
  paper: { title: string; notes: string };
  questions: GradedQuestion[];
  summary: {
    headline: string;
    examinerRemarks: string;
    timeAnalysis: string;
    biggestLeaks: string[];
    nextSteps: string[];
  };
  totals: {
    awarded: number;
    max: number;
    percent: number;
    /** Sum of max marks over the questions the model listed. */
    sumMax: number;
    /** Where `max` came from. */
    maxSource: "you" | "paper" | "questions";
  };
  lossByCategory: Partial<Record<LossCategory, number>>;
  profileUpdates: ProfileUpdate[];
  improvedCount: number;
}

export interface InsightEvidence {
  attemptId: number;
  questions: string[];
  at: string;
}

export interface FileMeta {
  id: number;
  kind: "paper" | "answer";
  name: string;
  mime: string;
  size: number;
}

export interface AttemptDTO {
  id: number;
  title: string;
  subject: string;
  totalMarks: number | null;
  timeAllowedMin: number;
  status: AttemptStatus;
  createdAt: string;
  startedAt: string | null;
  pausedAt: string | null;
  pausedMs: number;
  finishedAt: string | null;
  timeTakenMs: number | null;
  gradedAt: string | null;
  error: string | null;
  awardedMarks: number | null;
  maxMarks: number | null;
  model: string | null;
  report: Report | null;
  files: FileMeta[];
  progress: { stage: "reading" | "writing" | "saving"; chars: number } | null;
  hasKey: boolean;
  serverNow: string;
}

export type KeyStatus = "ok" | "unverified" | "failing";

export interface KeyRow {
  /** null for keys supplied through server environment variables. */
  id: number | null;
  provider: Provider;
  hint: string;
  model: string;
  source: "saved" | "env";
  status: KeyStatus;
  lastError: string | null;
}

export const EVENT_KINDS = ["board", "mock", "revision", "custom"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_LABEL: Record<EventKind, string> = {
  board: "Board exam",
  mock: "Mock paper",
  revision: "Revision",
  custom: "Other",
};

export interface EventRow {
  id: number;
  day: string;
  kind: EventKind;
  title: string;
  /** Subject key (for example "physics"), or "" for none. */
  subject: string;
}

export const RESOURCE_KINDS = ["marking_scheme", "specimen_paper", "syllabus", "notes"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const RESOURCE_LABEL: Record<ResourceKind, string> = {
  marking_scheme: "Marking scheme and acceptable answers",
  specimen_paper: "Specimen question paper",
  syllabus: "Syllabus",
  notes: "Notes or other reference",
};

export const RESOURCE_HINT: Record<ResourceKind, string> = {
  marking_scheme: "The official answer key. When attached, the marker treats it as the authority.",
  specimen_paper: "Shows the real question style and depth. Used to calibrate how much each answer must contain.",
  syllabus: "Defines scope. Material outside the syllabus is not rewarded.",
  notes: "Anything else you want the marker to see.",
};

export interface PracticeQuestion {
  subject: string;
  n: string;
  section: string;
  marks: number | null;
  chapter: string;
  text: string;
}

export interface ResourceMeta {
  id: number;
  subject: string;
  kind: ResourceKind;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
}
