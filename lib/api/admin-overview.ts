import "server-only";
import { and, count, eq, gte, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Everything the admin landing page shows, in one round trip.
 *
 * The page used to make four separate calls, two of which pulled fifty full
 * rows in order to count them and show five, and its headline chart plotted a
 * field the endpoint does not return, so the x-axis came out blank.
 *
 * The rule for what earns a place here: it has to be a number somebody would
 * act on this morning. Totals that only ever go up are not that, which is why
 * there is no "total users" tile and there is a "needs attention" list.
 */

const PREMIUM_TIERS = ["premium", "pro", "supporter"] as const;

export interface AdminOverview {
  liveStreams: number;
  liveViewers: number;
  viewsToday: number;
  viewsYesterday: number;
  watchTimeSec7d: number;
  signupsToday: number;
  signups7d: number;
  activePremiumSubs: number;
  mrrNgn: number;
  revenueThisMonthNgn: number;
  viewsByDay: { date: string; views: number }[];
  attention: { id: string; tone: "red" | "amber"; title: string; body: string; href: string }[];
}

function dayKey(offsetDays = 0): string {
  const d = new Date(Date.now() - offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export async function adminOverview(): Promise<AdminOverview> {
  /*
   * UTC boundaries throughout, because `dayKey` builds its keys from
   * `toISOString()`. Snapping these to local midnight instead shifts the series
   * by the server's offset and today drops out of the range entirely.
   *
   * "Signups today" is the deliberate exception: an operator asking how many
   * people joined today means their day, so it stays local.
   */
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 6 * 86_400_000);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(Date.now() - 29 * 86_400_000);
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const premiumFilter = sql`${schema.subscriptions.tier} IN (${sql.join(
    PREMIUM_TIERS.map((t) => sql`${t}`),
    sql`, `,
  )})`;

  const [
    liveRows,
    signupsTodayRow,
    signups7dRow,
    premiumRow,
    monthRevenueRow,
    viewSessions,
    watch7dRow,
    openReportsRow,
    unshippedRow,
    pastDueRow,
    emptyEpisodesRow,
  ] = await Promise.all([
    // Viewer counts live on the stream rows, so one query answers both tiles.
    db
      .select({
        c: sql<number>`count(*)`,
        viewers: sql<number>`coalesce(sum(${schema.streams.viewerCount}), 0)`,
      })
      .from(schema.streams)
      .where(eq(schema.streams.isLive, true)),

    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.user)
      .where(gte(schema.user.createdAt, startOfToday)),

    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.user)
      .where(gte(schema.user.createdAt, sevenDaysAgo)),

    db
      .select({
        c: sql<number>`count(*)`,
        mrr: sql<number>`coalesce(sum(${schema.subscriptions.priceNgn}), 0)`,
      })
      .from(schema.subscriptions)
      .where(and(eq(schema.subscriptions.status, "active"), premiumFilter)),

    db
      .select({
        total: sql<number>`coalesce(sum(${schema.orders.totalNgn}), 0)`,
      })
      .from(schema.orders)
      .where(
        and(
          gte(schema.orders.createdAt, startOfMonth.toISOString()),
          sql`${schema.orders.status} IN ('paid', 'processing', 'shipped', 'delivered')`,
        ),
      ),

    /*
     * One row per playback session, dated by its first beat.
     *
     * Counting bucket rows instead would count a single long watch as a
     * hundred views. Grouping by session and taking the earliest timestamp is
     * what makes a view a view.
     */
    db
      .select({
        // UTC, to match the day keys built with `toISOString()` below. Left to
        // the database session's timezone the two disagree by a day.
        date: sql<string>`to_char(min(${schema.videoViewBuckets.createdAt}) at time zone 'UTC', 'YYYY-MM-DD')`,
      })
      .from(schema.videoViewBuckets)
      .where(gte(schema.videoViewBuckets.createdAt, thirtyDaysAgo.toISOString()))
      .groupBy(
        schema.videoViewBuckets.videoType,
        schema.videoViewBuckets.videoId,
        schema.videoViewBuckets.sessionId,
      ),

    /*
     * Watch time needs each video's runtime, because a bucket row is one
     * percent of *that* video. Joined against both catalogues and summed as
     * runtime/100 per row.
     */
    db
      .select({
        seconds: sql<number>`coalesce(sum(coalesce(${schema.vods.durationSec}, ${schema.episodes.runtimeSec}, 0) / 100.0), 0)`,
      })
      .from(schema.videoViewBuckets)
      .leftJoin(
        schema.vods,
        and(
          eq(schema.videoViewBuckets.videoType, "vod"),
          eq(schema.videoViewBuckets.videoId, schema.vods.id),
        ),
      )
      .leftJoin(
        schema.episodes,
        and(
          eq(schema.videoViewBuckets.videoType, "episode"),
          eq(schema.videoViewBuckets.videoId, schema.episodes.id),
        ),
      )
      .where(gte(schema.videoViewBuckets.createdAt, sevenDaysAgo.toISOString())),

    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.contentReports)
      .where(eq(schema.contentReports.status, "open")),

    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.orders)
      .where(sql`${schema.orders.status} IN ('paid', 'processing')`),

    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.status, "past_due")),

    // A published episode with no video is a dead link on the public site.
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.episodes)
      .where(
        and(
          isNull(schema.episodes.deletedAt),
          sql`(${schema.episodes.hlsUrl} is null or ${schema.episodes.hlsUrl} = '')`,
          sql`${schema.episodes.releasedAt} is not null`,
        ),
      ),
  ]);

  // Zero-fill so a quiet day is a zero rather than a gap the chart bridges.
  const counts = new Map<string, number>();
  for (const r of viewSessions) {
    if (r.date) counts.set(r.date, (counts.get(r.date) ?? 0) + 1);
  }
  const viewsByDay: { date: string; views: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const key = dayKey(i);
    viewsByDay.push({ date: key, views: counts.get(key) ?? 0 });
  }

  const attention: AdminOverview["attention"] = [];
  const openReports = Number(openReportsRow[0]?.c ?? 0);
  const unshipped = Number(unshippedRow[0]?.c ?? 0);
  const pastDue = Number(pastDueRow[0]?.c ?? 0);
  const emptyEpisodes = Number(emptyEpisodesRow[0]?.c ?? 0);

  if (openReports > 0) {
    attention.push({
      id: "reports",
      tone: "red",
      title: `${openReports} open report${openReports === 1 ? "" : "s"}`,
      body: "Someone flagged content and nobody has ruled on it.",
      href: "/admin/moderation",
    });
  }
  if (unshipped > 0) {
    attention.push({
      id: "orders",
      tone: "amber",
      title: `${unshipped} order${unshipped === 1 ? "" : "s"} to ship`,
      body: "Paid for, not yet marked shipped.",
      href: "/admin/orders",
    });
  }
  if (pastDue > 0) {
    attention.push({
      id: "past-due",
      tone: "amber",
      title: `${pastDue} subscription${pastDue === 1 ? "" : "s"} past due`,
      body: "Payment failed and the account still has premium.",
      href: "/admin/subscriptions",
    });
  }
  if (emptyEpisodes > 0) {
    attention.push({
      id: "empty-episodes",
      tone: "amber",
      title: `${emptyEpisodes} released episode${emptyEpisodes === 1 ? "" : "s"} with no video`,
      body: "Listed on the site with nothing to play.",
      href: "/admin/shows",
    });
  }

  const today = dayKey(0);
  const yesterday = dayKey(1);

  return {
    liveStreams: Number(liveRows[0]?.c ?? 0),
    liveViewers: Number(liveRows[0]?.viewers ?? 0),
    viewsToday: counts.get(today) ?? 0,
    viewsYesterday: counts.get(yesterday) ?? 0,
    watchTimeSec7d: Math.round(Number(watch7dRow[0]?.seconds ?? 0)),
    signupsToday: Number(signupsTodayRow[0]?.c ?? 0),
    signups7d: Number(signups7dRow[0]?.c ?? 0),
    activePremiumSubs: Number(premiumRow[0]?.c ?? 0),
    mrrNgn: Number(premiumRow[0]?.mrr ?? 0),
    revenueThisMonthNgn: Number(monthRevenueRow[0]?.total ?? 0),
    viewsByDay,
    attention,
  };
}
