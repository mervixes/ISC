import katex from "katex";
import { Fragment, type ReactNode } from "react";

// Inline fractions, integrals and sums are set at full size; KaTeX's default text style makes them too small to read.
const TALL = /\\(?:frac|int|sum|prod|lim|sqrt)(?![a-zA-Z])/;

function math(tex: string, display: boolean): string | null {
  try {
    const src = !display && TALL.test(tex) ? `\\displaystyle ${tex}` : tex;
    return katex.renderToString(src, { throwOnError: false, displayMode: display, strict: "ignore" });
  } catch {
    return null;
  }
}

const TOKEN = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\*\*[^*\n]+?\*\*)/g;

function render(text: string, depth = 0): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (!part) return null;
    if (part.length > 4 && part.startsWith("$$") && part.endsWith("$$")) {
      const html = math(part.slice(2, -2), true);
      return html ? <span key={i} dangerouslySetInnerHTML={{ __html: html }} /> : <Fragment key={i}>{part}</Fragment>;
    }
    if (part.length > 2 && part.startsWith("$") && part.endsWith("$")) {
      const html = math(part.slice(1, -1), false);
      return html ? <span key={i} dangerouslySetInnerHTML={{ __html: html }} /> : <Fragment key={i}>{part}</Fragment>;
    }
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**") && depth === 0) {
      return (
        <strong key={i} className="font-semibold">
          {render(part.slice(2, -2), 1)}
        </strong>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Renders model-written text: $inline maths$, $$display maths$$, **bold**, and line breaks. */
export default function Rich({ text, className = "" }: { text: string; className?: string }) {
  if (!text) return null;
  return <span className={`rich whitespace-pre-line ${className}`}>{render(text)}</span>;
}
