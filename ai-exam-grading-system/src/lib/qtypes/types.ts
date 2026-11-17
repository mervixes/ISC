export type Weight = "high" | "medium" | "low";

export interface QuestionType {
  type: string;
  marks: string;
  weight: Weight;
  note: string;
}

export interface ChapterTypes {
  chapter: string;
  weightage: number;
  types: QuestionType[];
}

export interface SubjectTypes {
  subject: string;
  chapters: ChapterTypes[];
}

export function weightLabel(w: Weight): string {
  return w === "high" ? "High" : w === "medium" ? "Medium" : "Low";
}
