import Link from "next/link";
import { listEngineNotes } from "@/lib/engine";
import { SUBJECTS } from "@/lib/isc";
import Rich from "@/components/Rich";
import RemoveEngineNote from "@/components/RemoveEngineNote";
import LocalDate from "@/components/LocalDate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Engine" };

const BLURB: Record<string, string> = {
  rule: "How this candidate should be marked.",
  pattern: "Where their marks go, noticed by the engine.",
  note: "What the examiner is watching for next time.",
};

export default async function EnginePage() {
  const notes = await listEngineNotes();

  return (
    <div className="pt-8 sm:pt-12">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← Dashboard
      </Link>
      <p className="kicker mt-5">Engine</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">What the examiner has learned.</h1>
      <p className="mt-4 max-w-2xl text-soft">
        Every marked paper adds to this. The engine records where your marks went and which chapter was weakest, and
        carries that into the next marking, so the verdicts get sharper instead of starting from scratch. Your tutor can
        add to it too, and so can you.
      </p>

      {notes.length === 0 ? (
        <div className="card mt-10 px-6 py-14 text-center">
          <p className="text-soft">Nothing learned yet. Mark a paper and this fills up on its own.</p>
          <Link href="/new" className="btn btn-primary mt-6">
            Sit a paper
          </Link>
        </div>
      ) : (
        <>
          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
            {["rule", "pattern", "note"].map((k) => {
              const list = notes.filter((n) => n.kind === k);
              return (
                <div key={k} className="bg-card px-5 py-5">
                  <dt className="text-sm text-muted">{BLURB[k]}</dt>
                  <dd className="mt-1 font-serif text-[40px] leading-none">{list.length}</dd>
                </div>
              );
            })}
          </dl>

          <ul className="mt-10 space-y-3">
            {notes.map((n) => {
              const paper = n.attemptId ? (
                <Link href={`/attempt/${n.attemptId}`} className="link">
                  paper {n.attemptId}
                </Link>
              ) : null;
              return (
                <li key={n.id} className="card flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span
                        className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${
                          n.kind === "pattern" ? "bg-pen-wash text-pen" : "bg-wash text-soft"
                        }`}
                      >
                        {n.kind}
                      </span>
                      <span className="text-sm text-muted">
                        {n.source === "tutor" ? "written by your tutor" : n.source === "student" ? "written by you" : "from"}{" "}
                        {paper ?? "the engine"}
                      </span>
                      <LocalDate iso={n.createdAt} />
                    </div>
                    <p className="mt-2 text-[15px] leading-relaxed">
                      <Rich text={n.content} />
                    </p>
                  </div>
                  <RemoveEngineNote id={n.id} />
                </li>
              );
            })}
          </ul>

          <p className="mt-8 text-sm text-muted">
            These are read before every marking run, capped at the 40 most recent. Notes are also why your tutor can
            answer &ldquo;what should the examiner watch for in me?&rdquo;
          </p>
        </>
      )}
    </div>
  );
}
