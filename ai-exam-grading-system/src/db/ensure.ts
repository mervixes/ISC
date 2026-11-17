import { pool } from "./index";

/**
 * Idempotent copy of the schema in ./schema.ts. Runs once at server start so the app works
 * on a database that has not had `drizzle-kit push` applied. Keep it in step with schema.ts.
 */
const DDL = `
CREATE TABLE IF NOT EXISTS "attempts" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "subject" text NOT NULL,
  "total_marks" integer,
  "time_allowed_min" integer DEFAULT 180 NOT NULL,
  "status" text DEFAULT 'ready' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "paused_at" timestamp with time zone,
  "paused_ms" integer DEFAULT 0 NOT NULL,
  "finished_at" timestamp with time zone,
  "time_taken_ms" integer,
  "grading_started_at" timestamp with time zone,
  "graded_at" timestamp with time zone,
  "error" text,
  "awarded_marks" real,
  "max_marks" real,
  "model" text,
  "report" jsonb,
  "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "question_bank" (
  "id" serial PRIMARY KEY NOT NULL,
  "attempt_id" integer,
  "subject" text NOT NULL,
  "chapter" text DEFAULT 'Unclassified' NOT NULL,
  "number" text DEFAULT '' NOT NULL,
  "section" text DEFAULT '' NOT NULL,
  "marks" integer,
  "text" text NOT NULL,
  "source_name" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "engine_notes" (
  "id" serial PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "content" text NOT NULL,
  "source" text DEFAULT 'auto' NOT NULL,
  "attempt_id" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "files" (
  "id" serial PRIMARY KEY NOT NULL,
  "attempt_id" integer NOT NULL,
  "kind" text NOT NULL,
  "name" text NOT NULL,
  "mime" text NOT NULL,
  "size" integer NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "data" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "files_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id")
    REFERENCES "attempts"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "insights" (
  "id" serial PRIMARY KEY NOT NULL,
  "subject" text NOT NULL,
  "type" text NOT NULL,
  "unit" text DEFAULT '' NOT NULL,
  "title" text NOT NULL,
  "detail" text DEFAULT '' NOT NULL,
  "fix" text DEFAULT '' NOT NULL,
  "severity" integer DEFAULT 2 NOT NULL,
  "occurrences" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "formula_correct" text DEFAULT '' NOT NULL,
  "formula_wrote" text DEFAULT '' NOT NULL,
  "evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" serial PRIMARY KEY NOT NULL,
  "provider" text NOT NULL,
  "api_key" text NOT NULL,
  "hint" text DEFAULT '' NOT NULL,
  "model" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'unverified' NOT NULL,
  "last_error" text,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "verified_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "resources" (
  "id" serial PRIMARY KEY NOT NULL,
  "subject" text NOT NULL,
  "kind" text NOT NULL,
  "name" text NOT NULL,
  "mime" text NOT NULL,
  "size" integer NOT NULL,
  "data" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "events" (
  "id" serial PRIMARY KEY NOT NULL,
  "day" text NOT NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "subject" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "files_attempt_idx" ON "files" USING btree ("attempt_id");
CREATE INDEX IF NOT EXISTS "insights_subject_idx" ON "insights" USING btree ("subject");
CREATE INDEX IF NOT EXISTS "resources_subject_idx" ON "resources" USING btree ("subject");
CREATE TABLE IF NOT EXISTS "tutor_chats" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" text DEFAULT 'New chat' NOT NULL,
  "archived" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_active_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tutor_notes" (
  "id" serial PRIMARY KEY NOT NULL,
  "subject" text DEFAULT '' NOT NULL,
  "title" text NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tutor_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "chat_id" integer NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tutor_messages_chat_id_tutor_chats_id_fk" FOREIGN KEY ("chat_id")
    REFERENCES "tutor_chats"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "tutor_attachments" (
  "id" serial PRIMARY KEY NOT NULL,
  "message_id" integer NOT NULL,
  "mime" text NOT NULL,
  "name" text NOT NULL,
  "data" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tutor_attachments_message_id_tutor_messages_id_fk" FOREIGN KEY ("message_id")
    REFERENCES "tutor_messages"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "tutor_memory" (
  "id" serial PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "study_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "subject" text NOT NULL,
  "chapter" text NOT NULL,
  "action" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "events_day_idx" ON "events" USING btree ("day");
CREATE INDEX IF NOT EXISTS "study_log_chapter_idx" ON "study_log" USING btree ("subject","chapter");
CREATE INDEX IF NOT EXISTS "question_bank_subject_idx" ON "question_bank" USING btree ("subject");
CREATE INDEX IF NOT EXISTS "engine_notes_kind_idx" ON "engine_notes" USING btree ("kind");
CREATE INDEX IF NOT EXISTS "tutor_messages_created_idx" ON "tutor_messages" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "tutor_messages_chat_idx" ON "tutor_messages" USING btree ("chat_id");
CREATE INDEX IF NOT EXISTS "tutor_chats_active_idx" ON "tutor_chats" USING btree ("last_active_at");
CREATE INDEX IF NOT EXISTS "tutor_notes_subject_idx" ON "tutor_notes" USING btree ("subject");
CREATE INDEX IF NOT EXISTS "tutor_attachments_message_idx" ON "tutor_attachments" USING btree ("message_id");
`;

