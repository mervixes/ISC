import { db } from "@/db";
import { attempts } from "@/db/schema";
import { subjectByName } from "@/lib/isc";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
  const minutes = Math.round(Number(body.timeAllowedMin));
  const marksRaw = body.totalMarks === null || body.totalMarks === "" ? null : Math.round(Number(body.totalMarks));

  if (!subjectByName(subject)) return Response.json({ error: "Choose one of the six subjects." }, { status: 400 });
  if (!title) return Response.json({ error: "Give the paper a name." }, { status: 400 });
  if (!Number.isFinite(minutes) || minutes < 5 || minutes > 600) {
    return Response.json({ error: "Time allowed must be between 5 and 600 minutes." }, { status: 400 });
  }
  if (marksRaw !== null && (!Number.isFinite(marksRaw) || marksRaw < 1 || marksRaw > 500)) {
    return Response.json({ error: "Total marks must be between 1 and 500, or left blank." }, { status: 400 });
  }

  const [row] = await db
    .insert(attempts)
    .values({ subject, title, timeAllowedMin: minutes, totalMarks: marksRaw })
    .returning({ id: attempts.id });
  return Response.json({ id: row.id });
}
