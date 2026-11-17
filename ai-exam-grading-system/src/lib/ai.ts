/* eslint-disable @typescript-eslint/no-explicit-any */
import { PROVIDER_LABEL, PROVIDERS, type Provider } from "./providers";

export { PROVIDER_LABEL, PROVIDERS, type Provider };

/** Only used when the live model list cannot be fetched. */
export const FALLBACK_MODEL: Record<Provider, string> = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-4o",
  gemini: "gemini-2.5-pro",
  openrouter: "anthropic/claude-sonnet-4.5",
  nvidia: "meta/llama-3.2-90b-vision-instruct",
};

export type AiPart =
  | { type: "text"; text: string }
  | { type: "file"; mime: string; base64: string; name: string };

/** True when the failure belongs to the key or the account, so the next saved key is worth trying. */
export function isKeyFailure(e: unknown): boolean {
  if (!(e instanceof AiError)) return true;
  if (e.status !== undefined) {
    if (e.status === 401 || e.status === 402 || e.status === 403 || e.status === 404 || e.status === 429 || e.status >= 500) {
      return true;
    }
    // Some providers (Gemini in particular) report a bad key as 400.
    if (e.status === 400 && /api key|invalid.*key|unauthenticated|credential/i.test(e.message)) return true;
    // Content-safety rejections are input-level: worth retrying with another key or model.
    return isSafetyRejection(e);
  }
  return /could not reach|timed out/i.test(e.message);
}

/** True when the provider rejected the input on content-safety grounds rather than the key. */
export function isSafetyRejection(e: unknown): boolean {
  return e instanceof AiError && /content safety|safety screening|content policy|flagged|rejected by/i.test(e.message);
}

export class AiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AiError";
    this.status = status;
  }
}

const TRUNCATED =
  "The model ran out of output space before finishing the whole paper. Run the marking again, or mark a shorter paper: this happens when a script has many parts and the model spends its budget thinking.";

async function readError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  try {
    let j = JSON.parse(raw);
    if (Array.isArray(j)) j = j[0];
    const m = j?.error?.message ?? j?.message ?? (typeof j?.error === "string" ? j.error : null);
    if (m) return String(m);
  } catch {
    /* not JSON */
  }
  return raw.slice(0, 300) || res.statusText || `HTTP ${res.status}`;
}

function explain(provider: Provider, status: number, msg: string): AiError {
  const who = PROVIDER_LABEL[provider];
  if (status === 401 || status === 403) return new AiError(`${who} rejected the API key. ${msg}`, status);
  if (status === 404) return new AiError(`${who} no longer offers that model, so the app looks up the current one. ${msg}`, status);
  if (status === 429) return new AiError(`${who} rate limit or quota reached. ${msg}`, status);
  if (status === 413) return new AiError(`The upload is too large for ${who}. Use fewer or smaller pages. ${msg}`, status);
  if (status >= 500) return new AiError(`${who} is having trouble right now (HTTP ${status}). Try again in a minute. ${msg}`, status);
  return new AiError(`${who}: ${msg}`, status);
}

async function* sse(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, "");
      buf = buf.slice(idx + 1);
      if (line.startsWith("data:")) yield line.slice(5).trim();
    }
  }
  if (buf.startsWith("data:")) yield buf.slice(5).trim();
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GenInput {
  provider: Provider;
  apiKey: string;
  model: string;
  system: string;
  parts: AiPart[];
  /** Earlier turns of a conversation, sent before `parts`. */
  history?: ChatTurn[];
  /** Output token budget. Providers default low, so this is set explicitly. */
  maxTokens?: number;
  /** Ask the provider for strict JSON. Only marking and question generation want this. */
  json?: boolean;
  onDelta?: (chars: number) => void;
  /** Called with each piece of text as it arrives, for streaming to a client. */
  onText?: (chunk: string) => void;
  signal?: AbortSignal;
}

