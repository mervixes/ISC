"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Rich from "./Rich";
import { weightLabel, type ChapterTypes, type QuestionType, type Weight } from "@/lib/qtypes/types";

const WEIGHT_ORDER: Weight[] = ["high", "medium", "low"];
const WEIGHT_BADGE: Record<Weight, string> = {
  high: "bg-pen-wash text-pen",
  medium: "bg-warn-wash text-warn",
  low: "bg-wash text-soft",
};

interface Generated {
  question: string;
  marks: number;
  data?: string;
  scheme: string[];
  answer: string;
  trap: string;
  syllabus: string;
}

function PractisePanel({ subject, chapter, type }: { subject: string; chapter: string; type: QuestionType }) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [q, setQ] = useState<Generated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [model, setModel] = useState<string | null>(null);

  async function generate(e?: FormEvent) {
    e?.preventDefault();
    setState("loading");
    setError(null);
    setShowAnswer(false);
    try {
      const res = await fetch("/api/practice/type", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, chapter, type: type.type, marks: type.marks }),
      });
      const j = (await res.json().catch(() => null)) as { question?: Generated; error?: string; model?: string } | null;
      if (!res.ok || !j?.question) throw new Error(j?.error ?? "Could not generate a question.");
      setQ(j.question);
      setModel(j.model ?? null);
      setState("ready");
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Could not generate a question.");
      setState("error");
    }
  }

  if (state === "idle") {
    return (
      <div className="mt-3 rounded-xl border border-line bg-wash p-4">
        <p className="text-sm text-soft">
          Generate a fresh question of this exact type, built to the syllabus and the board&rsquo;s own style, with the
          marking scheme and a full-mark answer.
        </p>
        <button type="button" onClick={() => void generate()} className="btn btn-primary btn-sm mt-3">
          Practise this type
        </button>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-wash p-4" aria-live="polite">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-pen" aria-hidden="true" />
        <p className="text-sm text-soft">Writing a question of this type…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="mt-3 rounded-xl bg-pen-wash p-4">
        <p className="text-sm text-pen">{error}</p>
        <button type="button" onClick={() => void generate()} className="btn btn-ghost btn-sm mt-3">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="kicker">Your question{model ? ` · ${model}` : ""}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => void generate()} className="text-sm text-muted hover:text-ink">
            New question
          </button>
        </div>
      </div>
      <div className="mt-2 space-y-2 text-[15px] leading-relaxed">
        {q?.data && (
          <p className="rounded-lg bg-wash px-3 py-2 text-soft">
            <Rich text={q.data} />
          </p>
        )}
        <p>
          <Rich text={q?.question ?? ""} />
        </p>
      </div>
      <p className="mt-2 font-mono text-xs text-muted">
        {q?.marks ? `${q.marks} marks` : ""}
        {q?.syllabus ? ` · ${q.syllabus}` : ""}
      </p>
      <button type="button" onClick={() => setShowAnswer((v) => !v)} className="btn btn-ghost btn-sm mt-3">
        {showAnswer ? "Hide the answer" : "Show the marking scheme and answer"}
      </button>
      {showAnswer && q && (
        <div className="mt-3 space-y-3 border-t border-line pt-3 text-[15px]">
          {q.scheme.length > 0 && (
            <div>
              <p className="kicker">How the marks are awarded</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-soft">
                {q.scheme.map((s, i) => (
                  <li key={i}>
                    <Rich text={s} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="kicker">Full-mark answer</p>
            <p className="mt-1 text-soft">
              <Rich text={q.answer} />
            </p>
          </div>
          {q.trap && (
            <p className="border-l-2 border-pen pl-3 text-soft">
              <span className="font-medium text-pen">The usual trap. </span>
              <Rich text={q.trap} />
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ChapterSection({
  subject,
  chapter,
  open,
  onToggle,
}: {
  subject: string;
  chapter: ChapterTypes;
  open: boolean;
  onToggle: () => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <section id={`ch-${chapter.chapter.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`} className="scroll-mt-6 border-b border-line">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-4 text-left focus-visible:outline-2 focus-visible:outline-ink"
      >
        <span className="min-w-0">
          <span className="block font-medium">{chapter.chapter}</span>
          <span className="mt-0.5 block text-sm text-muted">
            {chapter.types.length} question types · about {chapter.weightage} marks in the paper
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`shrink-0 font-serif text-2xl leading-none text-muted transition-transform ${open ? "rotate-45" : ""}`}
        >
          +
        </span>
      </button>
      {open && (
        <div className="pb-6">
          {WEIGHT_ORDER.map((w) => {
            const items = chapter.types.filter((t) => t.weight === w);
            if (items.length === 0) return null;
            return (
              <div key={w} className="mt-4">
                <h3 className="kicker">{weightLabel(w)} weightage</h3>
                <ol className="mt-2 divide-y divide-line">
                  {items.map((t) => {
                    const isActive = active === t.type;
                    return (
                      <li key={t.type} className="py-3">
                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                          <p className="min-w-0 flex-1 font-medium">{t.type}</p>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${WEIGHT_BADGE[w]}`}>
                              {weightLabel(w)}
                            </span>
                            <span className="font-mono text-xs text-muted tabular-nums">{t.marks} marks</span>
                          </span>
                        </div>
                        <p className="mt-1 text-[15px] text-soft">{t.note}</p>
                        <button
                          type="button"
                          onClick={() => setActive(isActive ? null : t.type)}
                          aria-expanded={isActive}
                          className="mt-2 text-sm font-medium text-muted hover:text-ink"
                        >
                          {isActive ? "Close" : "Practise this type →"}
                        </button>
                        {isActive && <PractisePanel subject={subject} chapter={chapter.chapter} type={t} />}
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link href={`/practice?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter.chapter)}`} className="link text-soft">
              Questions of this chapter from your specimen papers
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function TypesBrowser({
  subjects,
  initialSubject,
  initialChapter,
}: {
  subjects: { subject: string; chapters: ChapterTypes[] }[];
  initialSubject?: string;
  initialChapter?: string;
}) {
  const startSubject = subjects.find((s) => s.subject === initialSubject)?.subject ?? subjects[0]?.subject ?? "";
  const startChapter =
    subjects.find((s) => s.subject === startSubject)?.chapters.find((c) => c.chapter === initialChapter)?.chapter ?? null;
  const [subject, setSubject] = useState(startSubject);
  const [open, setOpen] = useState<string | null>(startChapter);

  // Arriving from a dashboard card: scroll to the chapter it named.
  useEffect(() => {
    if (!startChapter) return;
    document.getElementById(`ch-${slug(startChapter)}`)?.scrollIntoView({ block: "start" });
  }, [startChapter]);
  const current = subjects.find((s) => s.subject === subject) ?? subjects[0];
  const totalTypes = current?.chapters.reduce((a, c) => a + c.types.length, 0) ?? 0;

  return (
    <div>
      <nav aria-label="Subjects" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {subjects.map((s) => {
          const on = s.subject === subject;
          return (
            <button
              key={s.subject}
              type="button"
              onClick={() => {
                setSubject(s.subject);
                setOpen(null);
              }}
              aria-current={on ? "page" : undefined}
              className={`inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ink ${
                on ? "bg-ink font-medium text-paper" : "border border-line bg-card text-soft hover:bg-wash"
              }`}
            >
              {s.subject}
            </button>
          );
        })}
      </nav>

      {current && (
        <>
          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="display text-4xl">{current.subject}</h2>
              <p className="mt-1 text-sm text-muted">
                {current.chapters.length} chapters · {totalTypes} question types. Chapters are collapsed; open one to see
                its types from highest to lowest weightage.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(open ? null : "__all")}
              className="btn btn-ghost btn-sm"
            >
              {open ? "Collapse all" : "Expand all"}
            </button>
          </div>

          <div className="mt-5 border-t border-line">
            {current.chapters.map((c) => (
              <ChapterSection
                key={c.chapter}
                subject={current.subject}
                chapter={c}
                open={open === c.chapter || open === "__all"}
                onToggle={() => setOpen((v) => (v === c.chapter || v === "__all" ? null : c.chapter))}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
