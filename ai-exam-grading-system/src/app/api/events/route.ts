import { db } from "@/db";
import { events } from "@/db/schema";
import { subjectByKey } from "@/lib/isc";
import { EVENT_KINDS, type EventKind } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body: Record<string, unknown> = (await req.json().catch(() => null)) ?? {};
  const day = typeof body.day === "string" ? body.day : "";
  const kind = typeof body.kind === "string" ? body.kind : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 140) : "";
  const subject = typeof body.subject === "string" ? body.subject : "";

  const validDay = /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`));
  if (!validDay) return Response.json({ error: "Pick a valid date." }, { status: 400 });
  if (!(EVENT_KINDS as readonly string[]).includes(kind)) {
    return Response.json({ error: "Choose what kind of event this is." }, { status: 400 });
  }
  if (!title) return Response.json({ error: "Give the event a name." }, { status: 400 });
  if (subject && !subjectByKey(subject)) return Response.json({ error: "Unknown subject." }, { status: 400 });

  const [row] = await db
    .insert(events)
    .values({ day, kind: kind as EventKind, title, subject })
    .returning();
  return Response.json({ event: row });
}
