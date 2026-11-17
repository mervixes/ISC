import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tutorAttachments } from "@/db/schema";
import { parseId } from "@/lib/attempts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return new Response("Not found", { status: 404 });
  const [a] = await db.select().from(tutorAttachments).where(eq(tutorAttachments.id, id));
  if (!a) return new Response("Not found", { status: 404 });
  const bytes = new Uint8Array(Buffer.from(a.data, "base64"));
  return new Response(bytes, {
    headers: { "content-type": a.mime, "content-length": String(bytes.byteLength), "cache-control": "private, max-age=86400" },
  });
}
