/** Client-safe shapes for the dashboard's "Study this chapter right now". */

export interface StudyPick {
  subject: string;
  subjectShort: string;
  chapter: string;
  /** Marks the chapter carries in the theory paper. */
  weightage: number;
  boardMax: number;
  score: number;
  /** Share of marks earned in this chapter across marked papers, or null if never tested. */
  mastery: number | null;
  daysToBoard: number | null;
  /** One line: what is at stake. */
  headline: string;
  /** Why this chapter, why now. */
  why: string;
  /** The highest-weight question types to begin with. */
  startWith: { type: string; marks: string }[];
  openMistakes: number;
  /** Questions available on the Practice page for this chapter. */
  practiceCount: number;
  timesDone: number;
  /** Marked done before, but a newer paper still lost marks here. */
  returning: boolean;
}

export interface StudyStats {
  today: number;
  week: number;
  total: number;
}

export interface StudyPlan {
  picks: StudyPick[];
  stats: StudyStats;
  recentDone: { subject: string; chapter: string; at: string }[];
}
