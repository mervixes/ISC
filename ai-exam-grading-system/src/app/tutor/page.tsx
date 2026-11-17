import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { tutorAttachments, tutorChats, tutorMessages, tutorNotes } from "@/db/schema";
import TutorChat, { type ChatRow, type Message, type NoteRow } from "@/components/TutorChat";
import { hasAiKey } from "@/lib/keys";
import { loadMemory } from "@/lib/tutor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tutor" };

export default async function TutorPage({ searchParams }: { searchParams: Promise<{ chat?: string }> }) {
  const sp = await searchParams;
  const wanted = Number(sp.chat);

  const chats = await db.select().from(tutorChats).orderBy(desc(tutorChats.lastActiveAt)).limit(200);
  const rows: ChatRow[] = chats.map((c) => ({
    id: c.id,
    title: c.title,
    archived: c.archived === 1,
    lastActiveAt: c.lastActiveAt.toISOString(),
    turns: 0,
  }));
  const counted = await db
    .select({ chatId: tutorMessages.chatId, id: tutorMessages.id })
    .from(tutorMessages)
    .where(inArray(tutorMessages.chatId, chats.length ? chats.map((c) => c.id) : [-1]));
  const turns = new Map<number, number>();
  for (const r of counted) turns.set(r.chatId, (turns.get(r.chatId) ?? 0) + 1);
  for (const r of rows) r.turns = turns.get(r.id) ?? 0;

  // Default to the most recently active chat that is not hidden.
  const activeChat = rows.find((c) => c.id === wanted) ?? rows.find((c) => !c.archived) ?? null;

  let messages: Message[] = [];
  if (activeChat) {
    const ms = await db
      .select()
      .from(tutorMessages)
      .where(eq(tutorMessages.chatId, activeChat.id))
      .orderBy(asc(tutorMessages.id))
      .limit(500);
    const ids = ms.map((m) => m.id);
    const atts = ids.length
      ? await db
          .select({ id: tutorAttachments.id, messageId: tutorAttachments.messageId, mime: tutorAttachments.mime, name: tutorAttachments.name })
          .from(tutorAttachments)
          .where(inArray(tutorAttachments.messageId, ids))
      : [];
    messages = ms.map((m) => ({
      id: m.id,
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
      attachments: atts.filter((a) => a.messageId === m.id).map((a) => ({ id: a.id, mime: a.mime, name: a.name })),
    }));
  }

  const noteRows = await db.select().from(tutorNotes).orderBy(asc(tutorNotes.updatedAt));
  const notes: NoteRow[] = noteRows.map((n) => ({ id: n.id, subject: n.subject, title: n.title, body: n.body }));

  return (
    <div className="pt-8 sm:pt-12">
      <p className="kicker">Tutor</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">Someone who has read every paper.</h1>
      <p className="mt-4 max-w-2xl text-soft">
        Every chat is kept and every answer is stored. The tutor can read your whole record, put sessions on your
        calendar, write notes you keep, and correct what it knows about you.
      </p>
      <div className="mt-8">
        <TutorChat
          chats={rows}
          activeChat={activeChat}
          initialMessages={messages}
          notes={notes}
          memory={await loadMemory()}
          hasKey={await hasAiKey()}
        />
      </div>
    </div>
  );
}
