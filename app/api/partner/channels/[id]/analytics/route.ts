import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requirePublisherRoleByChannel } from "@/lib/auth/guards";

/**
 * GET /api/partner/channels/[id]/analytics?period=7d|30d|90d|all
 *
 * Returns daily rows from analytics_daily for the channel + a summary
 * roll-up (totals over the period). Auth: publisher viewer or higher,
 * or EVO admin.
 */

type Period = "7d" | "30d" | "90d" | "all";

function periodBounds(period: Period): { from?: string; to?: string } {
  if (period === "all") return {};
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const to = new Date();
  to.setUTCDate(to.getUTCDate() - 1); // yesterday — most-recent rolled-up day
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const guard = await requirePublisherRoleByChannel(id, "viewer");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const periodParam = (url.searchParams.get("period") ?? "30d") as Period;
  const period: Period =
    periodParam === "7d" ||
    periodParam === "30d" ||
    periodParam === "90d" ||
    periodParam === "all"
      ? periodParam
      : "30d";
  const { from, to } = periodBounds(period);

  const conds = [eq(schema.analyticsDaily.channelId, id)];
  if (from) conds.push(gte(schema.analyticsDaily.date, from));
  if (to) conds.push(lte(schema.analyticsDaily.date, to));

  const rows = await db
    .select()
    .from(schema.analyticsDaily)
    .where(and(...conds))
    .orderBy(asc(schema.analyticsDaily.date));

  const totals = rows.reduce(
    (acc, r) => ({
      views: acc.views + r.views,
      uniqueViewers: acc.uniqueViewers + r.uniqueViewers,
      watchMinutes: acc.watchMinutes + r.watchMinutes,
      peakConcurrent: Math.max(acc.peakConcurrent, r.peakConcurrent),
      tipCoinsReceived: acc.tipCoinsReceived + r.tipCoinsReceived,
      tipCount: acc.tipCount + r.tipCount,
      followersGained: acc.followersGained + r.followersGained,
      followersLost: acc.followersLost + r.followersLost,
      productOrders: acc.productOrders + r.productOrders,
      productRevenueNgn: acc.productRevenueNgn + r.productRevenueNgn,
    }),
    {
      views: 0,
      uniqueViewers: 0,
      watchMinutes: 0,
      peakConcurrent: 0,
      tipCoinsReceived: 0,
      tipCount: 0,
      followersGained: 0,
      followersLost: 0,
      productOrders: 0,
      productRevenueNgn: 0,
    },
  );

  return NextResponse.json({
    channelId: id,
    period,
    from: from ?? null,
    to: to ?? null,
    rows,
    totals,
  });
}
