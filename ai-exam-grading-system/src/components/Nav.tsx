"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard", match: (p: string) => p === "/" },
  {
    href: "/papers",
    label: "Papers",
    match: (p: string) => p.startsWith("/papers") || p.startsWith("/attempt") || p.startsWith("/new"),
  },
  { href: "/analysis", label: "Analysis", match: (p: string) => p.startsWith("/analysis") },
  { href: "/mistakes", label: "Mistakes", match: (p: string) => p.startsWith("/mistakes") },
  { href: "/tutor", label: "Tutor", match: (p: string) => p.startsWith("/tutor") },
  { href: "/practice", label: "Practice", match: (p: string) => p.startsWith("/practice") },
  { href: "/types", label: "Types", match: (p: string) => p.startsWith("/types") },
  { href: "/vault", label: "Vault", match: (p: string) => p.startsWith("/vault") },
  { href: "/engine", label: "Engine", match: (p: string) => p.startsWith("/engine") },
  { href: "/knowledge", label: "Knowledge", match: (p: string) => p.startsWith("/knowledge") },
  { href: "/library", label: "Library", match: (p: string) => p.startsWith("/library") },
  { href: "/keys", label: "API keys", match: (p: string) => p.startsWith("/keys") },
];

export default function Nav() {
  const pathname = usePathname() ?? "/";
  return (
    <header className="mx-auto w-full max-w-5xl px-5 sm:px-8">
      <div className="flex flex-col gap-3 py-4 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-0">
        <Link
          href="/"
          className="w-fit rounded font-serif text-[28px] leading-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
          aria-label="Marked, home"
        >
          Marked<span className="text-pen">.</span>
        </Link>
        <nav
          aria-label="Main"
          className="-mx-1 flex min-w-0 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex gap-0.5">
            {LINKS.map((l) => {
              const active = l.match(pathname);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex h-9 shrink-0 items-center rounded-full px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ink ${
                    active ? "bg-wash font-medium text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}
