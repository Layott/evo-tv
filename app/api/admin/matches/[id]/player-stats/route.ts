import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireCapability, writeAudit } from "@/lib/api/admin";
import { scoreAllActiveLeagues } from "@/lib/fantasy/score";

const statSchema = z.object({
  playerId: z.string().min(1),
  kills: z.number().int().min(0).default(0),
  deaths: z.number().int().min(0).default(0),
  assists: z.number().int().min(0).default(0),
  objectives: z.number().int().min(0).default(0),
});

const bodySchema = z.object({
  stats: z.array(statSchema).max(50),
  /**
   * If true, re-score every active fantasy league after the upsert. Pickem
   * scoring already runs on the /result endpoint, so this defaults to false.
   */
  rescore: z.boolean().default(false),
});

/**
 * POST /api/admin/matches/[id]/player-stats - admin only.
 *
 * Body: { stats: [{playerId, kills, deaths, assists, objectives}], rescore? }
 *
 * Upserts per-player stats for a single match. Fantasy scoring v2 reads these
 * rows; matches without entries fall back to the team-proxy formula.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCapability("editorial");
  if (!guard.ok) return guard.response;

  const { id: matchId } = await params;

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
      .select({ id: schema.matches.id })
      .from(schema.matches)
      .where(eq(schema.matches.id, matchId))
      .limit(1)
  )[0];
  if (!existing) {
    return new NextResponse("Match not found", { status: 404 });
  }

  // Upsert each stat row. Composite PK is (match_id, player_id).
  for (const s of parsed.data.stats) {
    const has = (
      await db
        .select({ matchId: schema.matchPlayerStats.matchId })
        .from(schema.matchPlayerStats)
        .where(
          and(
            eq(schema.matchPlayerStats.matchId, matchId),
            eq(schema.matchPlayerStats.playerId, s.playerId),
          ),
        )
        .limit(1)
    )[0];
    if (has) {
      await db
        .update(schema.matchPlayerStats)
        .set({
          kills: s.kills,
          deaths: s.deaths,
          assists: s.assists,
          objectives: s.objectives,
        })
        .where(
          and(
            eq(schema.matchPlayerStats.matchId, matchId),
            eq(schema.matchPlayerStats.playerId, s.playerId),
          ),
        );
    } else {
      await db.insert(schema.matchPlayerStats).values({
        matchId,
        playerId: s.playerId,
        kills: s.kills,
        deaths: s.deaths,
        assists: s.assists,
        objectives: s.objectives,
      });
    }
  }

  let fantasy: Awaited<ReturnType<typeof scoreAllActiveLeagues>> | null = null;
  if (parsed.data.rescore) {
    try {
      fantasy = await scoreAllActiveLeagues();
    } catch (err) {
      console.error("fantasy re-score on player-stats failed", err);
    }
  }

  void writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "editorial",
    action: "update",
    before: null,
    after: { rows: parsed.data.stats.length, rescored: fantasy !== null },
    targetType: "event",
    targetId: matchId,
    meta: {
      event: "match_player_stats",
      matchId,
      rows: parsed.data.stats.length,
      rescore: fantasy !== null,
    },
  });

  return NextResponse.json({
    ok: true,
    matchId,
    rowsUpserted: parsed.data.stats.length,
    fantasy,
  });
}
