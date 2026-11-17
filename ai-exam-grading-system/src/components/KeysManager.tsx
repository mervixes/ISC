"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PROVIDER_LABEL } from "@/lib/providers";
import type { KeyRow, KeyStatus } from "@/lib/types";

const STATUS: Record<KeyStatus, { label: string; cls: string }> = {
  ok: { label: "Working", cls: "bg-pass-wash text-pass" },
  unverified: { label: "Not verified", cls: "bg-warn-wash text-warn" },
  failing: { label: "Failing", cls: "bg-pen-wash text-pen" },
};

type SavedKey = KeyRow & { id: number };

export default function KeysManager({ initial }: { initial: KeyRow[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);

  async function call(
    label: string,
    url: string,
    init: RequestInit,
  ): Promise<{ ok: boolean; json: Record<string, unknown> | null }> {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, init);
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : "Something went wrong. Try again.");
        return { ok: false, json };
      }
      router.refresh();
      return { ok: true, json };
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      return { ok: false, json: null };
    } finally {
      setBusy(null);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const { ok, json } = await call("add", "/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: value }),
    });
    if (ok) {
      setValue("");
      const key = json?.key as KeyRow | undefined;
      setNotice(key ? `Added ${PROVIDER_LABEL[key.provider]}. Marking will use ${key.model}.` : "Key added.");
    }
  }

  async function act(id: number, action: "top" | "verify") {
    await call(action, `/api/keys/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
  }

  async function remove(id: number) {
    setConfirm(null);
    await call("delete", `/api/keys/${id}`, { method: "DELETE" });
  }

  const saved = initial.filter((k): k is SavedKey => k.id !== null);
  const env = initial.filter((k) => k.id === null);

  return (
    <div className="space-y-10">
      <form onSubmit={add} className="card p-5 sm:p-6">
        <label htmlFor="new-key" className="label">
          Add a key
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="new-key"
            className="input font-mono"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="sk-ant-…   sk-…   AIza…   sk-or-…   nvapi-…"
            disabled={busy !== null}
          />
          <button className="btn btn-primary shrink-0" disabled={busy !== null || value.trim() === ""}>
            {busy === "add" ? "Checking…" : "Add key"}
          </button>
        </div>
        <p className="mt-3 text-sm text-muted">
          Nothing else to fill in. The provider and model are detected from the key and checked before it is saved.
        </p>
        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-pen-wash px-4 py-3 text-[15px] text-pen">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-4 rounded-xl bg-pass-wash px-4 py-3 text-[15px] text-pass">
            {notice}
          </p>
        )}
      </form>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="display text-3xl">Keys in order</h2>
          <span className="text-sm text-muted">{saved.length} saved</span>
        </div>
        <p className="mt-2 text-sm text-muted">
          Marking tries these from the top. If one is rejected, runs out of quota or is down, marking moves to the next.
        </p>

        {saved.length === 0 ? (
          <p className="card mt-5 px-6 py-8 text-center text-soft">No saved keys yet.</p>
        ) : (
          <ol className="mt-5 space-y-3">
            {saved.map((k, rank) => (
              <li key={k.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-medium">{PROVIDER_LABEL[k.provider]}</span>
                    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${STATUS[k.status].cls}`}>
                      {STATUS[k.status].label}
                    </span>
                    {rank === 0 && (
                      <span className="inline-flex h-6 items-center rounded-full bg-ink px-2.5 text-xs font-medium text-paper">
                        Tried first
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 font-mono text-sm text-muted">
                    ••••{k.hint} · {k.model}
                  </p>
                  {k.lastError && <p className="mt-2 text-sm text-pen">{k.lastError}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {rank > 0 && (
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busy !== null}
                      onClick={() => act(k.id, "top")}
                    >
                      Try first
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={busy !== null}
                    onClick={() => act(k.id, "verify")}
                  >
                    {busy === "verify" ? "Checking…" : "Re-check"}
                  </button>
                  {confirm === k.id ? (
                    <>
                      <button className="btn btn-pen btn-sm" disabled={busy !== null} onClick={() => remove(k.id)}>
                        Remove
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-sm text-muted hover:text-pen"
                      disabled={busy !== null}
                      onClick={() => setConfirm(k.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {env.length > 0 && (
        <section>
          <h2 className="display text-3xl">From the server</h2>
          <p className="mt-2 text-sm text-muted">
            These come from environment variables set on the server. They are used after your saved keys and cannot be
            removed here.
          </p>
          <ul className="mt-5 space-y-3">
            {env.map((k) => (
              <li key={`${k.provider}-${k.hint}`} className="card flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
                <div>
                  <span className="font-medium">{PROVIDER_LABEL[k.provider]}</span>
                  <p className="mt-1 font-mono text-sm text-muted">
                    ••••{k.hint} · {k.model}
                  </p>
                </div>
                <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${STATUS[k.status].cls}`}>
                  {STATUS[k.status].label}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
