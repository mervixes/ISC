import { CHEMISTRY_TYPES } from "./chemistry";
import { CS_TYPES, ENGLISH1_TYPES, ENGLISH2_TYPES } from "./cs-english";
import { MATHS_TYPES } from "./maths";
import { PHYSICS_TYPES } from "./physics";
import type { ChapterTypes, SubjectTypes } from "./types";

export * from "./types";

/** Question types per chapter for all six subjects, from the ISC 2027 syllabus and specimen papers. */
export const TYPES: SubjectTypes[] = [
  PHYSICS_TYPES,
  CHEMISTRY_TYPES,
  MATHS_TYPES,
  CS_TYPES,
  ENGLISH1_TYPES,
  ENGLISH2_TYPES,
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Every chapter across every subject, keyed by a normalised name. */
const CHAPTERS: { subject: string; chapter: ChapterTypes }[] = TYPES.flatMap((s) =>
  s.chapters.map((c) => ({ subject: s.subject, chapter: c })),
);

/** Weightage of the syllabus chapter that best matches a practice question's chapter. */
export function chapterWeight(subject: string, chapter: string): number {
  const target = norm(chapter);
  const same = CHAPTERS.filter((c) => c.subject === subject);
  const exact = same.find((c) => norm(c.chapter.chapter) === target);
  if (exact) return exact.chapter.weightage;
  const contains = same.find((c) => {
    const n = norm(c.chapter.chapter);
    return n.includes(target) || target.includes(n);
  });
  return contains ? contains.chapter.weightage : 0;
}

/** The chapter name as the Types page spells it, so links and labels line up. */
export function canonicalChapter(subject: string, chapter: string): string {
  const target = norm(chapter);
  const same = CHAPTERS.filter((c) => c.subject === subject);
  const exact = same.find((c) => norm(c.chapter.chapter) === target);
  if (exact) return exact.chapter.chapter;
  const contains = same.find((c) => {
    const n = norm(c.chapter.chapter);
    return n.includes(target) || target.includes(n);
  });
  return contains ? contains.chapter.chapter : chapter;
}
