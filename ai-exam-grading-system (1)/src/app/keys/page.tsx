import KeysManager from "@/components/KeysManager";
import { listKeyRows } from "@/lib/keys";

export const dynamic = "force-dynamic";
export const metadata = { title: "API keys" };

export default async function KeysPage() {
  const keys = await listKeyRows();
  return (
    <div className="mx-auto max-w-2xl pt-8 sm:pt-12">
      <p className="kicker">API keys</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">Your examiners</h1>
      <p className="mt-4 text-soft">
        Paste a key from Anthropic, OpenAI, Google Gemini or OpenRouter. The provider and the model are detected
        automatically. Add as many keys as you like. Keys are stored on this site&rsquo;s server and never shown back in
        full.
      </p>
      <div className="mt-10">
        <KeysManager initial={keys} />
      </div>
    </div>
  );
}
