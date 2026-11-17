import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { questionBank } from "@/db/schema";
import { extractQuestions } from "@/lib/extract";
import { parseId } from "@/lib/attempts";
import { chapterWeight, canonicalChapter } from "@/lib/qtypes";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Every stored question from uploaded papers, newest paper first. */
export async function GET() {
  const rows = await db.select().from(questionBank).orderBy(desc(questionBank.createdAt), asc(questionBank.number));
  return Response.json({
    questions: rows.map((r) => ({
      id: r.id,
      attemptId: r.attemptId,
      subject: r.subject,
      chapter: r.chapter,
      number: r.number,
      section: r.section,
      marks: r.marks,
      text: r.text,
      sourceName: r.sourceName,
    })),
  });
}

/**
 * Reads a paper's PDF and stores its questions. Works for a live paper and for one already in the
 * recycle bin, which is the point: the question paper outlives the attempt.
 */
export async function POST(req: Request) {
  const body: Record<string, unknown> = (await req.json().catch(() => null)) ?? {};
  const id = parseId(String(body.attempt ?? ""));
  if (!id) return Response.json({ error: "Which paper?" }, { status: 400 });
  const result = await extractQuestions(id);
  if (!result.fromPdf) {
    return Response.json(
      { error: "That paper has no readable PDF. Photos of the pages cannot be turned into questions." },
      { status: 400 },
    );
  }
  if (result.added === 0) {
    return Response.json(
      { error: "No numbered questions were found in that PDF. It may use a different layout, or only contain an answer key." },
      { status: 400 },
    );
  }
  return Response.json({ added: result.added });
}

/** Deletes stored questions for a paper. */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = parseId(url.searchParams.get("attempt") ?? "");
  if (!id) return Response.json({ error: "Which paper?" }, { status: 400 });
  await db.delete(questionBank).where(eq(questionBank.attemptId, id));
  return Response.json({ ok: true });
}
