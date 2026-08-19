import "server-only";
import { and, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  daysInRange,
  resolveRange,
  type RangeInput,
  type ResolvedRange,
} from "@/lib/analytics/range";

/**
 * Per-video analytics, in the shape a creator expects from YouTube Studio.
 *
 * Everything here reads `video_view_buckets`, where the player writes one row
 * per percent of a video a session reached. That single shape is what makes the
 * whole page possible:
 *
 *   views              count(distinct session_id)
 *   watch time         count(*) * duration / 100   (each row IS 1% of the video)
 *   avg view duration  watch time / views
 *   avg % viewed       avg over sessions of (max bucket + 1)
 *   retention curve    per bucket, sessions reaching it / total sessions
 *
 * Nothing is modelled, extrapolated or smoothed. A video nobody has watched
 * returns zeroes and a flat curve, and the page says so rather than drawing a
 * plausible shape.
 */

export type VideoType = "vod" | "episode";

export interface VideoSummary {
  type: VideoType;
  id: string;
  title: string;
  thumbnailUrl: string;
  durationSec: number;
  publishedAt: string | null;
  views: number;
  watchTimeSec: number;
  avgPercentViewed: number;
}

export interface VideoAnalytics {
  video: {
    type: VideoType;
    id: string;
    title: string;
    thumbnailUrl: string;
    durationSec: number;
    publishedAt: string | null;
  };
  views: number;
  uniqueViewers: number;
  signedOutViews: number;
  watchTimeSec: number;
  avgViewDurationSec: number;
  avgPercentViewed: number;
  /** Sessions that reached 95% or more. */
  completionRate: number;
  likes: number;
  /** 100 points, index = percent of the video, value = percent of sessions. */
  retention: number[];
  viewsByDay: { date: string; views: number }[];
  topCountries: { country: string; views: number }[];
  devices: { device: string; views: number }[];
}

/**
 * The window, resolved.
 *
 * `lib/analytics/range.ts` owns the arithmetic so the route, the screen and
 * these queries cannot disagree about which days are being counted. It is UTC
 * throughout, matching the day keys the chart buckets into: snapping to local
 * midnight shifted the whole series by the server's offset, and in Lagos every
 * key landed a day early, today never appeared, and the chart totalled zero
 * next to a headline reading 24.
 */
function windowFor(input: RangeInput | number | undefined): ResolvedRange {
  if (typeof input === "number") return resolveRange({ days: input });
  return resolveRange(input ?? {});
}

/* ------------------------------------------------------------------ */
/* The catalogue, ranked                                              */
/* ------------------------------------------------------------------ */

/**
 * Every VOD and episode with its numbers for the range, best first.
 *
 * Two catalogues are unioned rather than kept apart because an operator asking
 * "what is working" does not care which table a title lives in.
 */
export async function listVideoSummaries(
  range: RangeInput | number = 28,
): Promise<VideoSummary[]> {
  const window = windowFor(range);

  /**
   * Grouped per session, not per video, so this list can use the same two
   * definitions the detail page uses.
   *
   * Averaging `count(*) / sessions` instead is a different measurement - the
   * share of the video sampled rather than the furthest point reached - and the
   * two disagreed on screen: the same title read "27% viewed" in the list and
   * "53%" on its own page.
   */
  const perSession = await db
    .select({
      videoType: schema.videoViewBuckets.videoType,
      videoId: schema.videoViewBuckets.videoId,
      sessionId: schema.videoViewBuckets.sessionId,
      buckets: sql<number>`count(*)`,
      maxBucket: sql<number>`max(${schema.videoViewBuckets.bucket})`,
    })
    .from(schema.videoViewBuckets)
    .where(
      and(
        gte(schema.videoViewBuckets.createdAt, window.since),
        lt(schema.videoViewBuckets.createdAt, window.until),
      ),
    )
    .groupBy(
      schema.videoViewBuckets.videoType,
      schema.videoViewBuckets.videoId,
      schema.videoViewBuckets.sessionId,
    );

  const byKey = new Map<
    string,
    { sessions: number; buckets: number; depthTotal: number }
  >();
  for (const r of perSession) {
    const key = `${r.videoType}:${r.videoId}`;
    const acc = byKey.get(key) ?? { sessions: 0, buckets: 0, depthTotal: 0 };
    acc.sessions += 1;
    acc.buckets += Number(r.buckets);
    acc.depthTotal += Number(r.maxBucket) + 1;
    byKey.set(key, acc);
  }

  const [vods, episodes] = await Promise.all([
    db
      .select({
        id: schema.vods.id,
        title: schema.vods.title,
        thumbnailUrl: schema.vods.thumbnailUrl,
        durationSec: schema.vods.durationSec,
        publishedAt: schema.vods.publishedAt,
      })
      .from(schema.vods),
    db
      .select({
        id: schema.episodes.id,
        title: schema.episodes.title,
        thumbnailUrl: schema.episodes.thumbnailUrl,
        durationSec: schema.episodes.runtimeSec,
        publishedAt: schema.episodes.releasedAt,
        showTitle: schema.shows.title,
        seasonNumber: schema.episodes.seasonNumber,
        episodeNumber: schema.episodes.episodeNumber,
      })
      .from(schema.episodes)
      .leftJoin(schema.shows, eq(schema.episodes.showId, schema.shows.id))
      .where(isNull(schema.episodes.deletedAt)),
  ]);

  const out: VideoSummary[] = [];

  const push = (
    type: VideoType,
    id: string,
    title: string,
    thumbnailUrl: string | null,
    durationSec: number | null,
    publishedAt: string | Date | null,
  ) => {
    const s = byKey.get(`${type}:${id}`);
    const views = s?.sessions ?? 0;
    const buckets = s?.buckets ?? 0;
    const duration = Number(durationSec ?? 0);
    // Each bucket row is one percent of the runtime.
    const watchTimeSec = duration > 0 ? Math.round((buckets * duration) / 100) : 0;
    out.push({
      type,
      id,
      title,
      thumbnailUrl: thumbnailUrl ?? "",
      durationSec: duration,
      publishedAt:
        publishedAt instanceof Date ? publishedAt.toISOString() : publishedAt ?? null,
      views,
      watchTimeSec,
      // Furthest point reached, averaged. Same definition as the detail page.
      avgPercentViewed:
        views > 0 ? Math.round((s?.depthTotal ?? 0) / views) : 0,
    });
  };

  for (const v of vods) {
    push("vod", v.id, v.title, v.thumbnailUrl, v.durationSec, v.publishedAt);
  }
  for (const e of episodes) {
    // "Show S1E4 - Title" reads better in a flat list than a bare episode name,
    // which is often just "Episode 4" and identical across shows.
    const prefix = e.showTitle
      ? `${e.showTitle} S${e.seasonNumber}E${e.episodeNumber} · `
      : "";
    push(
      "episode",
      e.id,
      `${prefix}${e.title}`,
      e.thumbnailUrl,
      e.durationSec,
      e.publishedAt,
    );
  }

  return out.sort(
    (a, b) => b.views - a.views || b.watchTimeSec - a.watchTimeSec,
  );
}