async function anthropic(i: GenInput, maxTokens: number): Promise<string> {
  const content = i.parts.map((p) =>
    p.type === "text"
      ? { type: "text", text: p.text }
      : p.mime === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: p.mime, data: p.base64 } }
        : { type: "image", source: { type: "base64", media_type: p.mime, data: p.base64 } },
  );
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": i.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: i.model,
      max_tokens: maxTokens,
      system: i.system,
      stream: true,
      messages: [...(i.history ?? []), { role: "user", content }],
    }),
    signal: i.signal,
  });
  if (!res.ok) {
    const msg = await readError(res);
    if (res.status === 400 && /max_tokens/i.test(msg) && maxTokens > 8000) return anthropic(i, 8000);
    throw explain("anthropic", res.status, msg);
  }
  let text = "";
  let stop = "";
  for await (const data of sse(res)) {
    let ev: any;
    try {
      ev = JSON.parse(data);
    } catch {
      continue;
    }
    if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
      const piece: string = ev.delta.text ?? "";
      text += piece;
      if (piece) i.onText?.(piece);
      i.onDelta?.(text.length);
    } else if (ev.type === "message_delta" && ev.delta?.stop_reason) {
      stop = ev.delta.stop_reason;
    } else if (ev.type === "error") {
      throw new AiError(`Anthropic: ${ev.error?.message ?? "stream error"}`);
    }
  }
  if (stop === "max_tokens") throw new AiError(TRUNCATED);
  if (stop === "refusal") throw new AiError("The model declined to mark this script.");
  return text;
}

