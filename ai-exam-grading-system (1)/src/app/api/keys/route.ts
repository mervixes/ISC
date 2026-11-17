import { addKey, listKeyRows } from "@/lib/keys";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ keys: await listKeyRows() });
}

/** Body: { apiKey }. Nothing else is asked for: provider and model are detected. */
export async function POST(req: Request) {
  const body: Record<string, unknown> = (await req.json().catch(() => null)) ?? {};
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
  const result = await addKey(apiKey);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ key: result.row });
}
