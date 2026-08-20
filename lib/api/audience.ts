import "server-only";
import { and, gte, lt, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { resolveRange, daysInRange, type RangeInput } from "@/lib/analytics/range";

/**
 * Who watched the channel, from the beats the players already send.
 *
 * The Analytics page could answer everything about recordings and nothing at
 * all about the thing this platform actually does, which is broadcast. The
 * owner opened it during a live show and read "0 titles in the catalogue".
 *
 * `watch_events` has carried the answer since August: one row per viewer per
 * minute, with the country, the device and the ladder rung on it. Nothing was
 * reading any of that.
 *
 * Every number here is counted, not modelled. A viewer is a signed-in account
 * where there is one and a hashed IP where there is not, which is the same
 * identity the live viewer count on the Overview page uses.
 */

export interface AudienceDay {
  date: string;
  /** People, counted once per stream per day. */
  views: number;
  /** Minutes with a live player open, summed across viewers. */
  minutes: number;
}

export interface AudienceSlice {
  label: string;
  minutes: number;
}

export interface AudienceReport {
  byDay: AudienceDay[];
  /** The most people watching at the same minute, and when that was. */
  peakConcurrent: number;
  peakAt: string | null;
  totalViews: number;
  totalMinutes: number;
  byCountry: AudienceSlice[];
  byDevice: AudienceSlice[];
  /** Which rung viewers actually pulled. Website players report it; the app does not. */
  byRung: AudienceSlice[];
}

/** The viewer identity: the account if signed in, the hashed IP otherwise. */
const VIEWER = sql`coalesce(${schema.watchEvents.userId}, ${schema.watchEvents.ipHash})`;
const DAY = sql`to_char(${schema.watchEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;

function labelRung(rung: string | null): string {
  switch (rung) {
    case "_low":
      return "360p";
    case "_mid":
      return "480p";
    case "_hi":
      return "720p";
    case "_fhd":
      return "1080p";
    default:
      // The app plays without reporting a rung, so this is honest rather than
      // a gap: it is a real share of the audience whose quality we do not know.
      return "Not reported";
  }
}

export async function audienceReport(
  range: RangeInput | number = 30,
): Promise<AudienceReport> {
  const window = resolveRange(typeof range === "number" ? { days: range } : range);
  const within = and(
    gte(schema.watchEvents.createdAt, window.since),
    lt(schema.watchEvents.createdAt, window.until),
  );

  const [dayRows, minuteRows, peakRows, countryRows, deviceRows, rungRows] =
    await Promise.all([
      // People per day: distinct viewer per stream, so one person watching two
      // broadcasts is two views and watching one all day is one.
      db
        .select({
          date: sql<string>`${DAY}`,
          views: sql<number>`count(distinct (${VIEWER} || ':' || coalesce(${schema.watchEvents.streamId}, '')))`,
        })
        .from(schema.watchEvents)
        .where(within)
        .groupBy(DAY),

      // Minutes per day: one beat is one minute claimed.
      db
        .select({
          date: sql<string>`${DAY}`,
          minutes: sql<number>`count(distinct (${VIEWER} || ':' || ${schema.watchEvents.minuteBucket}))`,
        })
        .from(schema.watchEvents)
        .where(within)
        .groupBy(DAY),

      // The busiest single minute in the window. Concurrency, not a total.
      db
        .select({
          bucket: schema.watchEvents.minuteBucket,
          viewers: sql<number>`count(distinct ${VIEWER})`,
        })
        .from(schema.watchEvents)
        .where(within)
        .groupBy(schema.watchEvents.minuteBucket)
        .orderBy(sql`count(distinct ${VIEWER}) desc`)
        .limit(1),

      db
        .select({
          label: schema.watchEvents.country,
          minutes: sql<number>`count(distinct (${VIEWER} || ':' || ${schema.watchEvents.minuteBucket}))`,
        })
        .from(schema.watchEvents)
        .where(within)
        .groupBy(schema.watchEvents.country),

      db
        .select({
          label: schema.watchEvents.device,
          minutes: sql<number>`count(distinct (${VIEWER} || ':' || ${schema.watchEvents.minuteBucket}))`,
        })
        .from(schema.watchEvents)
        .where(within)
        .groupBy(schema.watchEvents.device),

      db
        .select({
          label: schema.watchEvents.rung,
          minutes: sql<number>`count(distinct (${VIEWER} || ':' || ${schema.watchEvents.minuteBucket}))`,
        })
        .from(schema.watchEvents)
        .where(within)
        .groupBy(schema.watchEvents.rung),
    ]);

  const views = new Map(dayRows.map((r) => [r.date, Number(r.views ?? 0)]));
  const minutes = new Map(minuteRows.map((r) => [r.date, Number(r.minutes ?? 0)]));

  // Zero-filled, so a quiet day is a zero rather than a gap the chart bridges.
  const byDay = daysInRange(window).map((date) => ({
    date,
    views: views.get(date) ?? 0,
    minutes: minutes.get(date) ?? 0,
  }));

  const slice = (
    rows: { label: string | null; minutes: number }[],
    fallback: string,
    label: (value: string | null) => string = (v) => v ?? fallback,
  ): AudienceSlice[] =>
    rows
      .map((r) => ({ label: label(r.label), minutes: Number(r.minutes ?? 0) }))
      .filter((r) => r.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);

  return {
    byDay,
    peakConcurrent: Number(peakRows[0]?.viewers ?? 0),
    peakAt: peakRows[0]?.bucket ?? null,
    totalViews: byDay.reduce((sum, d) => sum + d.views, 0),
    totalMinutes: byDay.reduce((sum, d) => sum + d.minutes, 0),
    byCountry: slice(countryRows, "Unknown"),
    byDevice: slice(deviceRows, "Unknown"),
    byRung: slice(rungRows, "Not reported", labelRung),
  };
}
