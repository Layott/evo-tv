import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Aggregate `watch_events` for a given UTC date into `analytics_daily`.
 *
 *   watch_minutes     count(*) per channel
 *   unique_viewers    count(distinct coalesce(user_id, ip_hash))
 *   peak_concurrent   max viewers in any minute bucket
 *   tip_*             from tips table
 *
 * Idempotent via INSERT … ON CONFLICT DO UPDATE on (channel_id, date) PK.
 *
 * Date format: "YYYY-MM-DD" UTC.
 */

export interface RollupResult {
  date: string;
  channelsTouched: number;
  watchEventsScanned: number;
  tipsScanned: number;
}

function dayBounds(dateYmd: string): { start: string; end: string } {
  const start = `${dateYmd}T00:00:00.000Z`;
  const endDate = new Date(start);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return { start, end: endDate.toISOString() };
}

export async function rollupDay(dateYmd: string): Promise<RollupResult> {
  const { start, end } = dayBounds(dateYmd);

  // 1) Watch events → views + unique_viewers + watch_minutes + peak_concurrent.
  await db.execute(sql`
    INSERT INTO analytics_daily (
      channel_id, date,
      views, unique_viewers, watch_minutes, peak_concurrent
    )
    SELECT
      channel_id,
      ${dateYmd}::text,
      COUNT(*)::int AS views,
      COUNT(DISTINCT COALESCE(user_id, ip_hash))::int AS unique_viewers,
      COUNT(*)::int AS watch_minutes,
      COALESCE(
        (SELECT MAX(c) FROM (
          SELECT COUNT(*) AS c
          FROM watch_events w2
          WHERE w2.channel_id = w.channel_id
            AND w2.minute_bucket >= ${start}
            AND w2.minute_bucket < ${end}
          GROUP BY w2.minute_bucket
        ) bucket_counts),
        0
      )::int AS peak_concurrent
    FROM watch_events w
    WHERE minute_bucket >= ${start}
      AND minute_bucket < ${end}
    GROUP BY channel_id
    ON CONFLICT (channel_id, date) DO UPDATE SET
      views = EXCLUDED.views,
      unique_viewers = EXCLUDED.unique_viewers,
      watch_minutes = EXCLUDED.watch_minutes,
      peak_concurrent = EXCLUDED.peak_concurrent,
      updated_at = now();
  `);

  // 2) Tips received per channel.
  await db.execute(sql`
    INSERT INTO analytics_daily (
      channel_id, date,
      tip_coins_received, tip_count
    )
    SELECT
      channel_id,
      ${dateYmd}::text,
      COALESCE(SUM(coins), 0)::int AS tip_coins_received,
      COUNT(*)::int AS tip_count
    FROM tips
    WHERE channel_id IS NOT NULL
      AND at >= ${start}
      AND at < ${end}
    GROUP BY channel_id
    ON CONFLICT (channel_id, date) DO UPDATE SET
      tip_coins_received = EXCLUDED.tip_coins_received,
      tip_count = EXCLUDED.tip_count,
      updated_at = now();
  `);

  // Tally for return. postgres-js resolves db.execute to the row array
  // itself; the old neon-http driver wrapped it in { rows }.
  const channels = (await db.execute(
    sql`SELECT COUNT(DISTINCT channel_id)::int AS n FROM analytics_daily WHERE date = ${dateYmd}::text`,
  )) as unknown as Array<{ n: number }>;
  const we = (await db.execute(
    sql`SELECT COUNT(*)::int AS n FROM watch_events WHERE minute_bucket >= ${start} AND minute_bucket < ${end}`,
  )) as unknown as Array<{ n: number }>;
  const tips = (await db.execute(
    sql`SELECT COUNT(*)::int AS n FROM tips WHERE channel_id IS NOT NULL AND at >= ${start} AND at < ${end}`,
  )) as unknown as Array<{ n: number }>;

  return {
    date: dateYmd,
    channelsTouched: channels[0]?.n ?? 0,
    watchEventsScanned: we[0]?.n ?? 0,
    tipsScanned: tips[0]?.n ?? 0,
  };
}

export function yesterdayYmd(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
