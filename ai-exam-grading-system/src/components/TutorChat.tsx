"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GraphBlock, { type GraphSpec } from "./GraphBlock";
import Rich from "./Rich";
import { prepareFile } from "@/lib/client-upload";
import { MEMORY_LABEL, type MemoryRow } from "@/lib/tutor-meta";

interface Attachment {
  id?: number;
  mime: string;
  name: string;
  base64?: string;
}

export interface Message {
  id: number | null;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
}

export interface ChatRow {
  id: number;
  title: string;
  archived: boolean;
  lastActiveAt: string;
  turns: number;
}

export interface NoteRow {
  id: number;
  subject: string;
  title: string;
  body: string;
}

const STARTERS = [
  "What is costing me the most marks right now?",
  "Plan my next two weeks and put it on my calendar.",
  "Test me on my weakest chapter.",
  "Write me a note on the topic I keep getting wrong.",
];

type Segment = { kind: "text"; text: string } | { kind: "graph"; spec: GraphSpec } | { kind: "bad-graph"; text?: string };

function segments(text: string): Segment[] {
  const out: Segment[] = [];
  const re = /```graph\s*([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    try {
      out.push({ kind: "graph", spec: JSON.parse(m[1].trim()) as GraphSpec });
    } catch {
      out.push({ kind: "bad-graph" });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

export default function TutorChat({
  chats,
  activeChat,
  initialMessages,
  notes,
  memory,
  hasKey,
}: {
  chats: ChatRow[];
  activeChat: ChatRow | null;
  initialMessages: Message[];
  notes: NoteRow[];
  memory: MemoryRow[];
  hasKey: boolean;
}) {
  const router = useRouter();
  const [chatId, setChatId] = useState<number | null>(activeChat?.id ?? null);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [known, setKnown] = useState<MemoryRow[]>(memory);
  const [studentNotes, setStudentNotes] = useState<NoteRow[]>(notes);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [drawn, setDrawn] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // The message pane scrolls on its own; it only follows the latest message while the student
  // is already at the bottom, so reading back up is never interrupted.
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, busy, drawn]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  async function openChat(id: number) {
    if (busy) return;
    setError(null);
    setChatId(id);
    setDrawn(null);
    try {
      const res = await fetch(`/api/tutor?chat=${id}`, { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as { messages?: Message[]; notes?: NoteRow[]; memory?: MemoryRow[] } | null;
      if (!res.ok || !j) throw new Error(j && "error" in j ? String((j as { error?: string }).error) : "Could not open that chat.");
      setMessages(j.messages ?? []);
      setStudentNotes(j.notes ?? []);
      setKnown(j.memory ?? []);
      router.replace(`/tutor?chat=${id}`, { scroll: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open that chat.");
    }
  }

  async function newChat() {
    if (busy) return;
    setError(null);
    try {
      const res = await fetch("/api/tutor/chats", { method: "POST" });
      const j = (await res.json().catch(() => null)) as { chat?: ChatRow } | null;
      if (!res.ok || !j?.chat) throw new Error("Could not start a new chat.");
      setChatId(j.chat.id);
      setMessages([]);
      setDrawn(null);
      router.replace(`/tutor?chat=${j.chat.id}`, { scroll: false });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start a new chat.");
    }
  }

  async function renameChat(id: number) {
    const title = window.prompt("Name this chat.", chats.find((c) => c.id === id)?.title ?? "");
    if (!title?.trim()) return;
    await fetch("/api/tutor/chats", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, title: title.trim() }),
    });
    router.refresh();
  }

  /** Hides a chat. Its messages stay in the database; nothing is erased. */
  async function archiveChat(id: number, archived: boolean) {
    await fetch("/api/tutor/chats", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, archived }),
    });
    if (chatId === id && archived) {
      setChatId(null);
      setMessages([]);
    }
    router.refresh();
  }

  async function attach(files: File[]) {
    setError(null);
    const next: Attachment[] = [];
    for (const f of files.slice(0, 4 - images.length)) {
      try {
        const ready = await prepareFile(f);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(ready);
        });
        next.push({ mime: "image/jpeg", name: ready.name, base64 });
      } catch {
        setError("That image could not be read. Try a JPG or PNG.");
      }
    }
    setImages((prev) => [...prev, ...next].slice(0, 4));
  }

  async function send(text: string) {
    const message = text.trim();
    if ((!message && images.length === 0) || busy || !chatId) return;
    setError(null);
    setDrawn(null);
    const sent = images;
    setInput("");
    setImages([]);
    setBusy(true);
    stick.current = true;
    setMessages((m) => [...m, { id: null, role: "user", content: message, attachments: sent }, { id: null, role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat: chatId,
          message,
          images: sent.map((im) => ({ mime: im.mime, base64: im.base64 ?? "", name: im.name })),
        }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "The tutor could not answer.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const snapshot = acc;
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { id: null, role: "assistant", content: snapshot };
          return next;
        });
      }
      if (!acc.trim()) throw new Error("The tutor sent an empty reply. Try again.");
      // Pick up any notes, calendar entries or memories the tutor wrote.
      const fresh = (await fetch(`/api/tutor?chat=${chatId}`, { cache: "no-store" }).then((r) => r.json().catch(() => null))) as
        | { notes?: NoteRow[]; memory?: MemoryRow[] }
        | null;
      if (fresh?.notes) setStudentNotes(fresh.notes);
      if (fresh?.memory) setKnown(fresh.memory);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setMessages((m) => m.filter((x, i) => !(i === m.length - 1 && x.role === "assistant" && x.content === "")));
    } finally {
      setBusy(false);
      area.current?.focus();
    }
  }

  async function draw() {
    const prompt = window.prompt("What should the tutor draw? Describe the diagram.");
    if (!prompt) return;
    setDrawing(true);
    setError(null);
    try {
      const res = await fetch("/api/tutor/image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const j = (await res.json().catch(() => null)) as { image?: string; error?: string } | null;
      if (!res.ok || !j?.image) throw new Error(j?.error ?? "Could not draw that.");
      setDrawn(j.image);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not draw that.");
    } finally {
      setDrawing(false);
    }
  }

  async function forget(id: number) {
    setKnown((m) => m.filter((x) => x.id !== id));
    await fetch(`/api/tutor/memory/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const active = chats.find((c) => c.id === chatId) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
      {/* Chats */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card p-4">
          <button type="button" onClick={() => void newChat()} disabled={busy} className="btn btn-primary btn-sm w-full">
            New chat
          </button>
          <p className="mt-2 text-xs text-muted">Every chat is kept. Nothing is deleted.</p>

          <ul className="mt-4 max-h-[46vh] space-y-0.5 overflow-y-auto lg:max-h-[52vh]">
            {chats
              .filter((c) => showArchive || !c.archived)
              .map((c) => (
                <li key={c.id}>
                  <div
                    className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm ${
                      c.id === chatId ? "bg-wash font-medium text-ink" : "text-soft hover:bg-wash"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void openChat(c.id)}
                      className="min-w-0 flex-1 truncate text-left focus-visible:outline-2 focus-visible:outline-ink"
                      title={c.title}
                    >
                      {c.title}
                      <span className="ml-1.5 text-xs text-muted">{c.turns}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void renameChat(c.id)}
                      className="shrink-0 text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Rename ${c.title}`}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={() => void archiveChat(c.id, !c.archived)}
                      className="shrink-0 text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={c.archived ? `Restore ${c.title}` : `Hide ${c.title}`}
                    >
                      {c.archived ? "↺" : "—"}
                    </button>
                  </div>
                </li>
              ))}
            {chats.length === 0 && <li className="px-2 py-2 text-sm text-muted">No chats yet.</li>}
          </ul>

          {chats.some((c) => c.archived) && (
            <button
              type="button"
              onClick={() => setShowArchive((v) => !v)}
              className="mt-3 text-xs text-muted hover:text-ink"
            >
              {showArchive ? "Hide archived chats" : `Show archived chats (${chats.filter((c) => c.archived).length})`}
            </button>
          )}
        </div>
      </aside>

      {/* Conversation */}
      <div className="min-w-0">
        <div className="card flex h-[calc(100dvh-13rem)] min-h-[420px] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <p className="min-w-0 truncate text-sm font-medium">{active ? active.title : "No chat selected"}</p>
            {studentNotes.length > 0 && (
              <button type="button" onClick={() => setShowNotes((v) => !v)} className="btn btn-ghost btn-sm shrink-0">
                {showNotes ? "Hide notes" : `Notes (${studentNotes.length})`}
              </button>
            )}
          </div>

          {showNotes && (
            <div className="max-h-[30vh] space-y-3 overflow-y-auto border-b border-line bg-wash px-4 py-3 sm:px-5">
              {studentNotes.map((n) => (
                <details key={n.id} className="rounded-lg bg-card px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium">
                    {n.subject && <span className="kicker mr-2">{n.subject}</span>}
                    {n.title}
                  </summary>
                  <div className="mt-2 text-[15px] leading-relaxed text-soft">
                    <Rich text={n.body} />
                  </div>
                </details>
              ))}
            </div>
          )}

          <div ref={scroller} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-2xl space-y-6">
              {messages.length === 0 && (
                <div className="py-6">
                  <h2 className="display text-4xl">Ask me anything about your preparation.</h2>
                  <p className="mt-3 text-soft">
                    I have every paper you have sat, every mark you lost and why, your formula errors, your projected
                    board marks and your calendar. Send a photo of your work and I will read it. Ask for a graph and I
                    will draw it.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {STARTERS.map((s) => (
                      <button key={s} type="button" onClick={() => void send(s)} disabled={busy || !hasKey || !chatId} className="btn btn-ghost btn-sm">
                        {s}
                      </button>
                    ))}
                  </div>
                  {!hasKey && (
                    <p className="mt-6 rounded-xl bg-warn-wash px-4 py-3 text-[15px] text-warn">
                      Add an API key first. The tutor uses the same keys as the marking.
                    </p>
                  )}
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                  <div className={m.role === "user" ? "max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-4 py-3 text-paper" : "w-full"}>
                    {m.role === "user" ? (
                      <>
                        {m.attachments && m.attachments.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-2">
                            {m.attachments.map((a, k) =>
                              a.base64 ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={k} src={`data:${a.mime};base64,${a.base64}`} alt={a.name} className="h-20 w-20 rounded-lg object-cover" />
                              ) : a.id ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={k} src={`/api/tutor/attachment/${a.id}`} alt={a.name} className="h-20 w-20 rounded-lg object-cover" />
                              ) : null,
                            )}
                          </div>
                        )}
                        {m.content && <p className="whitespace-pre-line text-[15px]">{m.content}</p>}
                      </>
                    ) : m.content ? (
                      <div className="space-y-3 text-[15.5px] leading-relaxed">
                        {segments(m.content).map((seg, j) =>
                          seg.kind === "graph" ? (
                            <GraphBlock key={j} spec={seg.spec} />
                          ) : seg.kind === "bad-graph" ? (
                            <p key={j} className="rounded-xl bg-warn-wash px-4 py-3 text-sm text-warn">
                              I could not read that graph. Ask me to plot it again.
                            </p>
                          ) : (
                            seg.text
                              .split(/\n{2,}/)
                              .filter((p) => p.trim())
                              .map((p, k) => (
                                <p key={`${j}-${k}`}>
                                  <Rich text={p} />
                                </p>
                              ))
                          ),
                        )}
                      </div>
                    ) : (
                      <span className="flex items-center gap-2.5 text-muted">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-pen" aria-hidden="true" />
                        Thinking
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {drawn && (
                <div className="card p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={drawn} alt="Generated by the tutor" className="w-full rounded-lg" />
                  <p className="mt-2 text-sm text-muted">
                    Drawn by the tutor. Ask for a graph instead when you want an exact plot of a function.
                  </p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p role="alert" className="mx-4 mb-3 rounded-xl bg-pen-wash px-4 py-3 text-[15px] text-pen sm:mx-6">
              {error}
            </p>
          )}

          <form
            className="border-t border-line p-3 sm:p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            {images.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {images.map((im, k) => (
                  <span key={k} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`data:${im.mime};base64,${im.base64}`} alt={im.name} className="h-16 w-16 rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, j) => j !== k))}
                      aria-label={`Remove ${im.name}`}
                      className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] text-paper"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
            <label htmlFor="tutor-input" className="sr-only">
              Message the tutor
            </label>
            <textarea
              id="tutor-input"
              ref={area}
              rows={2}
              value={input}
              disabled={busy || !hasKey || !chatId}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Ask about a mistake, a chapter or your time left. Attach a photo, or ask for a graph."
              className="max-h-40 w-full resize-y rounded-xl border border-line bg-card px-3.5 py-3 text-[15px] placeholder:text-muted focus:border-ink focus:outline-1 focus:outline-ink disabled:opacity-50"
            />
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    void attach(Array.from(e.target.files ?? []));
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                />
                <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || !hasKey || images.length >= 4} className="btn btn-ghost btn-sm">
                  Photo
                </button>
                <button type="button" onClick={() => void draw()} disabled={busy || drawing || !hasKey} className="btn btn-ghost btn-sm">
                  {drawing ? "Drawing…" : "Draw an image"}
                </button>
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy || !hasKey || !chatId || (!input.trim() && images.length === 0)}>
                {busy ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* What the tutor knows */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-medium">What it knows</h2>
            <span className="font-mono text-xs text-muted">{known.length}</span>
          </div>
          <p className="mt-1.5 text-sm text-muted">The tutor adds to this as it learns, and can correct it. Remove anything wrong.</p>
          {known.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nothing saved yet.</p>
          ) : (
            <ul className="mt-4 max-h-[38vh] space-y-3 overflow-y-auto">
              {known.map((m) => (
                <li key={m.id} className="rounded-xl bg-wash px-3.5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="kicker">{MEMORY_LABEL[m.kind] ?? m.kind}</p>
                    <button type="button" onClick={() => void forget(m.id)} className="shrink-0 text-xs text-muted hover:text-pen">
                      Forget
                    </button>
                  </div>
                  <p className="mt-1 text-[15px] leading-snug">
                    <Rich text={m.content} />
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