/* ------------------------------------------------------------------ */
/* One video, in depth                                                */
/* ------------------------------------------------------------------ */

async function loadVideo(type: VideoType, id: string) {
  if (type === "vod") {
    const row = (
      await db
        .select({
          id: schema.vods.id,
          title: schema.vods.title,
          thumbnailUrl: schema.vods.thumbnailUrl,
          durationSec: schema.vods.durationSec,
          publishedAt: schema.vods.publishedAt,
        })
        .from(schema.vods)
        .where(eq(schema.vods.id, id))
        .limit(1)
    )[0];
    if (!row) return null;
    return {
      type,
      id: row.id,
      title: row.title,
      thumbnailUrl: row.thumbnailUrl ?? "",
      durationSec: Number(row.durationSec ?? 0),
      publishedAt: row.publishedAt ?? null,
    };
  }

  const row = (
    await db
      .select({
        id: schema.episodes.id,
        title: schema.episodes.title,
        thumbnailUrl: schema.episodes.thumbnailUrl,
        durationSec: schema.episodes.runtimeSec,
        publishedAt: schema.episodes.releasedAt,
        showTitle: schema.shows.title,
        seasonNumber: schema.episodes.seasonNumber,
        episodeNumber: schema.episodes.episodeNumber,
      })
      .from(schema.episodes)
      .leftJoin(schema.shows, eq(schema.episodes.showId, schema.shows.id))
      .where(eq(schema.episodes.id, id))
      .limit(1)
  )[0];
  if (!row) return null;
  const prefix = row.showTitle
    ? `${row.showTitle} S${row.seasonNumber}E${row.episodeNumber} · `
    : "";
  return {
    type,
    id: row.id,
    title: `${prefix}${row.title}`,
    thumbnailUrl: row.thumbnailUrl ?? "",
    durationSec: Number(row.durationSec ?? 0),
    publishedAt: row.publishedAt ?? null,
  };
}

