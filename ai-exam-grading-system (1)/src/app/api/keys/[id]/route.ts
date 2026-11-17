import { parseId } from "@/lib/attempts";
import { deleteKey, updateKey } from "@/lib/keys";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return Response.json({ error: "Key not found." }, { status: 404 });
  const body: Record<string, unknown> = (await req.json().catch(() => null)) ?? {};
  const action = body.action;
  if (action !== "top" && action !== "verify") {
    return Response.json({ error: "Unknown action." }, { status: 400 });
  }
  const row = await updateKey(id, action);
  return row ? Response.json({ key: row }) : Response.json({ error: "Key not found." }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return Response.json({ error: "Key not found." }, { status: 404 });
  await deleteKey(id);
  return Response.json({ ok: true });
}
