import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { AiError, FALLBACK_MODEL, listModels } from "./ai";
import { PROVIDERS, guessProvider, type Provider } from "./providers";
import type { KeyRow, KeyStatus } from "./types";

export interface AiConfig {
  /** null for keys supplied through server environment variables. */
  id: number | null;
  provider: Provider;
  apiKey: string;
  model: string;
  source: "saved" | "env";
}

type Row = typeof apiKeys.$inferSelect;
type AddResult = { ok: true; row: KeyRow } | { ok: false; status: number; error: string };

const g = globalThis as typeof globalThis & { __keyModelCache?: Map<string, { model: string; at: number }> };
const modelCache = (g.__keyModelCache ??= new Map());
const HOUR = 3_600_000;

const fail = (status: number, error: string): AddResult => ({ ok: false, status, error });

export function envKeys(): Partial<Record<Provider, string>> {
  const e = process.env;
  const out: Partial<Record<Provider, string>> = {};
  if (e.ANTHROPIC_API_KEY) out.anthropic = e.ANTHROPIC_API_KEY;
  if (e.OPENAI_API_KEY) out.openai = e.OPENAI_API_KEY;
  const gem = e.GEMINI_API_KEY || e.GOOGLE_API_KEY || e.GOOGLE_GENERATIVE_AI_API_KEY;
  if (gem) out.gemini = gem;
  if (e.OPENROUTER_API_KEY) out.openrouter = e.OPENROUTER_API_KEY;
  if (e.NVIDIA_API_KEY) out.nvidia = e.NVIDIA_API_KEY;
  return out;
}

/** Best model for a key, cached for an hour so marking does not re-list models every time. */
async function resolveModel(provider: Provider, apiKey: string): Promise<string> {
  const hit = modelCache.get(apiKey);
  if (hit && Date.now() - hit.at < HOUR) return hit.model;
  let model = FALLBACK_MODEL[provider];
  try {
    const list = await listModels(provider, apiKey);
    model = list.recommended ?? model;
  } catch {
    /* keep the fallback */
  }
  modelCache.set(apiKey, { model, at: Date.now() });
  return model;
}

function toRow(r: Row): KeyRow {
  return {
    id: r.id,
    provider: r.provider as Provider,
    hint: r.hint,
    model: r.model,
    source: "saved",
    status: r.status as KeyStatus,
    lastError: r.lastError,
  };
}

function envRow(provider: Provider, key: string): KeyRow {
  const cached = modelCache.get(key);
  return {
    id: null,
    provider,
    hint: key.slice(-4),
    model: cached?.model ?? "chosen automatically",
    source: "env",
    status: cached ? "ok" : "unverified",
    lastError: null,
  };
}

/** Rows for the API keys page. No network calls: uses cached models only. */
export async function listKeyRows(): Promise<KeyRow[]> {
  const rows = await db.select().from(apiKeys).orderBy(asc(apiKeys.position), asc(apiKeys.id));
  const savedKeys = new Set(rows.map((r) => r.apiKey));
  const env = (Object.entries(envKeys()) as [Provider, string][])
    .filter(([, k]) => !savedKeys.has(k))
    .map(([p, k]) => envRow(p, k));
  return [...rows.map(toRow), ...env];
}

/** Every usable key in the order it should be tried: saved keys first, then environment keys. */
export async function getAiConfigs(): Promise<AiConfig[]> {
  const rows = await db.select().from(apiKeys).orderBy(asc(apiKeys.position), asc(apiKeys.id));
  const out: AiConfig[] = [];
  for (const r of rows) {
    const provider = r.provider as Provider;
    if (!(PROVIDERS as readonly string[]).includes(provider)) continue;
    out.push({
      id: r.id,
      provider,
      apiKey: r.apiKey,
      model: r.model || (await resolveModel(provider, r.apiKey)),
      source: "saved",
    });
  }
  const saved = new Set(out.map((c) => c.apiKey));
  for (const [provider, key] of Object.entries(envKeys()) as [Provider, string][]) {
    if (saved.has(key)) continue;
    out.push({ id: null, provider, apiKey: key, model: await resolveModel(provider, key), source: "env" });
  }
  return out;
}

/** Cheap check used for banners. Does not touch the network. */
export async function hasAiKey(): Promise<boolean> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(apiKeys);
  return n > 0 || Object.keys(envKeys()).length > 0;
}

