import type { FileMeta } from "./types";

const MAX_EDGE = 2000;
const QUALITY = 0.82;

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(`Could not read "${file.name}". Use a JPG or PNG photo.`);
  }
}

/**
 * Photos straight off a phone are 4–10 MB. Downscale to a size vision models read well,
 * bake in the EXIF rotation, and re-encode as JPEG. PDFs pass through untouched.
 */
export async function prepareFile(file: File): Promise<File> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return file.type ? file : new File([file], file.name, { type: "application/pdf" });
  }
  const { source, width, height, close } = await decode(file);
  try {
    if (!width || !height) throw new Error(`"${file.name}" is not a readable image.`);
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not process the image.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob) throw new Error(`Could not process "${file.name}".`);
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } finally {
    close();
  }
}

export async function uploadFile(attemptId: number, kind: "paper" | "answer", file: File): Promise<FileMeta> {
  const ready = await prepareFile(file);
  const form = new FormData();
  form.set("kind", kind);
  form.set("file", ready, ready.name);
  let res: Response;
  try {
    res = await fetch(`/api/attempts/${attemptId}/files`, { method: "POST", body: form });
  } catch {
    throw new Error(`Upload of "${file.name}" failed. Check your connection and try again.`);
  }
  const j = (await res.json().catch(() => null)) as (FileMeta & { error?: string }) | null;
  if (!res.ok || !j) throw new Error(j?.error ?? `Upload of "${file.name}" failed.`);
  return j;
}
