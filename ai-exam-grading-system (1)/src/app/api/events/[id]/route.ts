import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { parseId } from "@/lib/attempts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return Response.json({ error: "Event not found." }, { status: 404 });
  await db.delete(events).where(eq(events.id, id));
  return Response.json({ ok: true });
}
