import "server-only";
import { and, desc, eq, gte, isNotNull, lt, sql, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { daysInRange, resolveRange, type RangeInput } from "@/lib/analytics/range";

const PREMIUM_TIERS = ["premium", "pro", "supporter"] as const;

/* ------------------------------------------------------------------ */
/* Overview                                                           */
/* ------------------------------------------------------------------ */

export interface OverviewMetrics {
  liveStreams: number;
  todaySignups: number;
  activePremiumSubs: number;
  mrrNgn: number;
}

export async function overviewMetrics(): Promise<OverviewMetrics> {
  const liveStreamsRow = (
    await db
      .select({ c: sql<number>`count(*)` })
      .from(schema.streams)
      .where(eq(schema.streams.isLive, true))
      .limit(1)
  )[0];

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todaySignupsRow = (
    await db
      .select({ c: sql<number>`count(*)` })
      .from(schema.user)
      .where(gte(schema.user.createdAt, startOfToday))
      .limit(1)
  )[0];

  const activePremiumRow = (
    await db
      .select({ c: sql<number>`count(*)` })
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.status, "active"),
          sql`${schema.subscriptions.tier} IN (${sql.join(
            PREMIUM_TIERS.map((t) => sql`${t}`),
            sql`, `
          )})`
        )
      )
      .limit(1)
  )[0];

  const mrrRow = (
    await db
      .select({ total: sql<number>`coalesce(sum(${schema.subscriptions.priceNgn}), 0)` })
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.status, "active"),
          sql`${schema.subscriptions.tier} IN (${sql.join(
            PREMIUM_TIERS.map((t) => sql`${t}`),
            sql`, `
          )})`
        )
      )
      .limit(1)
  )[0];

  return {
    liveStreams: Number(liveStreamsRow?.c ?? 0),
    todaySignups: Number(todaySignupsRow?.c ?? 0),
    activePremiumSubs: Number(activePremiumRow?.c ?? 0),
    mrrNgn: Number(mrrRow?.total ?? 0),
  };
}

/* ------------------------------------------------------------------ */
/* Views over time                                                    */
/* ------------------------------------------------------------------ */

export interface ViewsPoint {
  date: string; // YYYY-MM-DD
  views: number;
}

/**
 * Views per day: recordings and live, added together.
 *
 * Recordings come from `vod_progress` upserts. Live comes from `watch_events`,
 * counted as distinct people per stream per day. Until 20 August only the first
 * half was here, so a channel broadcasting around the clock with an empty
 * catalogue drew a flat zero and the owner reasonably said the page did not
 * work.
 */
