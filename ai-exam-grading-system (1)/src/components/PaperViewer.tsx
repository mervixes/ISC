import { fmtBytes } from "@/lib/format";
import type { FileMeta } from "@/lib/types";
import PdfPages from "./PdfPages";

/**
 * Shows uploaded files inline. PDFs are drawn page by page with pdf.js rather than in an
 * embedded viewer, so the paper shows up in browsers that block PDF plugins (Opera among them).
 */
export default function PaperViewer({ files }: { files: FileMeta[] }) {
  if (files.length === 0) {
    return <p className="text-sm text-muted">No files attached.</p>;
  }
  return (
    <div className="space-y-6">
      {files.map((f, i) =>
        f.mime === "application/pdf" ? (
          <div key={f.id}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-muted">
                {f.name} · {fmtBytes(f.size)}
              </p>
              <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm shrink-0">
                Open in a new tab
              </a>
            </div>
            <PdfPages url={`/api/files/${f.id}`} name={f.name} />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={f.id}
            src={`/api/files/${f.id}`}
            alt={`Page ${i + 1}: ${f.name}`}
            loading={i < 2 ? "eager" : "lazy"}
            className="w-full rounded-xl border border-line bg-card"
          />
        ),
      )}
    </div>
  );
}
