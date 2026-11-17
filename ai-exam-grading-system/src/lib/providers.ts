export const PROVIDERS = ["anthropic", "openai", "gemini", "openrouter", "nvidia"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (GPT)",
  gemini: "Google (Gemini)",
  openrouter: "OpenRouter",
  nvidia: "Nvidia NIM",
};

export function guessProvider(key: string): Provider | null {
  const k = key.trim();
  if (k.startsWith("sk-ant-")) return "anthropic";
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("AIza")) return "gemini";
  if (k.startsWith("nvapi-")) return "nvidia";
  if (k.startsWith("sk-")) return "openai";
  return null;
}
