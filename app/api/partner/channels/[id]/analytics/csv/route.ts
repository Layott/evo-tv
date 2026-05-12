import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requirePublisherRoleByChannel } from "@/lib/auth/guards";

/**
 * GET /api/partner/channels/[id]/analytics/csv?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Streams a CSV export of analytics_daily for the channel.
 */

function escapeCsv(v: string | number): string {
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const guard = await requirePublisherRoleByChannel(id, "viewer");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";

  const conds = [eq(schema.analyticsDaily.channelId, id)];
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from))
    conds.push(gte(schema.analyticsDaily.date, from));
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to))
    conds.push(lte(schema.analyticsDaily.date, to));

  const rows = await db
    .select()
    .from(schema.analyticsDaily)
    .where(and(...conds))
    .orderBy(asc(schema.analyticsDaily.date));

  const header = [
    "date",
    "views",
    "unique_viewers",
    "watch_minutes",
    "peak_concurrent",
    "tip_coins_received",
    "tip_count",
    "followers_gained",
    "followers_lost",
    "product_orders",
    "product_revenue_ngn",
  ];

  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.date,
        r.views,
        r.uniqueViewers,
        r.watchMinutes,
        r.peakConcurrent,
        r.tipCoinsReceived,
        r.tipCount,
        r.followersGained,
        r.followersLost,
        r.productOrders,
        r.productRevenueNgn,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  const body = lines.join("\n") + "\n";
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${id}-analytics.csv"`,
    },
  });
}
