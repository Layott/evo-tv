import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdminFromRequest, writeAudit } from "@/lib/api/admin";
import { scorePickemForEvent } from "@/lib/pickem/score";
import { scoreAllActiveLeagues } from "@/lib/fantasy/score";

const bodySchema = z.object({
  scoreA: z.number().int().min(0),
  scoreB: z.number().int().min(0),
  state: z.enum(["scheduled", "live", "completed"]).default("completed"),
});

/**
 * POST /api/admin/matches/[id]/result - admin only.
 *
 * Sets a match's scoreA/scoreB/state. If state="completed" (default),
 * automatically re-runs pickem scoring for the parent event so the
 * leaderboard updates immediately.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const existing = (
    await db
      .select({ id: schema.matches.id, eventId: schema.matches.eventId })
      .from(schema.matches)
      .where(eq(schema.matches.id, id))
      .limit(1)
  )[0];
  if (!existing) {
    return new NextResponse("Match not found", { status: 404 });
  }

  await db
    .update(schema.matches)
    .set({
      scoreA: parsed.data.scoreA,
      scoreB: parsed.data.scoreB,
      state: parsed.data.state,
    })
    .where(eq(schema.matches.id, id));

  let scoreResult: Awaited<ReturnType<typeof scorePickemForEvent>> | null = null;
  let fantasyResult: Awaited<ReturnType<typeof scoreAllActiveLeagues>> | null = null;
  if (parsed.data.state === "completed") {
    scoreResult = await scorePickemForEvent(existing.eventId);
    try {
      fantasyResult = await scoreAllActiveLeagues();
    } catch (err) {
      console.error("fantasy re-score on match-result failed", err);
    }
  }

  void writeAudit({
    actorId: guard.user.id,
    action: "update",
    targetType: "event",
    targetId: existing.eventId,
    meta: {
      event: "match_result",
      matchId: id,
      scoreA: parsed.data.scoreA,
      scoreB: parsed.data.scoreB,
      state: parsed.data.state,
      pickemScoreRecomputed: scoreResult !== null,
      fantasyScoreRecomputed: fantasyResult !== null,
    },
  });

  return NextResponse.json({
    ok: true,
    matchId: id,
    eventId: existing.eventId,
    pickemScore: scoreResult,
    fantasyScore: fantasyResult,
  });
}
