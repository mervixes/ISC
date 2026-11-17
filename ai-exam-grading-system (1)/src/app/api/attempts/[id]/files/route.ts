import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { attempts, files } from "@/db/schema";
import { parseId } from "@/lib/attempts";
import { extractQuestions } from "@/lib/extract";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE = 6 * 1024 * 1024;
const MAX_PDF = 4 * 1024 * 1024;
const MAX_FILES: Record<string, number> = { paper: 30, answer: 60 };

export async function POST(req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return Response.json({ error: "Paper not found." }, { status: 404 });

  const [a] = await db.select({ status: attempts.status }).from(attempts).where(eq(attempts.id, id));
  if (!a) return Response.json({ error: "Paper not found." }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Upload failed. The file may be too large." }, { status: 400 });
  }
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");
  if (kind !== "paper" && kind !== "answer") {
    return Response.json({ error: "Unknown upload type." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "No file received." }, { status: 400 });
  }
  if (a.status === "grading") {
    return Response.json({ error: "This paper is being marked. Wait for it to finish." }, { status: 409 });
  }

  const isPdf = file.type === "application/pdf";
  const isImage = IMAGE_TYPES.includes(file.type);
  if (kind === "answer" && !isImage) {
    return Response.json({ error: "Answers must be photos (JPG, PNG or WebP)." }, { status: 400 });
  }
  if (!isPdf && !isImage) {
    return Response.json({ error: "Upload a PDF or a JPG, PNG or WebP image." }, { status: 400 });
  }
  if (isPdf && file.size > MAX_PDF) {
    return Response.json({ error: "That PDF is over 4 MB, which is the upload limit. Split it, compress it, or upload photos of the pages." }, { status: 400 });
  }
  if (isImage && file.size > MAX_IMAGE) {
    return Response.json({ error: "That image is over 6 MB." }, { status: 400 });
  }

  const [{ n, pos }] = await db
    .select({ n: sql<number>`count(*)::int`, pos: sql<number>`coalesce(max(${files.position}), 0)::int` })
    .from(files)
    .where(and(eq(files.attemptId, id), eq(files.kind, kind)));
  if (n >= MAX_FILES[kind]) {
    return Response.json({ error: `You can attach at most ${MAX_FILES[kind]} files here.` }, { status: 400 });
  }

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const [row] = await db
    .insert(files)
    .values({
      attemptId: id,
      kind,
      name: (file.name || (isPdf ? "paper.pdf" : "page.jpg")).slice(0, 200),
      mime: file.type,
      size: file.size,
      position: pos + 1,
      data,
    })
    .returning({ id: files.id, kind: files.kind, name: files.name, mime: files.mime, size: files.size });

  // A PDF question paper is read straight away so its questions reach the practice bank.
  // Failure is not fatal: the upload stands, and extraction can be run again later.
  if (kind === "paper" && isPdf) {
    try {
      await extractQuestions(id);
    } catch (e) {
      console.error(`[extract] attempt ${id}:`, e);
    }
  }
  return Response.json(row);
}
