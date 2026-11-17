import { AiError, generate } from "@/lib/ai";
import { guidelineFor } from "@/lib/guidelines";
import { getAiConfigs } from "@/lib/keys";
import { PRACTICE } from "@/lib/practice-data";
import { TYPES } from "@/lib/qtypes";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

interface Out {
  question: string;
  marks: number;
  parts?: string[];
  data?: string;
  scheme: string[];
  answer: string;
  trap: string;
  syllabus: string;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

/** Generates one fresh question of an exact type, anchored on the syllabus and the real specimen questions. */
export async function POST(req: Request) {
  const body: Record<string, unknown> = (await req.json().catch(() => null)) ?? {};
  const subject = str(body.subject);
  const chapter = str(body.chapter);
  const type = str(body.type);
  const marks = str(body.marks);
  const strict = body.strict !== false;

  const subjectTypes = TYPES.find((t) => t.subject === subject);
  const chapterTypes = subjectTypes?.chapters.find((c) => c.chapter === chapter);
  const typeRow = chapterTypes?.types.find((t) => t.type === type);
  if (!subjectTypes || !chapterTypes || !typeRow) {
    return Response.json({ error: "That question type could not be found." }, { status: 400 });
  }

  const cfgs = await getAiConfigs();
  if (cfgs.length === 0) {
    return Response.json({ error: "Add an AI API key first. Generating a question uses the same keys." }, { status: 400 });
  }

  const guideline = guidelineFor(subject);
  // Real specimen questions of the same chapter act as the style anchor.
  const anchors = PRACTICE.filter((q) => q.subject === subject && q.chapter === chapter)
    .slice(0, 3)
    .map((q) => `- (Q${q.n}, ${q.marks ?? "?"} marks) ${q.text.replace(/\s+/g, " ").slice(0, 420)}`);

  const system = `You are a CISCE examiner who has set ISC Class XII ${subject} papers for years. You write questions exactly the way the board writes them, and nothing else. Return one JSON object and no other text.`;

  const prompt = `Write ONE new practice question of this exact type, for ISC Class XII ${subject}, chapter "${chapter}".

TYPE: ${typeRow.type}
Usual marks: ${typeRow.marks}
Why it is asked: ${typeRow.note}

The question must be set strictly inside the Class XII syllabus scope, in the board's own style and wording, at the same difficulty, and must reward the same steps the board rewards. Do not reuse the specimen questions below; use them only to match the style and the level.

${guideline ? `MARKING RULES FOR THIS SUBJECT:\n${guideline.rules.slice(0, 12).map((r) => `- ${r}`).join("\n")}` : ""}

REAL SPECIMEN QUESTIONS FROM THIS CHAPTER (for style only):
${anchors.length ? anchors.join("\n") : "- none available; follow the syllabus type description."}

Use LaTeX between single dollar signs for mathematics. Use \\mathrm{} and \\rightarrow for chemical equations. Escape every LaTeX backslash twice inside the JSON strings.

Return exactly this JSON:
{
  "question": "the question as the board would print it, including any parts (i), (ii)",
  "marks": <number, the total marks, usually ${marks.replace(/[^0-9.–-]/g, "") || typeRow.marks}>,
  "data": "given data or the scenario, empty string if none",
  "scheme": ["how the marks are split, one string per creditable point"],
  "answer": "the full-mark answer, with working where the type needs it",
  "trap": "the mistake candidates make most often on this type",
  "syllabus": "the syllabus clause this question comes from, in a few words"
}${strict ? "" : ""}`;

  let lastErr: unknown = null;
  for (const cfg of cfgs) {
    try {
      const raw = await generate({
        provider: cfg.provider,
        apiKey: cfg.apiKey,
        model: cfg.model,
        system,
        parts: [{ type: "text", text: prompt }],
        maxTokens: 8000,
        json: true,
        signal: AbortSignal.timeout(3 * 60 * 1000),
      });
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start < 0 || end < start) throw new AiError("The model did not return a question. Try again.");
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        throw new AiError("The model returned a malformed question. Try again.");
      }
      const out: Out = {
        question: str(parsed.question),
        marks: Number(parsed.marks) || 0,
        data: str(parsed.data),
        scheme: list(parsed.scheme),
        answer: str(parsed.answer),
        trap: str(parsed.trap),
        syllabus: str(parsed.syllabus),
      };
      if (!out.question) throw new AiError("The model returned an empty question. Try again.");
      return Response.json({ question: out, model: cfg.model });
    } catch (e) {
      lastErr = e;
      if (e instanceof AiError && e.status === 401) continue;
      if (e instanceof Error && /reach|quota|rate limit|timed out/i.test(e.message)) continue;
      break;
    }
  }
  const message = lastErr instanceof Error ? lastErr.message : "Could not generate a question.";
  return Response.json({ error: message }, { status: 502 });
}
