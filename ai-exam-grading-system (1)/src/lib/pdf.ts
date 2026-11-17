import type { AiPart } from "./ai";

/** Rendered page image of a PDF. */
export interface PdfPage {
  page: number;
  mime: "image/jpeg";
  base64: string;
}

/** Providers whose chat API accepts images but not PDF documents. */
const IMAGE_ONLY = new Set(["nvidia"]);

export function acceptsPdf(provider: string): boolean {
  return !IMAGE_ONLY.has(provider);
}

interface RenderOptions {
  maxPages?: number;
  /** Target width in CSS pixels. */
  width?: number;
  quality?: number;
}

const g = globalThis as typeof globalThis & {
  __pdfjs?: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
};

async function pdfjs() {
  if (!g.__pdfjs) {
    const canvasMod = await import("@napi-rs/canvas");
    // pdf.js expects these browser globals when it renders in Node.
    const gt = globalThis as Record<string, unknown>;
    gt.DOMMatrix ??= canvasMod.DOMMatrix;
    gt.Path2D ??= canvasMod.Path2D;
    g.__pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return g.__pdfjs;
}

/**
 * Renders a PDF to JPEG pages. Used when the chosen provider cannot read PDF documents,
 * so a PDF question paper or syllabus still reaches the model as images.
 */
export async function pdfToImages(base64: string, opts: RenderOptions = {}): Promise<PdfPage[]> {
  const maxPages = opts.maxPages ?? 24;
  const width = opts.width ?? 1200;
  const quality = opts.quality ?? 0.8;

  const mod = await pdfjs();
  const { createCanvas } = await import("@napi-rs/canvas");
  const data = new Uint8Array(Buffer.from(base64, "base64"));

  const task = mod.getDocument({ data, useSystemFonts: true, disableFontFace: true });
  const doc = await task.promise;

  const out: PdfPage[] = [];
  try {
    const count = Math.min(doc.numPages, maxPages);
    for (let i = 1; i <= count; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.max(0.5, Math.min(3, width / base.width));
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      // pdf.js expects a DOM canvas; the napi canvas is API-compatible.
      await page.render({
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
        canvas: canvas as unknown as HTMLCanvasElement,
      }).promise;
      out.push({ page: i, mime: "image/jpeg", base64: canvas.toBuffer("image/jpeg", quality).toString("base64") });
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
  } finally {
    task.destroy();
  }
  return out;
}

/**
 * Extracts the text of a PDF. Cheaper and far more reliable than sending page images to
 * providers whose image screening may reject a 19-page paper.
 */
export async function pdfToText(base64: string, opts: { maxChars?: number } = {}): Promise<string> {
  const maxChars = opts.maxChars ?? 60_000;
  const mod = await pdfjs();
  const data = new Uint8Array(Buffer.from(base64, "base64"));
  const task = mod.getDocument({ data, useSystemFonts: true, disableFontFace: true });
  const doc = await task.promise;
  const chunks: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const line = content.items
        .map((it) => ("str" in it ? it.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (line) chunks.push(`[page ${i}] ${line}`);
      page.cleanup();
      if (chunks.join("\n").length > maxChars) break;
    }
  } finally {
    task.destroy();
  }
  return chunks.join("\n").slice(0, maxChars);
}

/** Replaces PDF parts with their extracted text, for providers that cannot read PDF documents. */
export async function pdfPartsToText(parts: AiPart[], opts: { maxCharsPerFile?: number } = {}): Promise<AiPart[]> {
  const out: AiPart[] = [];
  for (const p of parts) {
    if (p.type !== "file" || p.mime !== "application/pdf") {
      out.push(p);
      continue;
    }
    let text = "";
    try {
      text = await pdfToText(p.base64, { maxChars: opts.maxCharsPerFile ?? 45_000 });
    } catch {
      text = "";
    }
    out.push({
      type: "text",
      text: text
        ? `${p.name}, as text (this provider cannot read PDF files):\n"""\n${text}\n"""`
        : `${p.name}: the text could not be extracted, and this provider cannot read the PDF itself.`,
    });
  }
  return out;
}

/** Expands PDF parts into image parts for providers that cannot read PDFs. */
export async function expandPdfParts(
  parts: AiPart[],
  opts: { perFileMaxPages?: number; width?: number },
): Promise<AiPart[]> {
  const out: AiPart[] = [];
  for (const p of parts) {
    if (p.type !== "file" || p.mime !== "application/pdf") {
      out.push(p);
      continue;
    }
    let pages: PdfPage[];
    try {
      pages = await pdfToImages(p.base64, { maxPages: opts.perFileMaxPages ?? 24, width: opts.width ?? 1200 });
    } catch (e) {
      throw new Error(
        `Could not convert the PDF "${p.name}" into images: ${(e as Error)?.message ?? "unknown error"}`,
      );
    }
    if (pages.length === 0) continue;
    out.push({
      type: "text",
      text: `${p.name}, shown as ${pages.length} page image(s) because this provider cannot read PDF files.`,
    });
    for (const pg of pages) {
      out.push({ type: "file", mime: pg.mime, base64: pg.base64, name: `${p.name} page ${pg.page}` });
    }
  }
  return out;
}
