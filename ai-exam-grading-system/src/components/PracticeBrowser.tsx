"use client";

import { useMemo, useState } from "react";
import Rich from "./Rich";

export interface PracticeItem {
  subject: string;
  n: string;
  section: string;
  marks: number | null;
  chapter: string;
  text: string;
  source: string;
  sourceId: number | null;
  weightage: number;
  isMistake: boolean;
  isHigh: boolean;
  isEasy: boolean;
}

type Mode = "all" | "mistakes" | "high" | "easy";

const MODES: { key: Mode; label: string; blurb: string }[] = [
  { key: "all", label: "All questions", blurb: "The whole specimen bank." },
  { key: "mistakes", label: "My mistakes", blurb: "Chapters where your marked papers show losses." },
  { key: "high", label: "High weightage", blurb: "Chapters worth the most marks in the syllabus." },
  { key: "easy", label: "Easy marks", blurb: "Short questions. Quick wins to bank marks." },
];

export default function PracticeBrowser({
  questions,
  subjects,
  initialSubject,
  initialChapter,
}: {
  questions: PracticeItem[];
  subjects: string[];
  initialSubject?: string;
  initialChapter?: string;
}) {
  const [mode, setMode] = useState<Mode>("all");
  const [subject, setSubject] = useState(initialSubject && subjects.includes(initialSubject) ? initialSubject : "All");
  const [query, setQuery] = useState(initialChapter ?? "");
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return questions.filter((q) => {
      if (subject !== "All" && q.subject !== subject) return false;
      if (mode === "mistakes" && !q.isMistake) return false;
      if (mode === "high" && !q.isHigh) return false;
      if (mode === "easy" && !q.isEasy) return false;
      if (needle && !`${q.text} ${q.chapter}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [questions, mode, subject, query]);

  const groups = useMemo(() => {
    const map = new Map<string, PracticeItem[]>();
    for (const q of list) {
      const k = `${q.subject} · ${q.chapter}`;
      const arr = map.get(k) ?? [];
      arr.push(q);
      map.set(k, arr);
    }
    return [...map.entries()].sort((a, b) => (b[1][0]?.weightage ?? 0) - (a[1][0]?.weightage ?? 0));
  }, [list]);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Practice mode">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={mode === m.key}
            onClick={() => setMode(m.key)}
            className={`inline-flex h-10 items-center rounded-full px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ink ${
              mode === m.key ? "bg-ink font-medium text-paper" : "border border-line bg-card text-soft hover:bg-wash"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">{MODES.find((m) => m.key === mode)?.blurb}</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-full border border-line bg-card p-1" role="group" aria-label="Subject">
          {["All", ...subjects].map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={subject === s}
              onClick={() => setSubject(s)}
              className={`h-8 rounded-full px-3.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ink ${
                subject === s ? "bg-ink font-medium text-paper" : "text-muted hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <label className="min-w-[220px] flex-1">
          <span className="sr-only">Search questions</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a topic…"
            className="input"
          />
        </label>
      </div>

      <p className="mt-6 text-sm text-muted">
        {list.length} question{list.length === 1 ? "" : "s"}
      </p>

      <div className="mt-4 space-y-10">
        {groups.map(([chapter, items]) => (
          <section key={chapter}>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="display text-3xl">{chapter}</h2>
              {items[0]?.weightage > 0 && (
                <span className="text-sm text-muted">about {Math.round(items[0].weightage)} marks in the paper</span>
              )}
            </div>
            <ol className="mt-4 space-y-3">
              {items.map((q) => {
                const key = `${q.subject}-${q.n}-${q.text.slice(0, 20)}`;
                const isOpen = open === key;
                return (
                  <li key={key} className="card p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted">
                        Q{q.n}
                        {q.section ? ` · Section ${q.section}` : ""}
                        {q.marks ? ` · ${q.marks} marks` : ""}
                      </span>
                      {q.isMistake && (
                        <span className="inline-flex h-6 items-center rounded-full bg-pen-wash px-2.5 text-xs font-medium text-pen">
                          Your weak chapter
                        </span>
                      )}
                      {q.isHigh && (
                        <span className="inline-flex h-6 items-center rounded-full bg-wash px-2.5 text-xs font-medium text-soft">
                          High weightage
                        </span>
                      )}
                      {q.sourceId && (
                        <span className="inline-flex h-6 items-center rounded-full bg-pass-wash px-2.5 text-xs font-medium text-pass">
                          From your paper
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : key)}
                        aria-expanded={isOpen}
                        className="ml-auto text-sm font-medium text-muted hover:text-ink"
                      >
                        {isOpen ? "Hide" : "Read"}
                      </button>
                    </div>
                    {isOpen && (
                      <>
                        <p className="mt-3 text-[15px] leading-relaxed text-soft">
                          <Rich text={q.text} />
                        </p>
                        {q.sourceId && (
                          <p className="mt-2 text-sm text-muted">
                            From <span className="text-soft">{q.source}</span>
                            {" · "}
                            <a href={`/attempt/${q.sourceId}`} className="link">
                              open the paper
                            </a>
                          </p>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
        {groups.length === 0 && (
          <p className="card px-6 py-12 text-center text-muted">
            Nothing matches. Mark a paper first and your weak chapters will appear here.
          </p>
        )}
      </div>
    </div>
  );
}
