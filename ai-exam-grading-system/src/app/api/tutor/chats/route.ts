import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tutorAttachments, tutorChats, tutorMessages } from "@/db/schema";
import { parseId } from "@/lib/attempts";

export const dynamic = "force-dynamic";

/** Chat list, with the most recently active first. Archived chats are kept but not offered. */
export async function GET() {
  const rows = await db
    .select({
      id: tutorChats.id,
      title: tutorChats.title,
      archived: tutorChats.archived,
      createdAt: tutorChats.createdAt,
      lastActiveAt: tutorChats.lastActiveAt,
      turns: sql<number>`count(${tutorMessages.id})::int`,
    })
    .from(tutorChats)
    .leftJoin(tutorMessages, eq(tutorMessages.chatId, tutorChats.id))
    .groupBy(tutorChats.id, tutorChats.title, tutorChats.archived, tutorChats.createdAt, tutorChats.lastActiveAt)
    .orderBy(desc(tutorChats.lastActiveAt))
    .limit(200);
  return Response.json({
    chats: rows.map((r) => ({
      id: r.id,
      title: r.title,
      archived: r.archived === 1,
      createdAt: r.createdAt.toISOString(),
      lastActiveAt: r.lastActiveAt.toISOString(),
      turns: r.turns,
    })),
  });
}

/** Creates an empty chat. Old chats are never removed, only archived. */
export async function POST() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(tutorChats);
  const [row] = await db
    .insert(tutorChats)
    .values({ title: n === 0 ? "First chat" : `Chat ${n + 1}` })
    .returning();
  return Response.json({
    chat: { id: row.id, title: row.title, archived: false, createdAt: row.createdAt.toISOString(), lastActiveAt: row.lastActiveAt.toISOString(), turns: 0 },
  });
}

/** Renames, archives or restores a chat. Archiving hides it; the messages stay in the database. */
export async function PATCH(req: Request) {
  const body: Record<string, unknown> = (await req.json().catch(() => null)) ?? {};
  const id = parseId(String(body.id ?? ""));
  if (!id) return Response.json({ error: "Chat not found." }, { status: 404 });
  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 120);
  if (typeof body.archived === "boolean") patch.archived = body.archived ? 1 : 0;
  if (Object.keys(patch).length === 0) return Response.json({ error: "Nothing to change." }, { status: 400 });
  const [row] = await db.update(tutorChats).set(patch).where(eq(tutorChats.id, id)).returning();
  if (!row) return Response.json({ error: "Chat not found." }, { status: 404 });
  return Response.json({ ok: true });
}

/**
 * Permanently deletes one chat the student explicitly asked to remove. Everything else is retained:
 * archiving is the default and the only thing the UI offers.
 */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = parseId(url.searchParams.get("id") ?? "");
  if (!id) return Response.json({ error: "Chat not found." }, { status: 404 });
  await db.delete(tutorAttachments).where(
    sql`${tutorAttachments.messageId} in (select ${tutorMessages.id} from ${tutorMessages} where ${tutorMessages.chatId} = ${id})`,
  );
  await db.delete(tutorMessages).where(eq(tutorMessages.chatId, id));
  await db.delete(tutorChats).where(and(eq(tutorChats.id, id)));
  return Response.json({ ok: true });
}