/** Official ISC 2027 timetable (CISCE, published 11 Nov 2026), board papers only. */
const ISC_2027_SEED: [string, string, string, string][] = [
  ["2027-02-09", "board", "ISC 2027 examinations begin (Environmental Science)", ""],
  ["2027-02-10", "board", "English Paper 1: English Language", "english1"],
  ["2027-02-15", "board", "English Paper 2: Literature in English", "english2"],
  ["2027-02-24", "board", "Chemistry Paper 1 (Theory)", "chemistry"],
  ["2027-03-01", "board", "Mathematics", "maths"],
  ["2027-03-08", "board", "Physics Paper 1 (Theory)", "physics"],
  ["2027-03-17", "board", "Computer Science Paper 1 (Theory)", "cs"],
  ["2027-04-08", "board", "Last ISC 2027 examination", ""],
];

/** Gives messages from before chats existed a chat of their own, so nothing is lost. */
async function adoptOrphanMessages(): Promise<void> {
  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'tutor_messages' AND column_name = 'chat_id'
  `);
  if (!cols.rowCount) return;
  const orphans = await pool.query(`SELECT 1 FROM tutor_messages WHERE chat_id IS NULL LIMIT 1`);
  if (orphans.rowCount) {
    await pool.query(`
      INSERT INTO tutor_chats (title) VALUES ('Earlier conversation')
      ON CONFLICT DO NOTHING
    `);
    await pool.query(`
      UPDATE tutor_messages SET chat_id = (SELECT id FROM tutor_chats ORDER BY id LIMIT 1)
      WHERE chat_id IS NULL
    `);
  }
  // Older builds had a nullable column; make it strict now that every row has a chat.
  await pool.query(`ALTER TABLE tutor_messages ALTER COLUMN chat_id SET NOT NULL`).catch(() => {});
}

async function migrateLegacyKey(): Promise<void> {
  const legacy = await pool.query(
    `SELECT key, value FROM settings WHERE key IN ('ai_provider', 'ai_model', 'ai_api_key')`,
  );
  const map = Object.fromEntries(legacy.rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  if (map.ai_api_key && map.ai_provider) {
    const dup = await pool.query(`SELECT 1 FROM api_keys WHERE api_key = $1`, [map.ai_api_key]);
    if (dup.rowCount === 0) {
      await pool.query(
        `INSERT INTO api_keys (provider, api_key, hint, model, position) VALUES ($1, $2, $3, $4, 0)`,
        [map.ai_provider, map.ai_api_key, String(map.ai_api_key).slice(-4), map.ai_model ?? ""],
      );
    }
  }
  await pool.query(`DELETE FROM settings WHERE key IN ('ai_provider', 'ai_model', 'ai_api_key')`);
}

async function seedBoardCalendar(): Promise<void> {
  // Remove exact duplicates that earlier runs created, keeping the oldest of each.
  await pool.query(`
    DELETE FROM events e USING events d
    WHERE e.day = d.day AND e.kind = d.kind AND e.title = d.title AND e.id > d.id
  `);
  const done = await pool.query(`SELECT 1 FROM settings WHERE key = 'seed_isc2027'`);
  const already = await pool.query(`SELECT 1 FROM events WHERE kind = 'board' LIMIT 1`);
  if (done.rowCount && already.rowCount) return;
  if (already.rowCount) {
    await pool.query(`INSERT INTO settings (key, value) VALUES ('seed_isc2027', '1') ON CONFLICT (key) DO NOTHING`);
    return;
  }
  for (const [day, kind, title, subject] of ISC_2027_SEED) {
    await pool.query(`INSERT INTO events (day, kind, title, subject) VALUES ($1, $2, $3, $4)`, [
      day,
      kind,
      title,
      subject,
    ]);
  }
  await pool.query(`INSERT INTO settings (key, value) VALUES ('seed_isc2027', '1') ON CONFLICT (key) DO NOTHING`);
}

export async function ensureSchema(): Promise<void> {
  try {
    await pool.query(DDL);
    await migrateLegacyKey();
    await adoptOrphanMessages();
    await seedBoardCalendar();
  } catch (e) {
    console.error("[db] could not ensure schema:", e);
  }
}
