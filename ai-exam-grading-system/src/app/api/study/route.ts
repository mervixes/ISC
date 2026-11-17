import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { studyLog } from "@/db/schema";
import { parseId } from "@/lib/attempts";
import { computeStudyPlan, isKnownChapter } from "@/lib/study";

export const dynamic = "force-dynamic";

/** The current three picks. `?debug=1` adds every chapter's score and how report units were matched. */
export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.get("debug") === "1";
  return Response.json(await computeStudyPlan({ debug }));
}

/**
 * done: the chapter is finished and rests for a week (longer each time).
 * skip: hide it for two days without counting it as studied.
 * undo: revoke a done or skip. The row is kept and stamped, never deleted.
 */
export async function POST(req: Request) {
  const body: Record<string, unknown> = (await req.json().catch(() => null)) ?? {};
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "undo") {
    const id = parseId(String(body.id ?? ""));
    if (!id) return Response.json({ error: "Nothing to undo." }, { status: 400 });
    await db
      .update(studyLog)
      .set({ revokedAt: new Date() })
      .where(and(eq(studyLog.id, id), isNull(studyLog.revokedAt)));
    return Response.json(await computeStudyPlan());
  }

  if (action !== "done" && action !== "skip") {
    return Response.json({ error: "Unknown action." }, { status: 400 });
  }
  const subject = typeof body.subject === "string" ? body.subject : "";
  const chapter = typeof body.chapter === "string" ? body.chapter : "";
  if (!isKnownChapter(subject, chapter)) {
    return Response.json({ error: "That chapter is not in the syllabus list." }, { status: 400 });
  }

  const [row] = await db.insert(studyLog).values({ subject, chapter, action }).returning({ id: studyLog.id });
  const plan = await computeStudyPlan();
  return Response.json({ ...plan, logId: row.id });
}
