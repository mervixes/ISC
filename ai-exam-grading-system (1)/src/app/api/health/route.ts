import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Post-deploy check: confirms the database answers and that the schema was created.
 * Used by the deployment guide as the first thing to hit after going live.
 */
export async function GET() {
  try {
    const rows = await db.execute<{ table_name: string }>(sql`
      select table_name from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `);
    const tables = (rows.rows ?? []).map((r) => r.table_name);
    const required = [
      "attempts",
      "api_keys",
      "engine_notes",
      "events",
      "files",
      "insights",
      "question_bank",
      "resources",
      "settings",
      "study_log",
      "tutor_attachments",
      "tutor_chats",
      "tutor_memory",
      "tutor_messages",
      "tutor_notes",
    ];
    const missing = required.filter((t) => !tables.includes(t));
    return Response.json({
      ok: true,
      database: "connected",
      schema: missing.length === 0 ? "ready" : "incomplete",
      missing,
      tables,
    });
  } catch (e) {
    return Response.json(
      { ok: false, database: "unreachable", error: (e as Error)?.message ?? "unknown error" },
      { status: 500 },
    );
  }
}
