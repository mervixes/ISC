import { index, integer, jsonb, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import type { InsightEvidence, Report } from "../lib/types";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const attempts = pgTable("attempts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  totalMarks: integer("total_marks"),
  timeAllowedMin: integer("time_allowed_min").notNull().default(180),
  // ready | in_progress | finished | grading | graded
  status: text("status").notNull().default("ready"),
  createdAt: ts("created_at").notNull().defaultNow(),
  startedAt: ts("started_at"),
  pausedAt: ts("paused_at"),
  pausedMs: integer("paused_ms").notNull().default(0),
  finishedAt: ts("finished_at"),
  timeTakenMs: integer("time_taken_ms"),
  gradingStartedAt: ts("grading_started_at"),
  gradedAt: ts("graded_at"),
  error: text("error"),
  awardedMarks: real("awarded_marks"),
  maxMarks: real("max_marks"),
  model: text("model"),
  report: jsonb("report").$type<Report>(),
  /** Set when the paper is moved to the recycle bin. Null while it is live. */
  deletedAt: ts("deleted_at"),
});

/** Questions extracted from an uploaded question paper, used by the Practice page. */
export const questionBank = pgTable(
  "question_bank",
  {
    id: serial("id").primaryKey(),
    /** The paper the question came from. Kept even if that paper is recycled. */
    attemptId: integer("attempt_id"),
    subject: text("subject").notNull(),
    chapter: text("chapter").notNull().default("Unclassified"),
    number: text("number").notNull().default(""),
    section: text("section").notNull().default(""),
    marks: integer("marks"),
    text: text("text").notNull(),
    sourceName: text("source_name").notNull().default(""),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("question_bank_subject_idx").on(t.subject)],
);

/** Facts and rules the marking engine has learned, injected into every marking run. */
export const engineNotes = pgTable(
  "engine_notes",
  {
    id: serial("id").primaryKey(),
    // rule | pattern | note
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    /** auto (derived from a marked paper) | tutor (written by the tutor) */
    source: text("source").notNull().default("auto"),
    attemptId: integer("attempt_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("engine_notes_kind_idx").on(t.kind)],
);

export const files = pgTable(
  "files",
  {
    id: serial("id").primaryKey(),
    attemptId: integer("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    // paper | answer
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    position: integer("position").notNull().default(0),
    // base64 payload
    data: text("data").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("files_attempt_idx").on(t.attemptId)],
);

export const insights = pgTable(
  "insights",
  {
    id: serial("id").primaryKey(),
    subject: text("subject").notNull(),
    // concept_gap | formula | silly_mistake | exam_technique | time_management | strength
    type: text("type").notNull(),
    unit: text("unit").notNull().default(""),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    fix: text("fix").notNull().default(""),
    severity: integer("severity").notNull().default(2),
    occurrences: integer("occurrences").notNull().default(1),
    // active | improving
    status: text("status").notNull().default("active"),
    formulaCorrect: text("formula_correct").notNull().default(""),
    formulaWrote: text("formula_wrote").notNull().default(""),
    evidence: jsonb("evidence").$type<InsightEvidence[]>().notNull().default([]),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  },
  (t) => [index("insights_subject_idx").on(t.subject)],
);

/** Saved AI keys. Tried in `position` order; a failing key hands over to the next one. */
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  apiKey: text("api_key").notNull(),
  hint: text("hint").notNull().default(""),
  model: text("model").notNull().default(""),
  // ok | unverified | failing
  status: text("status").notNull().default("unverified"),
  lastError: text("last_error"),
  position: integer("position").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
  verifiedAt: ts("verified_at"),
});

/** Official material per subject: specimen papers, marking schemes, syllabi. */
export const resources = pgTable(
  "resources",
  {
    id: serial("id").primaryKey(),
    subject: text("subject").notNull(),
    // marking_scheme | specimen_paper | syllabus | notes
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    data: text("data").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("resources_subject_idx").on(t.subject)],
);

/** Calendar entries: board dates, mock sittings, revision blocks, anything else. */
export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    // YYYY-MM-DD, calendar date chosen by the user
    day: text("day").notNull(),
    // board | mock | revision | custom
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    subject: text("subject").notNull().default(""),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("events_day_idx").on(t.day)],
);

/** The tutor's conversation with the student. */
export const tutorMessages = pgTable(
  "tutor_messages",
  {
    id: serial("id").primaryKey(),
    chatId: integer("chat_id")
      .notNull()
      .references(() => tutorChats.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("tutor_messages_created_idx").on(t.createdAt),
    // Messages are always read per chat; the startup SQL creates this too, so both must declare it.
    index("tutor_messages_chat_idx").on(t.chatId),
  ],
);

/** One tutor conversation. Nothing is ever deleted: an archived chat is hidden, not removed. */
export const tutorChats = pgTable(
  "tutor_chats",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull().default("New chat"),
    archived: integer("archived").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastActiveAt: ts("last_active_at").notNull().defaultNow(),
  },
  (t) => [index("tutor_chats_active_idx").on(t.lastActiveAt)],
);

/** Notes the tutor writes for the student, kept per subject. */
export const tutorNotes = pgTable(
  "tutor_notes",
  {
    id: serial("id").primaryKey(),
    subject: text("subject").notNull().default(""),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("tutor_notes_subject_idx").on(t.subject)],
);

/** Images the student sends to the tutor. */
export const tutorAttachments = pgTable(
  "tutor_attachments",
  {
    id: serial("id").primaryKey(),
    messageId: integer("message_id")
      .notNull()
      .references(() => tutorMessages.id, { onDelete: "cascade" }),
    mime: text("mime").notNull(),
    name: text("name").notNull(),
    data: text("data").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("tutor_attachments_message_idx").on(t.messageId)],
);

/** Durable things the tutor has learned about the student, which it may add to itself. */
export const tutorMemory = pgTable("tutor_memory", {
  id: serial("id").primaryKey(),
  // fact | preference | target | observation | plan
  kind: text("kind").notNull(),
  content: text("content").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/**
 * What the student did with the dashboard's "Study this chapter right now". Never deleted:
 * an undo stamps revokedAt instead of removing the row.
 */
export const studyLog = pgTable(
  "study_log",
  {
    id: serial("id").primaryKey(),
    subject: text("subject").notNull(),
    chapter: text("chapter").notNull(),
    // done | skip
    action: text("action").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    revokedAt: ts("revoked_at"),
  },
  (t) => [index("study_log_chapter_idx").on(t.subject, t.chapter)],
);
