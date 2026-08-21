import { NextResponse, type NextRequest } from "next/server";
import { scoreAllActiveLeagues } from "@/lib/fantasy/score";
import { writeAudit } from "@/lib/api/audit";

/**
 * Vercel Cron: nightly fantasy scoring.
 *
 * Droplet crontab: `cron.sh fantasy-score`, 05:00 Africa/Lagos.
 *
 * Walks every league with status="active" and recomputes lineup_picks.pointsScored
 * + lineups.totalPoints based on completed matches in the league's game during
 * the (createdAt, endsAt] window.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}. Same shape as the other crons.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Forbidden", { status: 403 });
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

  if (totals.leagues > 0) {
    void writeAudit({
      actorId: null,
      action: "fantasy.score",
      before: null,
      after: { ...totals },
      targetType: "system",
      targetId: "cron",
      meta: totals,
    });
  }

  return NextResponse.json({ ok: true, ...totals, results });
}
