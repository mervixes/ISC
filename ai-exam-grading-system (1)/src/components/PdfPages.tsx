"use client";

import { useEffect, useRef, useState } from "react";

const WORKER = "/pdf.worker.min.mjs";
/** Safety limit so a 200-page upload cannot exhaust browser memory. */
const MAX_PAGES = 40;

interface Props {
  url: string;
  name: string;
  /** Render at this width in CSS pixels. */
  width?: number;
}

type State =
  | { kind: "loading"; page: number; total: number }
  | { kind: "ready"; pages: string[]; truncated: boolean }
  | { kind: "error"; message: string };

/**
 * Renders a PDF to images with pdf.js. Works in every browser, including ones whose
 * embedded PDF viewer is disabled or blocked (Opera, and browsers with plugins off).
 */
export default function PdfPages({ url, name, width = 1100 }: Props) {
  const [state, setState] = useState<State>({ kind: "loading", page: 0, total: 0 });
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    let task: { destroy: () => void } | null = null;

    async function render() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = WORKER;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`the file could not be fetched (HTTP ${res.status})`);
        const data = new Uint8Array(await res.arrayBuffer());
        const loadingTask = pdfjs.getDocument({ data });
        task = loadingTask;
        const doc = await loadingTask.promise;
        const total = doc.numPages;
        const count = Math.min(total, MAX_PAGES);
        const pages: string[] = [];

        for (let i = 1; i <= count; i++) {
          if (cancelled.current) return;
          setState({ kind: "loading", page: i, total });
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = Math.max(0.5, Math.min(3, width / base.width));
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("your browser could not create a drawing surface");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          // Keep the page as a compact image and release the canvas memory.
          pages.push(canvas.toDataURL("image/jpeg", 0.82));
          canvas.width = 0;
          canvas.height = 0;
          page.cleanup();
          if (!cancelled.current) setState({ kind: "loading", page: i, total });
        }
        if (!cancelled.current) setState({ kind: "ready", pages, truncated: total > count });
      } catch (e) {
        if (!cancelled.current) {
          setState({
            kind: "error",
            message: e instanceof Error ? e.message : "the file could not be rendered",
          });
        }
      }
    }

    void render();
    return () => {
      cancelled.current = true;
      try {
        task?.destroy();
      } catch {
        /* already gone */
      }
    };
  }, [url, width]);

  if (state.kind === "error") {
    return (
      <div className="card flex flex-col items-center px-6 py-14 text-center">
        <p className="font-medium">This PDF could not be rendered here.</p>
        <p className="mt-2 max-w-md text-sm text-muted">
          {name}: {state.message}. The file itself is fine — open it in a new tab to read it.
        </p>
        <a href={url} target="_blank" rel="noreferrer" className="btn btn-primary mt-6">
          Open {name}
        </a>
      </div>
    );
  }

  if (state.kind === "loading") {
    return (
      <div className="card flex flex-col items-center px-6 py-14 text-center" aria-live="polite">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-pen" aria-hidden="true" />
        <p className="mt-4 font-medium">
          {state.total > 0 ? `Rendering page ${state.page} of ${state.total}` : "Opening the paper"}
        </p>
        <p className="mt-1 text-sm text-muted">
          Drawn here rather than in a PDF plugin, so it works in every browser.
        </p>
        <a href={url} target="_blank" rel="noreferrer" className="link mt-4 text-sm text-soft">
          Open in a new tab instead
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {state.pages.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={src}
          alt={`${name}, page ${i + 1}`}
          className="w-full rounded-xl border border-line bg-card"
        />
      ))}
      {state.truncated && (
        <p className="rounded-xl bg-wash px-4 py-3 text-sm text-soft">
          Only the first {MAX_PAGES} pages are shown here.{" "}
          <a className="link text-ink" href={url} target="_blank" rel="noreferrer">
            Open the full document
          </a>
          .
        </p>
      )}
    </div>
  );
}
