import { db } from "@/db";
import { resources } from "@/db/schema";
import { subjectByKey } from "@/lib/isc";
import { RESOURCE_KINDS, type ResourceKind } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const fail = (error: string) => Response.json({ error }, { status: 400 });

/** Body (multipart): subject (key), kind, file. */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Upload failed. The file may be too large.");
  }
  const subject = String(form.get("subject") ?? "");
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");

  if (!subjectByKey(subject)) return fail("Choose a subject.");
  if (!(RESOURCE_KINDS as readonly string[]).includes(kind)) return fail("Choose what kind of material this is.");
  if (!(file instanceof File) || file.size === 0) return fail("No file received.");
  if (!TYPES.includes(file.type)) return fail("Upload a PDF or a JPG, PNG or WebP image.");
  if (file.size > MAX_BYTES) return fail("That file is over 4 MB, which is the upload limit. Compress it, or upload photos of the pages.");

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const [row] = await db
    .insert(resources)
    .values({
      subject,
      kind: kind as ResourceKind,
      name: (file.name || "reference").slice(0, 200),
      mime: file.type,
      size: file.size,
      data,
    })
    .returning({
      id: resources.id,
      subject: resources.subject,
      kind: resources.kind,
      name: resources.name,
      mime: resources.mime,
      size: resources.size,
    });
  return Response.json({ resource: row });
}
