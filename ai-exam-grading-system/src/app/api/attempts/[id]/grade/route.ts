import { after } from "next/server";
import { loadAttempt, parseId } from "@/lib/attempts";
import { startGrading } from "@/lib/grader";

export const dynamic = "force-dynamic";
// Marking a full paper takes minutes. On Vercel this needs a plan that allows long functions
// and fluid compute, otherwise the job is cut off mid-report.
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return Response.json({ error: "Paper not found." }, { status: 404 });
  const result = await startGrading(id);
  if (!result.ok) {
    return Response.json({ error: result.error, code: result.code }, { status: 400 });
  }
  // Keeps the function alive on Vercel until marking finishes; locally it is a plain promise.
  after(async () => {
    await result.task;
  });
  const a = await loadAttempt(id);
  return Response.json(a);
}
