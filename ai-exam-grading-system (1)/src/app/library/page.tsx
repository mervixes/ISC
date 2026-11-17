import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { resources } from "@/db/schema";
import LibraryUpload from "@/components/LibraryUpload";
import { GUIDELINES, type StepRule } from "@/lib/guidelines";
import { SUBJECTS, subjectByKey } from "@/lib/isc";
import type { ResourceKind, ResourceMeta } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Library" };

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="kicker">{title}</h3>
      <ul className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-soft">
        {items.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Steps({ items }: { items: StepRule[] }) {
  return (
    <div>
      <h3 className="kicker">Step pattern by question type</h3>
      <dl className="mt-3 divide-y divide-line border-y border-line">
        {items.map((s) => (
          <div key={s.task} className="py-3">
            <dt className="font-medium">{s.task}</dt>
            <dd className="mt-1 text-[15px] text-soft">{s.scheme}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function Library({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const sp = await searchParams;
  const subject = subjectByKey(sp.s ?? "") ?? SUBJECTS[2];
  const g = GUIDELINES[subject.key];

  const rows = await db
    .select({
      id: resources.id,
      subject: resources.subject,
      kind: resources.kind,
      name: resources.name,
      mime: resources.mime,
      size: resources.size,
      createdAt: resources.createdAt,
    })
    .from(resources)
    .where(eq(resources.subject, subject.key))
    .orderBy(asc(resources.createdAt));
  const items: ResourceMeta[] = rows.map((r) => ({
    ...r,
    kind: r.kind as ResourceKind,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="pt-8 sm:pt-12">
      <p className="kicker">Library</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">Official material and the rules.</h1>
      <p className="mt-4 max-w-2xl text-soft">
        Upload the specimen paper, marking scheme and syllabus for each subject. Marking reads them before it marks your
        script, and treats an attached marking scheme as the answer key. Below the uploads is the guideline the marker
        follows for that subject.
      </p>

      <nav aria-label="Subjects" className="-mx-5 mt-8 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {SUBJECTS.map((s) => {
          const on = s.key === subject.key;
          return (
            <Link
              key={s.key}
              href={`/library?s=${s.key}`}
              aria-current={on ? "page" : undefined}
              className={`inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ink ${
                on ? "bg-ink font-medium text-paper" : "border border-line bg-card text-soft hover:bg-wash"
              }`}
            >
              {s.name}
            </Link>
          );
        })}
      </nav>

      <section className="mt-10">
        <h2 className="display text-4xl">Your uploads for {subject.name}</h2>
        <div className="mt-6">
          <LibraryUpload subject={subject.key} items={items} />
        </div>
      </section>

      <section className="mt-16 border-t border-line pt-10">
        <p className="kicker">Guideline</p>
        <h2 className="display mt-2 text-4xl">How {g.name} is marked</h2>
        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <Block title="Paper pattern" items={g.paper} />
          <Block title="How marks are awarded" items={g.rules} />
          <Steps items={g.steps} />
          <Block title="Keywords the examiner looks for" items={g.keywords} />
          <Block title="Where candidates lose marks" items={g.losses} />
          <Block title="What your report checks" items={g.analysis} />
        </div>
      </section>
    </div>
  );
}
