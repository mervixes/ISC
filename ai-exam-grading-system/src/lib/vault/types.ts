export type VaultKind = "formula" | "derivation" | "reaction" | "mechanism" | "test" | "quote";
export type VaultSubject = "Physics" | "Chemistry" | "Maths" | "Literature";

export interface VaultExample {
  q: string;
  work?: string[];
  a: string;
}

/**
 * One entry in the vault. Text fields may contain $...$ for inline LaTeX.
 * `math` holds a LaTeX expression without delimiters and is shown in display mode.
 */
export interface VaultItem {
  id: string;
  kind: VaultKind;
  subject: VaultSubject;
  chapter: string;
  /** Quotation entries use `quote` instead. */
  title?: string;
  /** 3 = asked almost every year, 2 = regular, 1 = supporting. */
  importance: 1 | 2 | 3;
  math?: string;
  /** Quotation entries carry their own fields instead of this. */
  when?: string;
  /** Reaction conditions, or the test procedure. */
  conditions?: string;
  reagents?: string;
  /** The positive observation for a test. */
  observation?: string;
  /** Derivation steps, mechanism steps, or test steps. */
  steps?: string[];
  example?: VaultExample;
  /** A trap that costs marks. */
  note?: string;

  // --- quotation entries (kind: "quote") ---
  /** The quotation itself, verbatim. */
  quote?: string;
  /** Who says it. */
  speaker?: string;
  /** Where it sits: act and scene, or the poem or story. */
  source?: string;
  /** What is happening when it is said. */
  context?: string;
  /** False when the wording should be checked against the student's own copy. */
  verified?: boolean;
}

export const KIND_META: Record<VaultKind, { label: string; blurb: string }> = {
  formula: {
    label: "Formulae",
    blurb: "Every formula the syllabus expects you to recall, with when to reach for it and a worked example.",
  },
  quote: {
    label: "Quotations",
    blurb: "Lines worth quoting, with who says them, where they sit and what they mean. Literature only.",
  },
  derivation: {
    label: "Derivations",
    blurb: "Ranked by how often they are asked. Learn the diagram, the steps and the boxed result.",
  },
  reaction: {
    label: "Reactions",
    blurb: "Balanced equations with the conditions examiners check for, grouped by chapter.",
  },
  mechanism: {
    label: "Mechanisms",
    blurb: "Arrow-pushing steps in words, with the intermediate and the rule that decides the product.",
  },
  test: {
    label: "Tests",
    blurb: "Qualitative tests: reagent, procedure, the observation that proves it, and when to use it.",
  },
};

export const KIND_ORDER: VaultKind[] = ["formula", "derivation", "reaction", "mechanism", "test", "quote"];
