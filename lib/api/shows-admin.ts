import "server-only";
import { and, asc, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";

/**
 * Write-side helpers for the Shows CMS.
 *
 * Kept apart from `lib/api/shows.ts`, which is the read path the public site
 * and the native app both go through. Nothing here is reachable without an
 * admin session; the route handlers under `app/api/admin/shows/` are the only
 * callers.
 */

/** http(s) URL or an absolute /path, the same shape the VOD admin route accepts. */
export const urlOrPath = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === "" || /^https?:\/\//i.test(v) || v.startsWith("/"), {
    message: "must be an http(s) URL or an absolute /path",
  });

/**
 * Where a creator can be found.
 *
 * The platform is a free string rather than an enum: a new one appears every
 * year, and a closed list would mean a migration before anybody could link to
 * whatever comes after TikTok.
 */
export const socialLink = z.object({
  platform: z.string().trim().min(1).max(40),
  url: z.string().trim().url().max(500),
});

/**
 * One rung of a paid show's price ladder: from this many days after release,
 * this is the price. Zero means free from then on.
 */
export const priceWindow = z.object({
  fromDay: z.number().int().min(0).max(3650),
  priceNgn: z.number().int().min(0).max(1_000_000),
});

/**
 * Recompute the denormalised counters after any season or episode write.
 *
 * `shows.totalSeasons`, `shows.totalEpisodes` and `seasons.episodeCount` are
 * stored rather than derived because the show grid reads them on every render
 * and a per-row count would be a query per card. Storing them means they can go
 * stale, so every mutation ends here rather than trying to adjust a counter by
 * one: an increment is wrong the moment two writes overlap, and a recount is
 * right whatever happened before it.
 *
 * Soft-deleted episodes do not count. A season with none is still a season, so
 * it keeps its place in `totalSeasons` with a count of zero.
 */
export async function recountShow(showId: string): Promise<void> {
  const seasonRows = await db
    .select({ id: schema.seasons.id })
    .from(schema.seasons)
    .where(eq(schema.seasons.showId, showId));

  const perSeason = await db
    .select({ seasonId: schema.episodes.seasonId, value: count() })
    .from(schema.episodes)
    .where(
      and(
        eq(schema.episodes.showId, showId),
        isNull(schema.episodes.deletedAt),
      ),
    )
    .groupBy(schema.episodes.seasonId);

  const bySeason = new Map(perSeason.map((r) => [r.seasonId, Number(r.value)]));

  await Promise.all(
    seasonRows.map((s) =>
      db
        .update(schema.seasons)
        .set({ episodeCount: bySeason.get(s.id) ?? 0 })
        .where(eq(schema.seasons.id, s.id)),
    ),
  );

  const totalEpisodes = perSeason.reduce((sum, r) => sum + Number(r.value), 0);

  await db
    .update(schema.shows)
    .set({ totalSeasons: seasonRows.length, totalEpisodes })
    .where(eq(schema.shows.id, showId));
}

/**
 * The next free season number on a show.
 *
 * An editor adding "another season" should not have to remember where the last
 * one stopped, and a duplicate number would break the (showId, seasonNumber)
 * lookup the episode pages use.
 */
export async function nextSeasonNumber(showId: string): Promise<number> {
  const rows = await db
    .select({ seasonNumber: schema.seasons.seasonNumber })
    .from(schema.seasons)
    .where(eq(schema.seasons.showId, showId))
    .orderBy(asc(schema.seasons.seasonNumber));
  return rows.reduce((max, r) => Math.max(max, r.seasonNumber), 0) + 1;
}

/**
 * The next free episode number within a season.
 *
 * Counts soft-deleted episodes too. Reusing the number of an episode that was
 * pulled would make two rows collide on the (showId, seasonNumber,
 * episodeNumber) lookup the moment the old one is restored.
 */
export async function nextEpisodeNumber(seasonId: string): Promise<number> {
  const rows = await db
    .select({ episodeNumber: schema.episodes.episodeNumber })
    .from(schema.episodes)
    .where(eq(schema.episodes.seasonId, seasonId));
  return rows.reduce((max, r) => Math.max(max, r.episodeNumber), 0) + 1;
}
