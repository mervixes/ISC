import TypesBrowser from "@/components/TypesBrowser";
import { TYPES } from "@/lib/qtypes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Question types" };

export default async function TypesPage({ searchParams }: { searchParams: Promise<{ s?: string; c?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="pt-8 sm:pt-12">
      <p className="kicker">Question types</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">What they ask, and how often.</h1>
      <p className="mt-4 max-w-2xl text-soft">
        Every chapter, collapsed. Pick a subject, open a chapter, and the question types appear ranked from highest to
        lowest weightage. Any type can be practised: the tutor writes a fresh question of that exact type with its
        marking scheme and a full-mark answer.
      </p>
      <div className="mt-10">
        <TypesBrowser
          subjects={TYPES.map((s) => ({ subject: s.subject, chapters: s.chapters }))}
          initialSubject={sp.s}
          initialChapter={sp.c}
        />
      </div>
    </div>
  );
}
