import { AiError } from "@/lib/ai";
import { getAiConfigs } from "@/lib/keys";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * Image generation for the tutor. Uses whichever of the student's providers can generate an
 * image; Nvidia NIM cannot, so a clear message is returned rather than a silent failure.
 */
export async function POST(req: Request) {
  const body: Record<string, unknown> = (await req.json().catch(() => null)) ?? {};
  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 1200) : "";
  if (!prompt) return Response.json({ error: "Describe the image you want." }, { status: 400 });

  const cfgs = await getAiConfigs();
  if (cfgs.length === 0) {
    return Response.json({ error: "Add an AI API key first." }, { status: 400 });
  }

  const tried: string[] = [];
  for (const cfg of cfgs) {
    try {
      if (cfg.provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
          body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", n: 1 }),
          signal: AbortSignal.timeout(120_000),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new AiError(`OpenAI image: ${t.slice(0, 200) || `HTTP ${res.status}`}`, res.status);
        }
        const j = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
        const b64 = j.data?.[0]?.b64_json;
        if (b64) return Response.json({ image: `data:image/png;base64,${b64}`, provider: "openai" });
        if (j.data?.[0]?.url) return Response.json({ image: j.data[0].url, provider: "openai" });
        throw new AiError("OpenAI returned no image.");
      }
      if (cfg.provider === "gemini") {
        const model = "gemini-2.5-flash-image";
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": cfg.apiKey },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { responseModalities: ["IMAGE"] },
            }),
            signal: AbortSignal.timeout(120_000),
          },
        );
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new AiError(`Gemini image: ${t.slice(0, 200) || `HTTP ${res.status}`}`, res.status);
        }
        const j = (await res.json()) as {
          candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
        };
        const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
        if (part?.inlineData?.data) {
          return Response.json({
            image: `data:${part.inlineData.mimeType ?? "image/png"};base64,${part.inlineData.data}`,
            provider: "gemini",
          });
        }
        throw new AiError("Gemini returned no image for this prompt.");
      }
      tried.push(cfg.provider);
    } catch (e) {
      tried.push(`${cfg.provider}: ${e instanceof Error ? e.message.slice(0, 120) : "failed"}`);
    }
  }

  const nvidiaOnly = cfgs.every((c) => c.provider === "nvidia");
  return Response.json(
    {
      error: nvidiaOnly
        ? "Nvidia NIM cannot generate images. Add an OpenAI or Gemini key to draw pictures, or ask for a graph instead: those are drawn instantly with no extra service."
        : `Image generation failed. ${tried.join("; ")}`,
    },
    { status: 400 },
  );
}
