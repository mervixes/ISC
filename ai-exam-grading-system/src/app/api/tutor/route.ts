import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { tutorAttachments, tutorChats, tutorMemory, tutorMessages, tutorNotes } from "@/db/schema";
import { AiError, generate } from "@/lib/ai";
import { getAiConfigs } from "@/lib/keys";
import { parseId } from "@/lib/attempts";
import {
  applyActions,
  cutAtTail,
  buildTutorContext,
  loadMemory,
  parseActions,
  parseMemory,
  stripBlocks,
  TUTOR_SYSTEM,
} from "@/lib/tutor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Turns sent back to the model, so a long chat does not grow without bound. */
const HISTORY = 24;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chatId = parseId(url.searchParams.get("chat") ?? "");
  if (!chatId) return Response.json({ error: "Which chat?" }, { status: 400 });

  const [chat] = await db.select().from(tutorChats).where(eq(tutorChats.id, chatId));
  if (!chat) return Response.json({ error: "Chat not found." }, { status: 404 });

  const messages = await db
    .select()
    .from(tutorMessages)
    .where(eq(tutorMessages.chatId, chatId))
    .orderBy(asc(tutorMessages.id))
    .limit(500);
  const ids = messages.map((m) => m.id);
  const atts = ids.length
    ? await db
        .select({ id: tutorAttachments.id, messageId: tutorAttachments.messageId, mime: tutorAttachments.mime, name: tutorAttachments.name })
        .from(tutorAttachments)
        .where(inArray(tutorAttachments.messageId, ids))
    : [];

  const [notes, memory] = await Promise.all([
    db.select().from(tutorNotes).orderBy(asc(tutorNotes.updatedAt)),
    loadMemory(),
  ]);

  return Response.json({
    chat: { id: chat.id, title: chat.title, archived: chat.archived === 1 },
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      attachments: atts.filter((a) => a.messageId === m.id).map((a) => ({ id: a.id, mime: a.mime, name: a.name })),
    })),
    notes: notes.map((n) => ({ id: n.id, subject: n.subject, title: n.title, body: n.body })),
    memory,
  });
}

/**
 * Sends a turn. There is no route that wipes the conversation: each chat is kept, and the student
 * starts a new one instead of clearing the old.
 */
export async function POST(req: Request) {
  const body: Record<string, unknown> = (await req.json().catch(() => null)) ?? {};
  const chatId = parseId(String(body.chat ?? ""));
  if (!chatId) return Response.json({ error: "Which chat?" }, { status: 400 });

  const [chat] = await db.select().from(tutorChats).where(eq(tutorChats.id, chatId));
  if (!chat) return Response.json({ error: "Chat not found." }, { status: 404 });

  const message = typeof body.message === "string" ? body.message.trim().slice(0, 8000) : "";
  const rawImages = Array.isArray(body.images) ? body.images : [];
  const images = rawImages
    .map((v) => {
      const o = (v ?? {}) as Record<string, unknown>;
      return {
        mime: typeof o.mime === "string" ? o.mime : "",
        base64: typeof o.base64 === "string" ? o.base64 : "",
        name: typeof o.name === "string" ? o.name.slice(0, 120) : "image",
      };
    })
    .filter((im) => /^image\/(jpeg|png|webp)$/.test(im.mime) && im.base64.length > 100 && im.base64.length < 9_000_000)
    .slice(0, 4);
  if (!message && images.length === 0) {
    return Response.json({ error: "Write something or attach an image first." }, { status: 400 });
  }

  const cfgs = await getAiConfigs();
  if (cfgs.length === 0) {
    return Response.json({ error: "Add an AI API key on the API keys page first." }, { status: 400 });
  }

  const history = await db
    .select()
    .from(tutorMessages)
    .where(eq(tutorMessages.chatId, chatId))
    .orderBy(asc(tutorMessages.id))
    .limit(500);
  const recent = history.slice(-HISTORY);

  let context: string;
  try {
    context = await buildTutorContext();
  } catch (e) {
    console.error("[tutor] could not build context:", e);
    context = "The student's record could not be loaded. Ask them what they have sat so far.";
  }

  const system = `${TUTOR_SYSTEM}\n\n${context}`;

  const [userRow] = await db
    .insert(tutorMessages)
    .values({ chatId, role: "user", content: message })
    .returning({ id: tutorMessages.id });
  if (images.length) {
    await db.insert(tutorAttachments).values(images.map((im) => ({ messageId: userRow.id, mime: im.mime, name: im.name, data: im.base64 })));
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      // How much of the cleaned text has already been sent. Only ever grows.
      let emitted = 0;

      const emit = (text: string) => {
        if (text) controller.enqueue(encoder.encode(text));
      };

      /**
       * Sends what is safe of the cleaned reply. The cleaned text is recomputed from the whole
       * buffer every time, so a marker that arrives split across chunks is always caught, and the
       * cursor only moves forward.
       */
      const flush = (final: boolean) => {
        const clean = cutAtTail(full);
        // Hold back enough to cover the longest marker arriving in pieces.
        const target = final ? clean.length : Math.max(0, clean.length - 24);
        if (target > emitted) {
          emit(clean.slice(emitted, target));
          emitted = target;
        }
      };

      try {
        let reply = "";
        let lastErr: unknown = null;
        for (const cfg of cfgs) {
          try {
            reply = await generate({
              provider: cfg.provider,
              apiKey: cfg.apiKey,
              model: cfg.model,
              system,
              history: recent.map((m) => ({
                role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
                content: m.content,
              })),
              parts: [
                ...images.map((im) => ({ type: "file" as const, mime: im.mime, base64: im.base64, name: im.name })),
                { type: "text", text: message || "Please look at the attached image." },
              ],
              maxTokens: 8000,
              signal: AbortSignal.timeout(4 * 60 * 1000),
              onText: (chunk) => {
                full += chunk;
                flush(false);
              },
            });
            break;
          } catch (e) {
            lastErr = e;
            if (e instanceof Error && /reach|quota|rate limit|timed out|rejected|not valid|no longer offers/i.test(e.message)) {
              continue;
            }
            break;
          }
        }
        if (!reply) {
          throw lastErr instanceof AiError ? lastErr : new AiError("The tutor could not answer. Try again.");
        }
        full = reply;
        flush(true);

        const clean = stripBlocks(reply);
        await db.insert(tutorMessages).values({ chatId, role: "assistant", content: clean });
        const actions = parseActions(reply);
        const results = await applyActions(actions);
        // Only fall back to the memory fence for notes the actions did not already save.
        const acted = new Set(actions.filter((a) => a.op === "memory.upsert").map((a) => str(a.content)));
        for (const m of parseMemory(reply)) {
          if (acted.has(m.content)) continue;
          const dup = await db.select({ id: tutorMemory.id }).from(tutorMemory).where(eq(tutorMemory.content, m.content)).limit(1);
          if (dup.length === 0) await db.insert(tutorMemory).values({ kind: m.kind, content: m.content });
        }
        await db.update(tutorChats).set({ lastActiveAt: new Date() }).where(eq(tutorChats.id, chatId));
        controller.close();
      } catch (e) {
        const msg = e instanceof AiError ? e.message : `The tutor failed: ${(e as Error)?.message ?? "unknown error"}`;
        console.error("[tutor]", e);
        emit(`\n\n[The tutor stopped: ${msg}]`);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
