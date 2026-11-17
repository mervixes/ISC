import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "katex/dist/katex.min.css";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: { default: "Marked — ISC papers, marked without mercy", template: "%s · Marked" },
  description:
    "Sit an ISC paper against the clock, photograph your answers, and get them marked the way a board examiner would, with a running record of what you do not know yet.",
};

export const viewport: Viewport = {
  themeColor: "#faf8f3",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <Nav />
        <main className="mx-auto w-full max-w-5xl px-5 pb-24 sm:px-8">{children}</main>
        <footer className="mx-auto w-full max-w-5xl border-t border-line px-5 py-8 text-sm text-muted sm:px-8">
          Marking follows the conventions in CISCE&rsquo;s published ISC marking schemes and examiner comments. It is a
          strict estimate from an AI model, not an official result.
        </footer>
      </body>
    </html>
  );
}
