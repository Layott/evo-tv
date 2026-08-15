import "server-only";
import { and, desc, eq, gte, sql, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";

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
 * Returns per-day view-count proxy using `vod_progress.updatedAt` bucketed
 * by day for the last N days. We also fold in a small baseline from
 * vods.viewCount so empty days still trend plausibly - but the main signal
 * is progress upserts.
 */
export async function viewsOverTime(days = 30): Promise<ViewsPoint[]> {
  const safeDays = Math.max(1, Math.min(365, Math.trunc(days)));
  const now = new Date();
  const start = new Date(now.getTime() - (safeDays - 1) * 86_400_000);
  start.setHours(0, 0, 0, 0);
  const startIso = start.toISOString();

  const rows = await db
    .select({
      day: sql<string>`substr(${schema.vodProgress.updatedAt}, 1, 10)`,
      views: sql<number>`count(*)`,
    })
    .from(schema.vodProgress)
    .where(gte(schema.vodProgress.updatedAt, startIso))
    .groupBy(sql`substr(${schema.vodProgress.updatedAt}, 1, 10)`);

  const byDay = new Map<string, number>();
  for (const r of rows) {
    if (r.day) byDay.set(r.day, Number(r.views ?? 0));
  }

  const out: ViewsPoint[] = [];
  for (let i = 0; i < safeDays; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, views: byDay.get(key) ?? 0 });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Retention cohort                                                   */
/* ------------------------------------------------------------------ */

/**
 * Returns an N x N matrix: rows = signup-week cohorts (most-recent first),
 * cell[w][k] = percentage of that cohort who had at least one
 * `vod_progress` row in week k after signup.
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

  // Pull all vod_progress rows for any user we care about (>= earliest).
  const progressRows = await db
    .select({
      userId: schema.vodProgress.userId,
      updatedAt: schema.vodProgress.updatedAt,
    })
    .from(schema.vodProgress)
    .where(gte(schema.vodProgress.updatedAt, earliest.toISOString()));

  // userId -> Set of week offsets (since their cohort start) where they had activity.
  const userToCohortIdx = new Map<string, number>();
  for (let i = 0; i < safeWeeks; i++) {
    for (const uid of cohortUsers[i]) userToCohortIdx.set(uid, i);
  }

  const userActiveWeeks = new Map<string, Set<number>>();
  for (const p of progressRows) {
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
