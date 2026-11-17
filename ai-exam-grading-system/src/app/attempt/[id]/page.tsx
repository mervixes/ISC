import { notFound } from "next/navigation";
import AttemptView from "@/components/AttemptView";
import { loadAttempt, parseId } from "@/lib/attempts";

export const dynamic = "force-dynamic";

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const attempt = await loadAttempt(id);
  if (!attempt) notFound();
  return <AttemptView initial={attempt} />;
}
