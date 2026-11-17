import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attempts, files } from "@/db/schema";
import { parseId } from "@/lib/attempts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return new Response("Not found", { status: 404 });
  const [f] = await db.select().from(files).where(eq(files.id, id));
  if (!f) return new Response("Not found", { status: 404 });
  const bytes = new Uint8Array(Buffer.from(f.data, "base64"));
  return new Response(bytes, {
    headers: {
      "content-type": f.mime,
      "content-length": String(bytes.byteLength),
      "content-disposition": `inline; filename="${encodeURIComponent(f.name)}"`,
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return Response.json({ error: "Not found." }, { status: 404 });
  const [f] = await db
    .select({ attemptId: files.attemptId, status: attempts.status })
    .from(files)
    .innerJoin(attempts, eq(attempts.id, files.attemptId))
    .where(eq(files.id, id));
  if (!f) return Response.json({ ok: true });
  if (f.status === "grading") {
    return Response.json({ error: "This paper is being marked. Wait for it to finish." }, { status: 409 });
  }
  await db.delete(files).where(eq(files.id, id));
  return Response.json({ ok: true });
}
