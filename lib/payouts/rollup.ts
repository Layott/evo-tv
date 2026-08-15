import "server-only";
import { and, eq, gte, lt, sum, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Weekly payout rollup. For each non-EVO-owned publisher with eligible
 * revenue in the window, INSERT a `payouts` row with:
 *   gross_ngn = sum of channel revenue attributable to publisher
 *   fee_ngn   = platform cut = gross * (100 - revenue_share_pct) / 100
 *   net_ngn   = gross - fee
 *   status    = pending (admin approval required before transfer)
 *
 * Revenue sources counted toward gross_ngn (v1):
 *   - product orders.total_ngn where status IN ('paid','processing',
 *     'shipped','delivered') and item.productId belongs to a product
 *     owned by the publisher. Phase 3 doesn't yet track product↔channel
 *     ownership, so this is wired but stays 0 until products get
 *     channel_id. Tips are not money yet (just coins) so they don't
 *     contribute NGN - leave them out of gross_ngn for now.
 *
 * Idempotent at the (publisher_id, period_start, period_end) tuple via a
 * single SELECT before INSERT.
 *
 * Result returns a small audit. Date inputs are YYYY-MM-DD UTC, half-open
 * [periodStart, periodEnd).
 */

export interface PayoutRollupResult {
  periodStart: string;
  periodEnd: string;
  publishersConsidered: number;
  payoutsCreated: number;
  payoutsSkipped: number;
}

function genPayoutId(): string {
  return (
    "po_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Returns the Monday-of-last-week UTC date YYYY-MM-DD. */
export function lastWeekStartYmd(): string {
  const d = new Date();
  // Get yesterday's date to avoid edge cases on cron-firing Sunday near midnight.
  d.setUTCDate(d.getUTCDate() - 1);
  const dow = d.getUTCDay(); // 0 Sun, 1 Mon, …
  // Find this week's Monday (or today if Monday), then subtract 7d for last week's Monday.
  const offsetToMonday = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offsetToMonday - 7);
  return d.toISOString().slice(0, 10);
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function rollupPayoutsWeek(
  periodStart: string,
  periodEnd: string,
): Promise<PayoutRollupResult> {
  // Eligible publishers: not EVO-owned, kyc verified.
  const publishers = await db
    .select({
      id: schema.publishers.id,
      revenueSharePct: schema.publishers.revenueSharePct,
    })
    .from(schema.publishers)
    .where(
      and(
        eq(schema.publishers.isEvotvOwned, false),
        eq(schema.publishers.kycState, "verified"),
      ),
    );

  let payoutsCreated = 0;
  let payoutsSkipped = 0;

  for (const pub of publishers) {
    // Skip if a row already exists for this exact period.
    const existing = (
      await db
        .select({ id: schema.payouts.id })
        .from(schema.payouts)
        .where(
          and(
            eq(schema.payouts.publisherId, pub.id),
            eq(schema.payouts.periodStart, periodStart),
            eq(schema.payouts.periodEnd, periodEnd),
          ),
        )
        .limit(1)
    )[0];

    if (existing) {
      payoutsSkipped += 1;
      continue;
    }

    // v1: gross revenue from analytics_daily.product_revenue_ngn +
    // ad_revenue_ngn across this publisher's channels in the window.
    const revRow = (
      await db
        .select({
          product: sum(schema.analyticsDaily.productRevenueNgn).mapWith(Number),
          ad: sum(schema.analyticsDaily.adRevenueNgn).mapWith(Number),
        })
        .from(schema.analyticsDaily)
        .innerJoin(
          schema.channels,
          eq(schema.channels.id, schema.analyticsDaily.channelId),
        )
        .where(
          and(
            eq(schema.channels.publisherId, pub.id),
            gte(schema.analyticsDaily.date, periodStart),
            lt(schema.analyticsDaily.date, periodEnd),
          ),
        )
    )[0];

    const grossNgn = Math.round(
      (revRow?.product ?? 0) + (revRow?.ad ?? 0),
    );
    if (grossNgn === 0) {
      payoutsSkipped += 1;
      continue;
    }

    const sharePct = pub.revenueSharePct ?? 70;
    const feeNgn = Math.round((grossNgn * (100 - sharePct)) / 100);
    const netNgn = grossNgn - feeNgn;

    await db.insert(schema.payouts).values({
      id: genPayoutId(),
      publisherId: pub.id,
      periodStart,
      periodEnd,
      grossNgn,
      feeNgn,
      netNgn,
      status: "pending",
    });

    payoutsCreated += 1;
  }

  // Silence unused import warning for sql tag (kept exposed for future
  // direct-SQL window functions).
  void sql;

  return {
    periodStart,
    periodEnd,
    publishersConsidered: publishers.length,
    payoutsCreated,
    payoutsSkipped,
  };
}