export async function videoAnalytics(
  type: VideoType,
  id: string,
  range: RangeInput | number = 28,
): Promise<VideoAnalytics | null> {
  const video = await loadVideo(type, id);
  if (!video) return null;

  const window = windowFor(range);
  const scope = and(
    eq(schema.videoViewBuckets.videoType, type),
    eq(schema.videoViewBuckets.videoId, id),
    gte(schema.videoViewBuckets.createdAt, window.since),
    lt(schema.videoViewBuckets.createdAt, window.until),
  );

  const [totals, perDay, perCountry, perDevice, sessionDepth, likeRow] =
    await Promise.all([
      db
        .select({
          sessions: sql<number>`count(distinct ${schema.videoViewBuckets.sessionId})`,
          buckets: sql<number>`count(*)`,
          viewers: sql<number>`count(distinct ${schema.videoViewBuckets.userId})`,
          signedOut: sql<number>`count(distinct ${schema.videoViewBuckets.sessionId}) filter (where ${schema.videoViewBuckets.userId} is null)`,
        })
        .from(schema.videoViewBuckets)
        .where(scope),

      // A view is dated by when the session first appeared, not by every beat,
      // or a single long watch would look like hundreds of views.
      //
      // Forced to UTC because the day keys this is compared against are built
      // with `toISOString()`. Left to the database session's timezone the two
      // disagree by a day and every view falls outside the range, which is
      // exactly what happened: the chart totalled zero while the headline count
      // read 24.
      db
        .select({
          date: sql<string>`to_char(min(${schema.videoViewBuckets.createdAt}) at time zone 'UTC', 'YYYY-MM-DD')`,
          sessionId: schema.videoViewBuckets.sessionId,
        })
        .from(schema.videoViewBuckets)
        .where(scope)
        .groupBy(schema.videoViewBuckets.sessionId),

      db
        .select({
          country: schema.videoViewBuckets.country,
          sessions: sql<number>`count(distinct ${schema.videoViewBuckets.sessionId})`,
        })
        .from(schema.videoViewBuckets)
        .where(scope)
        .groupBy(schema.videoViewBuckets.country),

      db
        .select({
          device: schema.videoViewBuckets.device,
          sessions: sql<number>`count(distinct ${schema.videoViewBuckets.sessionId})`,
        })
        .from(schema.videoViewBuckets)
        .where(scope)
        .groupBy(schema.videoViewBuckets.device),

      // Furthest point each session reached, for average percent viewed and
      // the completion rate.
      db
        .select({
          sessionId: schema.videoViewBuckets.sessionId,
          maxBucket: sql<number>`max(${schema.videoViewBuckets.bucket})`,
        })
        .from(schema.videoViewBuckets)
        .where(scope)
        .groupBy(schema.videoViewBuckets.sessionId),

      // `likes.target_type` is ("vod" | "clip"); episodes are not likeable, so
      // asking would be a query guaranteed to return zero and a column the
      // enum does not accept.
      type === "vod"
        ? db
            .select({ c: sql<number>`count(*)` })
            .from(schema.likes)
            .where(
              and(
                eq(schema.likes.targetType, "vod"),
                eq(schema.likes.targetId, id),
              ),
            )
        : Promise.resolve([{ c: 0 }]),
    ]);

  const views = Number(totals[0]?.sessions ?? 0);
  const buckets = Number(totals[0]?.buckets ?? 0);
  const duration = video.durationSec;
  const watchTimeSec = duration > 0 ? Math.round((buckets * duration) / 100) : 0;

  const depths = sessionDepth.map((s) => Number(s.maxBucket) + 1);

  /**
   * Retention is cumulative: at each percent, how many sessions got *at least*
   * this far.
   *
   * The obvious version counts sessions with a beat landing exactly in each
   * bucket, and it is wrong, because the player beats on a timer rather than
   * once per percent. On a two minute video a ten second beat lands roughly
   * every eighth percent, so seven of every eight buckets are empty and the
   * curve reads 100, 0, 100, 0 - a video that looks like it loses and regains
   * its entire audience several times a second.
   *
   * Counting from each session's furthest point fixes that and also makes the
   * curve monotonically non-increasing, which is what a retention curve is:
   * nobody who reached 50% failed to reach 20%.
   */
  const retention = new Array<number>(100).fill(0);
  if (views > 0) {
    const reachedAtLeast = new Array<number>(101).fill(0);
    for (const s of sessionDepth) {
      const furthest = Math.min(99, Math.max(0, Number(s.maxBucket)));
      reachedAtLeast[furthest] += 1;
    }
    // Walk backwards so each bucket accumulates everyone past it.
    let running = 0;
    for (let i = 99; i >= 0; i--) {
      running += reachedAtLeast[i];
      retention[i] = Math.round((running / views) * 1000) / 10;
    }
  }
  const avgPercentViewed =
    depths.length > 0
      ? Math.round(depths.reduce((a, b) => a + b, 0) / depths.length)
      : 0;
  const completed = depths.filter((d) => d >= 95).length;

  // Zero-fill the range so a quiet week is a flat line rather than a gap the
  // chart interpolates across.
  const counts = new Map<string, number>();
  for (const r of perDay) {
    if (r.date) counts.set(r.date, (counts.get(r.date) ?? 0) + 1);
  }
  const viewsByDay = daysInRange(window).map((date) => ({
    date,
    views: counts.get(date) ?? 0,
  }));

  return {
    video,
    views,
    uniqueViewers: Number(totals[0]?.viewers ?? 0),
    signedOutViews: Number(totals[0]?.signedOut ?? 0),
    watchTimeSec,
    avgViewDurationSec: views > 0 ? Math.round(watchTimeSec / views) : 0,
    avgPercentViewed,
    completionRate: views > 0 ? Math.round((completed / views) * 1000) / 10 : 0,
    likes: Number(likeRow[0]?.c ?? 0),
    retention,
    viewsByDay,
    topCountries: perCountry
      .filter((c) => c.country)
      .map((c) => ({ country: c.country, views: Number(c.sessions) }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8),
    devices: perDevice
      .filter((d) => d.device)
      .map((d) => ({ device: d.device, views: Number(d.sessions) }))
      .sort((a, b) => b.views - a.views),
  };
}