/** Adds a key. The provider is detected from the key itself and verified by listing its models. */
export async function addKey(raw: string): Promise<AddResult> {
  const key = raw.trim();
  if (key.length < 16 || /\s/.test(key)) {
    return fail(400, "That does not look like a full API key. Paste the whole key.");
  }
  const [dup] = await db.select({ id: apiKeys.id }).from(apiKeys).where(eq(apiKeys.apiKey, key));
  if (dup) return fail(409, "This key is already saved.");
  if (Object.values(envKeys()).includes(key)) return fail(409, "This key is already set on the server.");

  const guess = guessProvider(key);
  const trial: Provider[] = guess ? [guess] : [...PROVIDERS];
  const results = await Promise.all(
    trial.map(async (p) => {
      try {
        return { p, list: await listModels(p, key), err: null as AiError | null };
      } catch (e) {
        return { p, list: null, err: e instanceof AiError ? e : new AiError("Could not verify this key.") };
      }
    }),
  );

  const hit = results.find((r) => r.list);
  let provider: Provider;
  let model: string;
  let status: KeyStatus;
  let lastError: string | null;

  if (hit?.list) {
    provider = hit.p;
    model = hit.list.recommended ?? FALLBACK_MODEL[provider];
    status = "ok";
    lastError = null;
  } else {
    const rejected = results.every((r) => r.err?.status === 401 || r.err?.status === 403);
    if (rejected) {
      return fail(
        400,
        guess
          ? (results[0].err?.message ?? "The key was rejected.")
          : "No provider accepted this key. Check that you copied all of it.",
      );
    }
    // Provider unreachable or erroring: keep the key, but say it is not verified yet.
    const soft = results.find((r) => r.err && r.err.status !== 401 && r.err.status !== 403) ?? results[0];
    provider = soft.p;
    model = FALLBACK_MODEL[provider];
    status = "unverified";
    lastError = soft.err?.message ?? "Could not verify the key yet.";
  }

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${apiKeys.position}), 0)::int + 1` })
    .from(apiKeys);
  const [row] = await db
    .insert(apiKeys)
    .values({
      provider,
      apiKey: key,
      hint: key.slice(-4),
      model,
      status,
      lastError,
      position: next,
      verifiedAt: status === "ok" ? new Date() : null,
    })
    .returning();
  modelCache.set(key, { model, at: Date.now() });
  return { ok: true, row: toRow(row) };
}

/** "top" moves a key to the front of the queue. "verify" re-checks it against the provider. */
export async function updateKey(id: number, action: "top" | "verify"): Promise<KeyRow | null> {
  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
  if (!row) return null;

  if (action === "top") {
    const [{ low }] = await db
      .select({ low: sql<number>`coalesce(min(${apiKeys.position}), 0)::int` })
      .from(apiKeys);
    const [u] = await db.update(apiKeys).set({ position: low - 1 }).where(eq(apiKeys.id, id)).returning();
    return toRow(u);
  }

  try {
    const list = await listModels(row.provider as Provider, row.apiKey);
    const model = list.recommended ?? row.model;
    const [u] = await db
      .update(apiKeys)
      .set({ status: "ok", lastError: null, verifiedAt: new Date(), model })
      .where(eq(apiKeys.id, id))
      .returning();
    modelCache.set(row.apiKey, { model, at: Date.now() });
    return toRow(u);
  } catch (e) {
    const err = e instanceof AiError ? e : null;
    const hard = err?.status === 401 || err?.status === 403;
    const [u] = await db
      .update(apiKeys)
      .set({
        status: hard ? "failing" : "unverified",
        lastError: (err?.message ?? "Could not verify the key.").slice(0, 300),
      })
      .where(eq(apiKeys.id, id))
      .returning();
    return toRow(u);
  }
}

/** Looks up the provider's current recommended model and stores it, for keys whose saved model was retired. */
export async function refreshModel(id: number, provider: Provider, apiKey: string): Promise<string | null> {
  try {
    const list = await listModels(provider, apiKey);
    const model = list.recommended;
    if (!model) return null;
    await db.update(apiKeys).set({ model }).where(eq(apiKeys.id, id));
    modelCache.set(apiKey, { model, at: Date.now() });
    return model;
  } catch {
    return null;
  }
}

export async function deleteKey(id: number): Promise<void> {
  await db.delete(apiKeys).where(eq(apiKeys.id, id));
}

/** Called by the grader after each attempt with a key, so the page shows which keys are working. */
export async function recordKeyResult(id: number, ok: boolean, error: string | null): Promise<void> {
  if (ok) {
    await db.update(apiKeys).set({ status: "ok", lastError: null, verifiedAt: new Date() }).where(eq(apiKeys.id, id));
  } else {
    await db
      .update(apiKeys)
      .set({ status: "failing", lastError: (error ?? "The request failed.").slice(0, 300) })
      .where(eq(apiKeys.id, id));
  }
}
