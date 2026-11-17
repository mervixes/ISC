import { eq } from "drizzle-orm";
import { db } from "@/db";
import { resources } from "@/db/schema";
import { parseId } from "@/lib/attempts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return new Response("Not found", { status: 404 });
  const [r] = await db.select().from(resources).where(eq(resources.id, id));
  if (!r) return new Response("Not found", { status: 404 });
  const bytes = new Uint8Array(Buffer.from(r.data, "base64"));
  return new Response(bytes, {
    headers: {
      "content-type": r.mime,
      "content-length": String(bytes.byteLength),
      "content-disposition": `inline; filename="${encodeURIComponent(r.name)}"`,
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return Response.json({ error: "Not found." }, { status: 404 });
  await db.delete(resources).where(eq(resources.id, id));
  return Response.json({ ok: true });
}
