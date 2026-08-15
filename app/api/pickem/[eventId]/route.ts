import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";

const submitSchema = z.object({
  picks: z
    .array(
      z.object({
        matchId: z.string().min(1).max(128),
        winnerTeamId: z.string().min(1).max(128),
      }),
    )
    .min(1)
    .max(64),
});

/**
 * GET - caller's submission for this event (or 404 if not submitted).
 * POST - upsert submission. Locks once any match in the bracket starts.
 *        Phase 1 doesn't enforce the lock - admin verifies bracket state
 *        before allowing entries via the event status field.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { eventId } = await params;
  const entry = (
    await db
      .select()
      .from(schema.pickemEntries)
      .where(
        and(
          eq(schema.pickemEntries.eventId, eventId),
          eq(schema.pickemEntries.userId, user.id),
        ),
      )
      .limit(1)
  )[0];
  if (!entry) return new NextResponse("No entry", { status: 404 });
  return NextResponse.json(entry);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { eventId } = await params;

  const ev = (
    await db
      .select({ id: schema.events.id, status: schema.events.status })
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .limit(1)
  )[0];
  if (!ev) return new NextResponse("Event not found", { status: 404 });
  if (ev.status !== "scheduled") {
    return new NextResponse("Bracket locked", { status: 409 });
  }

  const parsed = submitSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  await db
    .insert(schema.pickemEntries)
    .values({
      eventId,
      userId: user.id,
      picks: parsed.data.picks,
      score: 0,
    })
    .onConflictDoUpdate({
      target: [schema.pickemEntries.eventId, schema.pickemEntries.userId],
      set: { picks: parsed.data.picks },
    });

  return NextResponse.json({ ok: true });
}