export async function viewsOverTime(
  range: RangeInput | number = 30,
): Promise<ViewsPoint[]> {
  /*
   * The window comes from `lib/analytics/range.ts` so this can answer a chosen
   * date as well as a preset, and so it stops disagreeing with itself: the day
   * keys are UTC (they are a `substr` of an ISO string) while the start of the
   * range was snapped to *local* midnight. On the Lagos droplet that is an hour
   * out, so the first day of every chart was short by an hour of views and the
   * chart could not be reconciled with the headline beside it.
   */
  const window = resolveRange(typeof range === "number" ? { days: range } : range);

  const [rows, liveRows] = await Promise.all([
    db
      .select({
        day: sql<string>`substr(${schema.vodProgress.updatedAt}, 1, 10)`,
        views: sql<number>`count(*)`,
      })
      .from(schema.vodProgress)
      .where(
        and(
          gte(schema.vodProgress.updatedAt, window.since),
          lt(schema.vodProgress.updatedAt, window.until),
        ),
      )
      .groupBy(sql`substr(${schema.vodProgress.updatedAt}, 1, 10)`),

    /*
     * Live viewing, which this chart could not see.
     *
     * It counted progress on recordings and nothing else, so a channel that is
     * live around the clock with an empty catalogue drew a flat zero while
     * people were watching it. One person on one stream on one day is one view;
     * `watch_events` carries a row per viewer per minute, so the distinct count
     * is the honest number.
     */
    db
      .select({
        day: sql<string>`to_char(${schema.watchEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        views: sql<number>`count(distinct (coalesce(${schema.watchEvents.userId}, ${schema.watchEvents.ipHash}) || ':' || coalesce(${schema.watchEvents.streamId}, '')))`,
      })
      .from(schema.watchEvents)
      .where(
        and(
          gte(schema.watchEvents.createdAt, window.since),
          lt(schema.watchEvents.createdAt, window.until),
        ),
      )
      .groupBy(sql`to_char(${schema.watchEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`),
  ]);

  const byDay = new Map<string, number>();
  for (const r of rows) {
    if (r.day) byDay.set(r.day, Number(r.views ?? 0));
  }
  for (const r of liveRows) {
    if (r.day) byDay.set(r.day, (byDay.get(r.day) ?? 0) + Number(r.views ?? 0));
  }

  return daysInRange(window).map((date) => ({
    date,
    views: byDay.get(date) ?? 0,
  }));
}

/* ------------------------------------------------------------------ */
/* Retention cohort                                                   */
/* ------------------------------------------------------------------ */

/**
 * Who came back, by the week they signed up in.
 *
 * `cell[w][k]` is the share of the cohort that watched something in week k
 * after signing up. Watching means a live broadcast or a recording: counting
 * only recordings made the entire grid read 0% on a channel that is live
 * around the clock, which is what the owner was looking at.
 */
export async function retentionCohort(weeks = 8): Promise<{
  cohorts: { weekStart: string; size: number }[];
  matrix: number[][]; // matrix[cohortIdx][weekOffset]
}> {
  const safeWeeks = Math.max(1, Math.min(52, Math.trunc(weeks)));
  const now = new Date();

  // Week start = Monday UTC.
  const dayOfWeek = now.getUTCDay(); // 0=Sun
  const mondayOffset = (dayOfWeek + 6) % 7;
  const thisMonday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  thisMonday.setUTCDate(thisMonday.getUTCDate() - mondayOffset);

  const cohortStarts: Date[] = [];
  for (let i = 0; i < safeWeeks; i++) {
    cohortStarts.push(
      new Date(thisMonday.getTime() - (safeWeeks - 1 - i) * 7 * 86_400_000)
    );
  }
  // cohortStarts is oldest-first.

  const earliest = cohortStarts[0];
  const users = await db
    .select({ id: schema.user.id, createdAt: schema.user.createdAt })
    .from(schema.user)
    .where(gte(schema.user.createdAt, earliest));

  // Bucket users into their signup cohort index.
  const cohortUsers: string[][] = cohortStarts.map(() => []);
  for (const u of users) {
    const createdMs =
      typeof u.createdAt === "number"
        ? u.createdAt
        : u.createdAt instanceof Date
        ? u.createdAt.getTime()
        : new Date(u.createdAt as unknown as string).getTime();
    const idx = Math.floor(
      (createdMs - earliest.getTime()) / (7 * 86_400_000)
    );
    if (idx >= 0 && idx < safeWeeks) cohortUsers[idx].push(u.id);
  }

  /*
   * Coming back means watching something. Either kind of something.
   *
   * This counted `vod_progress` and nothing else, so on a platform whose
   * catalogue is empty and whose channel is live around the clock the whole
   * grid was 0%, permanently, and said nothing about anybody. A live viewer is
   * as returned as a viewer of a recording, and `watch_events` has been
   * recording them the whole time.
   */
  const [progressRows, liveRows] = await Promise.all([
    db
      .select({
        userId: schema.vodProgress.userId,
        updatedAt: schema.vodProgress.updatedAt,
      })
      .from(schema.vodProgress)
      .where(gte(schema.vodProgress.updatedAt, earliest.toISOString())),

    // Signed-in beats only: an anonymous viewer cannot belong to a signup
    // cohort, so counting them would inflate the denominator's answer with
    // people the numerator can never find.
    db
      .select({
        userId: schema.watchEvents.userId,
        updatedAt: schema.watchEvents.createdAt,
      })
      .from(schema.watchEvents)
      .where(
        and(
          gte(schema.watchEvents.createdAt, earliest.toISOString()),
          isNotNull(schema.watchEvents.userId),
        ),
      ),
  ]);

  const activity: { userId: string; updatedAt: string }[] = [
    ...progressRows,
    ...liveRows.map((r) => ({ userId: r.userId as string, updatedAt: r.updatedAt })),
  ];

  // userId -> Set of week offsets (since their cohort start) where they had activity.
  const userToCohortIdx = new Map<string, number>();
  for (let i = 0; i < safeWeeks; i++) {
    for (const uid of cohortUsers[i]) userToCohortIdx.set(uid, i);
  }

  const userActiveWeeks = new Map<string, Set<number>>();
  for (const p of activity) {
    const cohortIdx = userToCohortIdx.get(p.userId);
    if (cohortIdx === undefined) continue;
    const cohortStart = cohortStarts[cohortIdx];
    const progressMs = new Date(p.updatedAt).getTime();
    const offset = Math.floor(
      (progressMs - cohortStart.getTime()) / (7 * 86_400_000)
    );
    if (offset < 0 || offset >= safeWeeks) continue;
    let s = userActiveWeeks.get(p.userId);
    if (!s) {
      s = new Set<number>();
      userActiveWeeks.set(p.userId, s);
    }
    s.add(offset);
  }

  const matrix: number[][] = [];
  const cohortsMeta: { weekStart: string; size: number }[] = [];
  for (let i = 0; i < safeWeeks; i++) {
    const members = cohortUsers[i];
    cohortsMeta.push({
      weekStart: cohortStarts[i].toISOString().slice(0, 10),
      size: members.length,
    });
    const row: number[] = [];
    for (let k = 0; k < safeWeeks; k++) {
      if (members.length === 0) {
        row.push(0);
        continue;
      }
      let hit = 0;
      for (const uid of members) {
        if (userActiveWeeks.get(uid)?.has(k)) hit++;
      }
      row.push(Math.round((hit / members.length) * 1000) / 10);
    }
    matrix.push(row);
  }

  return { cohorts: cohortsMeta, matrix };
}

/* ------------------------------------------------------------------ */
/* Revenue by month                                                   */
/* ------------------------------------------------------------------ */

export interface RevenuePoint {
  month: string; // YYYY-MM
  ngn: number;
}

export async function revenueByMonth(months = 6): Promise<RevenuePoint[]> {
  const safeMonths = Math.max(1, Math.min(36, Math.trunc(months)));
  const now = new Date();
  const firstMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (safeMonths - 1), 1)
  );
  const firstIso = firstMonth.toISOString();

  const subRows = await db
    .select({
      month: sql<string>`substr(${schema.subscriptions.createdAt}, 1, 7)`,
      total: sql<number>`coalesce(sum(${schema.subscriptions.priceNgn}), 0)`,
    })
    .from(schema.subscriptions)
    .where(gte(schema.subscriptions.createdAt, firstIso))
    .groupBy(sql`substr(${schema.subscriptions.createdAt}, 1, 7)`);

  const orderRows = await db
    .select({
      month: sql<string>`substr(${schema.orders.createdAt}, 1, 7)`,
      total: sql<number>`coalesce(sum(${schema.orders.totalNgn}), 0)`,
    })
    .from(schema.orders)
    .where(
      and(
        gte(schema.orders.createdAt, firstIso),
        inArray(schema.orders.status, [
          "paid",
          "shipped",
          "delivered",
          "processing",
        ])
      )
    )
    .groupBy(sql`substr(${schema.orders.createdAt}, 1, 7)`);

  const totals = new Map<string, number>();
  for (const r of subRows) totals.set(r.month, Number(r.total ?? 0));
  for (const r of orderRows) {
    totals.set(r.month, (totals.get(r.month) ?? 0) + Number(r.total ?? 0));
  }

  const out: RevenuePoint[] = [];
  for (let i = 0; i < safeMonths; i++) {
    const d = new Date(
      Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + i, 1)
    );
    const key = d.toISOString().slice(0, 7);
    out.push({ month: key, ngn: totals.get(key) ?? 0 });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Top VODs                                                           */
/* ------------------------------------------------------------------ */

export async function topVods(
  limit = 10
): Promise<(typeof schema.vods.$inferSelect)[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return await db
    .select()
    .from(schema.vods)
    .orderBy(desc(schema.vods.viewCount))
    .limit(safeLimit);
}

/* ------------------------------------------------------------------ */
/* Free → Premium conversion                                          */
/* ------------------------------------------------------------------ */

export async function freeToPremiumConversionPct(): Promise<{
  totalUsers: number;
  convertedUsers: number;
  pct: number;
}> {
  const totalRow = (
    await db
      .select({ c: sql<number>`count(*)` })
      .from(schema.user)
      .limit(1)
  )[0];
  const totalUsers = Number(totalRow?.c ?? 0);

  const convertedRow = (
    await db
      .select({
        c: sql<number>`count(distinct ${schema.subscriptions.userId})`,
      })
      .from(schema.subscriptions)
      .limit(1)
  )[0];
  const convertedUsers = Number(convertedRow?.c ?? 0);

  const pct =
    totalUsers === 0
      ? 0
      : Math.round((convertedUsers / totalUsers) * 10000) / 100;
  return { totalUsers, convertedUsers, pct };
}
