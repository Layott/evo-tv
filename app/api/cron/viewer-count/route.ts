import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Refresh `streams.viewer_count` from the last 60s of `watch_events`
 * heartbeats. Run frequently (every minute) via Vercel Cron.
 *
 * Algorithm: for each live stream, count distinct (user_id, ip_hash) in
 * the last 60s on its channel. Also update peak_viewer_count = MAX.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 *
 * Why polled-update vs Redis HLL: avoids new infra dep at MVP scale.
 * Switch to Redis HLL when concurrent viewer count per channel > ~500
 * (Postgres query gets too hot otherwise).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Update each live stream's viewer_count from watch_events in the last 60s.
  // Also bump peak_viewer_count.
  const result = (await db.execute(sql`
    WITH live_counts AS (
      SELECT
        s.id AS stream_id,
        COUNT(DISTINCT COALESCE(w.user_id, w.ip_hash))::int AS viewers
      FROM streams s
      LEFT JOIN watch_events w
        ON w.channel_id = s.channel_id
       AND w.minute_bucket >= TO_CHAR(NOW() - INTERVAL '60 seconds', 'YYYY-MM-DD"T"HH24:MI:00.000"Z"')
      WHERE s.is_live = true
      GROUP BY s.id
    )
    UPDATE streams s
    SET viewer_count = lc.viewers,
        peak_viewer_count = GREATEST(s.peak_viewer_count, lc.viewers)
    FROM live_counts lc
    WHERE s.id = lc.stream_id
    RETURNING s.id, lc.viewers;
  `)) as { rows: Array<{ id: string; viewers: number }> };

  return NextResponse.json({
    streamsRefreshed: result.rows.length,
    counts: result.rows,
  });
}