/** Lets OPENAI_BASE_URL point at any OpenAI-compatible endpoint. */
function openAiBase(): string {
  return (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
}

async function openaiLike(i: GenInput, stream: boolean): Promise<string> {
  const isOpenAi = i.provider === "openai";
  const isNvidia = i.provider === "nvidia";
  const base = isOpenAi ? openAiBase() : isNvidia ? "https://integrate.api.nvidia.com/v1" : "https://openrouter.ai/api/v1";
  const url = `${base}/chat/completions`;
  // Nvidia NIM accepts images but not PDF documents.
  if (isNvidia && i.parts.some((p) => p.type === "file" && p.mime === "application/pdf")) {
    throw new AiError(
      "Nvidia NIM cannot read PDF files. Upload photos of the question paper and the reference material instead, or use another provider for this paper.",
    );
  }
  const content = i.parts.map((p) =>
    p.type === "text"
      ? { type: "text", text: p.text }
      : p.mime === "application/pdf"
        ? {
            type: "file",
            file: { filename: p.name || "question-paper.pdf", file_data: `data:application/pdf;base64,${p.base64}` },
          }
        : { type: "image_url", image_url: { url: `data:${p.mime};base64,${p.base64}`, detail: "high" } },
  );
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${i.apiKey}` },
    body: JSON.stringify({
      model: i.model,
      stream,
      max_tokens: i.maxTokens ?? 65536,
      ...(i.json && (isOpenAi || isNvidia) ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: i.system },
        ...(i.history ?? []),
        { role: "user", content },
      ],
    }),
    signal: i.signal,
  });
  if (!res.ok) {
    const msg = await readError(res);
    // Some accounts are not allowed to stream certain models.
    if (stream && res.status === 400 && /stream/i.test(msg)) return openaiLike(i, false);
    if (res.status === 400 && /max_?tokens|max tokens/i.test(msg) && (i.maxTokens ?? 0) > 4000) {
      return openaiLike({ ...i, maxTokens: Math.floor((i.maxTokens ?? 65536) / 2) }, stream);
    }
    throw explain(i.provider, res.status, msg);
  }
  if (!stream) {
    const j: any = await res.json();
    const c = j?.choices?.[0];
    if (c?.finish_reason === "length") throw new AiError(TRUNCATED);
    // Some models (NVIDIA Nemotron among them) put the visible answer in content and their
    // working in reasoning_content. Fall back to reasoning only if content is empty.
    const out =
      (typeof c?.message?.content === "string" && c.message.content) ||
      (typeof c?.message?.reasoning_content === "string" ? c.message.reasoning_content : "");
    if (out) i.onText?.(out);
    i.onDelta?.(out.length);
    return out;
  }
  let text = "";
  // Reasoning models (NVIDIA Nemotron among them) stream their working separately from the answer.
  // The two must never be concatenated, or the JSON report is corrupted.
  let reasoning = "";
  let finish = "";
  for await (const data of sse(res)) {
    if (data === "[DONE]") break;
    let ev: any;
    try {
      ev = JSON.parse(data);
    } catch {
      continue;
    }
    if (ev.error) throw new AiError(`${PROVIDER_LABEL[i.provider]}: ${ev.error.message ?? "stream error"}`);
    const c = ev.choices?.[0];
    if (typeof c?.delta?.content === "string" && c.delta.content) {
      text += c.delta.content;
      i.onText?.(c.delta.content);
      i.onDelta?.(text.length);
    } else if (typeof c?.delta?.reasoning_content === "string" && c.delta.reasoning_content) {
      reasoning += c.delta.reasoning_content;
    }
    if (c?.finish_reason) finish = c.finish_reason;
  }
  // Only if the model never produced a visible answer do we fall back to its working.
  if (!text.trim() && reasoning.trim()) {
    text = reasoning;
    i.onText?.(reasoning);
  }
  if (finish === "length") throw new AiError(TRUNCATED);
  if (finish === "content_filter") throw new AiError("The provider's content filter blocked the response.");
  return text;
}

async function gemini(i: GenInput, capOutput: boolean): Promise<string> {
  const model = i.model.replace(/^models\//, "");
  const parts = i.parts.map((p) =>
    p.type === "text" ? { text: p.text } : { inlineData: { mimeType: p.mime, data: p.base64 } },
  );
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": i.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: i.system }] },
        contents: [
          ...(i.history ?? []).map((t) => ({
            role: t.role === "assistant" ? "model" : "user",
            parts: [{ text: t.content }],
          })),
          { role: "user", parts },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          ...(capOutput ? { maxOutputTokens: 32768 } : {}),
        },
      }),
      signal: i.signal,
    },
  );
  if (!res.ok) {
    const msg = await readError(res);
    if (capOutput && res.status === 400 && /max.?output.?tokens/i.test(msg)) return gemini(i, false);
    throw explain("gemini", res.status, msg);
  }
  let text = "";
  let finish = "";
  for await (const data of sse(res)) {
    let ev: any;
    try {
      ev = JSON.parse(data);
    } catch {
      continue;
    }
    if (ev.error) throw new AiError(`Gemini: ${ev.error.message ?? "stream error"}`);
    if (ev.promptFeedback?.blockReason) {
      throw new AiError(`Gemini blocked the request (${ev.promptFeedback.blockReason}).`);
    }
    const c = ev.candidates?.[0];
    for (const part of c?.content?.parts ?? []) {
      if (typeof part.text === "string" && !part.thought) {
        text += part.text;
        i.onText?.(part.text);
      }
    }
    if (c?.content?.parts?.length) i.onDelta?.(text.length);
    if (c?.finishReason) finish = c.finishReason;
  }
  if (finish === "MAX_TOKENS") throw new AiError(TRUNCATED);
  if (finish && !["STOP", "FINISH_REASON_UNSPECIFIED"].includes(finish) && !text) {
    throw new AiError(`Gemini stopped without answering (${finish}).`);
  }
  return text;
}

export async function generate(i: GenInput): Promise<string> {
  let text: string;
  try {
    if (i.provider === "anthropic") text = await anthropic(i, 20000);
    else if (i.provider === "gemini") text = await gemini(i, true);
    else text = await openaiLike(i, true);
  } catch (e) {
    if (e instanceof AiError) throw e;
    const err = e as Error;
    if (err?.name === "AbortError" || err?.name === "TimeoutError") {
      throw new AiError("Marking timed out. Try again, or use fewer pages.");
    }
    throw new AiError(`Could not reach ${PROVIDER_LABEL[i.provider]}: ${err?.message ?? "network error"}`);
  }
  if (!text.trim()) throw new AiError("The model returned an empty response. Try again or choose a different model.");
  return text;
}

export interface ModelList {
  ids: string[];
  recommended: string | null;
}

function geminiVersion(id: string): number {
  const m = id.match(/gemini-(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

export async function listModels(provider: Provider, apiKey: string): Promise<ModelList> {
  const signal = AbortSignal.timeout(20000);
  try {
    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        signal,
      });
      if (!res.ok) throw explain(provider, res.status, await readError(res));
      const j: any = await res.json();
      // Returned newest first.
      const ids: string[] = (j.data ?? []).map((m: any) => String(m.id));
      const recommended = ids.find((id) => id.includes("sonnet")) ?? ids[0] ?? null;
      return { ids, recommended };
    }
    if (provider === "openai") {
      const res = await fetch(`${openAiBase()}/models`, {
        headers: { authorization: `Bearer ${apiKey}` },
        signal,
      });
      if (!res.ok) throw explain(provider, res.status, await readError(res));
      const j: any = await res.json();
      const skip = /audio|realtime|tts|transcribe|image|search|instruct|embedding|moderation|codex|whisper|dall|babbage|davinci|sora/;
      const chat = (j.data ?? [])
        .filter((m: any) => /^(gpt-|o\d|chatgpt-)/.test(m.id) && !skip.test(m.id))
        .sort((a: any, b: any) => (b.created ?? 0) - (a.created ?? 0));
      const ids: string[] = chat.map((m: any) => String(m.id));
      const recommended =
        ids.find((id) => /^gpt-/.test(id) && !/mini|nano|preview|\d{4}-\d{2}-\d{2}/.test(id)) ??
        ids.find((id) => /^gpt-/.test(id) && !/mini|nano/.test(id)) ??
        ids[0] ??
        null;
      return { ids, recommended };
    }
    if (provider === "gemini") {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
        headers: { "x-goog-api-key": apiKey },
        signal,
      });
      if (!res.ok) throw explain(provider, res.status, await readError(res));
      const j: any = await res.json();
      const skip = /embedding|tts|image|live|audio|aqa|robotics|computer-use|learnlm|gemma/;
      const ids: string[] = (j.models ?? [])
        .filter((m: any) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
        .map((m: any) => String(m.name).replace(/^models\//, ""))
        .filter((id: string) => id.startsWith("gemini") && !skip.test(id))
        .sort((a: string, b: string) => geminiVersion(b) - geminiVersion(a));
      const top = ids.length ? geminiVersion(ids[0]) : 0;
      const newest = ids.filter((id) => geminiVersion(id) === top);
      const recommended =
        newest.find((id) => !/flash|lite|preview|exp/.test(id)) ??
        newest.find((id) => !/flash|lite/.test(id)) ??
        newest[0] ??
        null;
      return { ids, recommended };
    }
    if (provider === "nvidia") {
      const res = await fetch("https://integrate.api.nvidia.com/v1/models", {
        headers: { authorization: `Bearer ${apiKey}` },
        signal,
      });
      if (!res.ok) throw explain(provider, res.status, await readError(res));
      const j: any = await res.json();
      const all: string[] = (j.data ?? []).map((m: any) => String(m.id));
      // Marking needs a model that can see handwriting, so utility models are excluded.
      const notChat = /embed|rerank|reward|guard|safety|nvclip|detector|calibration|translate|starcoder|arctic|synthetic/i;
      const ids = all.filter((id) => !notChat.test(id));
      const vision = ids.filter((id) => /-vl-|vision|vlm|omni|cosmos-reason|gemma-3|pixtral|llava/i.test(id));
      const recommended =
        // Biggest vision-language model first, then any vision model, then a general chat model.
        vision.find((id) => /super-vl|ultra|[1-9]\d\db/i.test(id)) ??
        vision[0] ??
        ids.find((id) => /nemotron|deepseek|mistral|gpt-oss|glm|minimax|step-|gemma/i.test(id)) ??
        ids[0] ??
        null;
      return { ids: ids.length ? ids : all, recommended };
    }
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { authorization: `Bearer ${apiKey}` },
      signal,
    });
    if (!res.ok) throw explain(provider, res.status, await readError(res));
    const j: any = await res.json();
    const vision = (j.data ?? [])
      .filter((m: any) => (m.architecture?.input_modalities ?? []).includes("image"))
      .sort((a: any, b: any) => (b.created ?? 0) - (a.created ?? 0));
    const ids: string[] = vision.map((m: any) => String(m.id));
    // OpenRouter's model list is public, so validate the key separately.
    const keyRes = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { authorization: `Bearer ${apiKey}` },
      signal,
    });
    if (!keyRes.ok) throw explain(provider, keyRes.status, await readError(keyRes));
    const recommended = ids.find((id) => /^anthropic\/claude-sonnet/.test(id)) ?? ids[0] ?? null;
    return { ids, recommended };
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError(`Could not reach ${PROVIDER_LABEL[provider]}: ${(e as Error)?.message ?? "network error"}`);
  }
}
