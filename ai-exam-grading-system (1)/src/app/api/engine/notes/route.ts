import { addEngineNote, engineNoteStats, listEngineNotes } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ notes: await listEngineNotes(), stats: await engineNoteStats() });
}

/** Adds a note by hand. */
export async function POST(req: Request) {
  const body: Record<string, unknown> = (await req.json().catch(() => null)) ?? {};
  const kind = typeof body.kind === "string" ? body.kind : "";
  const content = typeof body.content === "string" ? body.content : "";
  if (!content.trim()) return Response.json({ error: "Write something first." }, { status: 400 });
  await addEngineNote(kind, content, "student");
  return Response.json({ ok: true });
}
