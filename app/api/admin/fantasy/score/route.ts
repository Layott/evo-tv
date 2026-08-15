import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { writeAudit } from "@/lib/api/audit";
import { scoreAllActiveLeagues, scoreFantasyForLeague } from "@/lib/fantasy/score";

const bodySchema = z.object({
  leagueId: z.string().optional(),
});

/**
 * POST /api/admin/fantasy/score - admin only.
 *
 * Body: { leagueId?: string }
 *   - With leagueId → score that single league.
 *   - Without → score every league with status="active". Same call shape as
 *     the nightly cron.
 *
 * Used as a manual trigger for testing + the admin-side "Recompute now"
 * button when wired up.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is OK - score all active.
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const targetLeagueId = parsed.data.leagueId;

  if (targetLeagueId) {
    const result = await scoreFantasyForLeague(targetLeagueId);
    void writeAudit({
      actorId: guard.user.id,
      action: "fantasy.score",
      targetType: "fantasy_league",
      targetId: targetLeagueId,
      meta: { ...result },
    });
    return NextResponse.json({ ok: true, result });
  }

  const results = await scoreAllActiveLeagues();
  const totals = results.reduce(
    (acc, r) => ({
      leagues: acc.leagues + 1,
      picks: acc.picks + r.picksUpdated,
      lineups: acc.lineups + r.lineupsUpdated,
    }),
    { leagues: 0, picks: 0, lineups: 0 },
  );
  void writeAudit({
    actorId: guard.user.id,
    action: "fantasy.score",
    targetType: "system",
    targetId: "manual",
    meta: totals,
  });
  return NextResponse.json({ ok: true, ...totals, results });
}
