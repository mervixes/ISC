import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { attempts } from "@/db/schema";
import { detachAttemptFromInsights, loadAttempt, parseId } from "@/lib/attempts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => Response.json({ error: "Paper not found." }, { status: 404 });

export async function GET(_req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const a = await loadAttempt(id);
  return a ? Response.json(a) : notFound();
}

export async function PATCH(req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";
  const now = new Date();
  const mine = eq(attempts.id, id);

  if (action === "start") {
    await db
      .update(attempts)
      .set({ status: "in_progress", startedAt: now, pausedAt: null, pausedMs: 0 })
      .where(and(mine, eq(attempts.status, "ready")));
  } else if (action === "pause") {
    await db
      .update(attempts)
      .set({ pausedAt: now })
      .where(and(mine, eq(attempts.status, "in_progress"), isNull(attempts.pausedAt)));
  } else if (action === "resume") {
    await db
      .update(attempts)
      .set({
        pausedMs: sql`${attempts.pausedMs} + (extract(epoch from (now() - ${attempts.pausedAt})) * 1000)::int`,
        pausedAt: null,
      })
      .where(and(mine, eq(attempts.status, "in_progress"), isNotNull(attempts.pausedAt)));
  } else if (action === "finish") {
    // If paused, the clock stopped at the moment of pausing.
    await db
      .update(attempts)
      .set({
        status: "finished",
        finishedAt: sql`coalesce(${attempts.pausedAt}, now())`,
        timeTakenMs: sql`greatest(0, (extract(epoch from (coalesce(${attempts.pausedAt}, now()) - ${attempts.startedAt})) * 1000)::int - ${attempts.pausedMs})`,
        pausedAt: null,
      })
      .where(and(mine, eq(attempts.status, "in_progress")));
  } else if (action === "manual") {
    const minutes = Math.round(Number(body?.minutes));
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 900) {
      return Response.json({ error: "Enter the minutes you took (1 to 900)." }, { status: 400 });
    }
    await db
      .update(attempts)
      .set({
        status: "finished",
        startedAt: new Date(now.getTime() - minutes * 60000),
        finishedAt: now,
        timeTakenMs: minutes * 60000,
        pausedAt: null,
        pausedMs: 0,
      })
      .where(and(mine, eq(attempts.status, "ready")));
  } else {
    return Response.json({ error: "Unknown action." }, { status: 400 });
  }

  const a = await loadAttempt(id);
  return a ? Response.json(a) : notFound();
}

/**
 * Moves a paper to the recycle bin. Nothing is destroyed: the question paper stays available to
 * the practice bank, and the report and insights stay so the paper can be restored intact.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  await db.update(attempts).set({ deletedAt: new Date() }).where(eq(attempts.id, id));
  return Response.json({ ok: true, recycled: true });
}

/** Restores a recycled paper. */
export async function PUT(req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (body?.action === "restore") {
    await db.update(attempts).set({ deletedAt: null }).where(eq(attempts.id, id));
    return Response.json({ ok: true, restored: true });
  }
  if (body?.action === "purge") {
    // The one genuinely destructive action, and it is explicit.
    await detachAttemptFromInsights(id);
    await db.delete(attempts).where(eq(attempts.id, id));
    return Response.json({ ok: true, purged: true });
  }
  return Response.json({ error: "Unknown action." }, { status: 400 });
}
