import VaultBrowser from "@/components/VaultBrowser";
import { VAULT } from "@/lib/vault";

export const metadata = { title: "Vault" };

export default function VaultPage() {
  return (
    <div className="pt-8 sm:pt-12">
      <p className="kicker">Physics · Chemistry · Maths</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">The vault</h1>
      <p className="mt-4 max-w-2xl text-soft">
        Every formula, derivation, reaction, mechanism and test in the Class XII syllabus that you are expected to write
        from memory. Each entry says when to use it, shows a worked example, and flags the trap that costs marks.
      </p>
      <div className="mt-10">
        <VaultBrowser items={VAULT} />
      </div>
    </div>
  );
}
