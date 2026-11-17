import { eq } from "drizzle-orm";
import { db } from "@/db";
import { insights } from "@/db/schema";
import { parseId } from "@/lib/attempts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return Response.json({ error: "Not found." }, { status: 404 });
  await db.delete(insights).where(eq(insights.id, id));
  return Response.json({ ok: true });
}
