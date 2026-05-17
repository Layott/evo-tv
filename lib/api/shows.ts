import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import type {
  ContentPillar,
  Episode,
  Season,
  Show,
  ShowOriginType,
  ShowStatus,
} from "@/lib/types";

function toShow(r: typeof schema.shows.$inferSelect): Show {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    synopsis: r.synopsis,
    heroUrl: r.heroUrl,
    posterUrl: r.posterUrl,
    pillar: r.pillar as ContentPillar,
    originType: r.originType as ShowOriginType,
    status: r.status as ShowStatus,
    primaryCreatorHandle: r.primaryCreatorHandle,
    totalSeasons: r.totalSeasons,
    totalEpisodes: r.totalEpisodes,
    rating: r.rating,
    releasedAt: r.releasedAt ?? new Date(0).toISOString(),
    tags: r.tags,
  };
}

function toSeason(r: typeof schema.seasons.$inferSelect): Season {
  return {
    id: r.id,
    showId: r.showId,
    seasonNumber: r.seasonNumber,
    title: r.title,
    episodeCount: r.episodeCount,
    releasedAt: r.releasedAt ?? new Date(0).toISOString(),
  };
}

function toEpisode(r: typeof schema.episodes.$inferSelect): Episode {
  return {
    id: r.id,
    showId: r.showId,
    seasonId: r.seasonId,
    seasonNumber: r.seasonNumber,
    episodeNumber: r.episodeNumber,
    title: r.title,
    synopsis: r.synopsis,
    thumbnailUrl: r.thumbnailUrl,
    runtimeSec: r.runtimeSec,
    hlsUrl: r.hlsUrl,
    introStartSec: r.introStartSec ?? undefined,
    introEndSec: r.introEndSec ?? undefined,
    premiereAt: r.premiereAt ?? new Date(0).toISOString(),
    releasedAt: r.releasedAt ?? new Date(0).toISOString(),
  };
}

export async function listShows(filter?: {
  pillar?: ContentPillar;
  originType?: ShowOriginType;
  status?: ShowStatus;
}): Promise<Show[]> {
  const conds = [isNull(schema.shows.deletedAt)];
  if (filter?.pillar) conds.push(eq(schema.shows.pillar, filter.pillar));
  if (filter?.originType)
    conds.push(eq(schema.shows.originType, filter.originType));
  if (filter?.status) conds.push(eq(schema.shows.status, filter.status));
  const rows = await db
    .select()
    .from(schema.shows)
    .where(and(...conds))
    .orderBy(desc(schema.shows.rating));
  return rows.map(toShow);
}

export async function getShowBySlug(slug: string): Promise<Show | null> {
  const row = (
    await db
      .select()
      .from(schema.shows)
      .where(and(eq(schema.shows.slug, slug), isNull(schema.shows.deletedAt)))
      .limit(1)
  )[0];
  return row ? toShow(row) : null;
}

export async function getShowById(id: string): Promise<Show | null> {
  const row = (
    await db
      .select()
      .from(schema.shows)
      .where(and(eq(schema.shows.id, id), isNull(schema.shows.deletedAt)))
      .limit(1)
  )[0];
  return row ? toShow(row) : null;
}

export async function listSeasonsForShow(showId: string): Promise<Season[]> {
  const rows = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.showId, showId))
    .orderBy(asc(schema.seasons.seasonNumber));
  return rows.map(toSeason);
}

export async function listEpisodesForSeason(seasonId: string): Promise<Episode[]> {
  const rows = await db
    .select()
    .from(schema.episodes)
    .where(
      and(
        eq(schema.episodes.seasonId, seasonId),
        isNull(schema.episodes.deletedAt),
      ),
    )
    .orderBy(asc(schema.episodes.episodeNumber));
  return rows.map(toEpisode);
}

export async function getEpisodeById(id: string): Promise<Episode | null> {
  const row = (
    await db
      .select()
      .from(schema.episodes)
      .where(
        and(eq(schema.episodes.id, id), isNull(schema.episodes.deletedAt)),
      )
      .limit(1)
  )[0];
  return row ? toEpisode(row) : null;
}

export async function getEpisodeByLookup(
  showId: string,
  seasonNumber: number,
  episodeNumber: number,
): Promise<Episode | null> {
  const row = (
    await db
      .select()
      .from(schema.episodes)
      .where(
        and(
          eq(schema.episodes.showId, showId),
          eq(schema.episodes.seasonNumber, seasonNumber),
          eq(schema.episodes.episodeNumber, episodeNumber),
          isNull(schema.episodes.deletedAt),
        ),
      )
      .limit(1)
  )[0];
  return row ? toEpisode(row) : null;
}

export async function getEpisodeProgress(
  userId: string,
  episodeId: string,
): Promise<{ positionSec: number; updatedAt: string; completed: boolean } | null> {
  const r = (
    await db
      .select()
      .from(schema.episodeProgress)
      .where(
        and(
          eq(schema.episodeProgress.userId, userId),
          eq(schema.episodeProgress.episodeId, episodeId),
        ),
      )
      .limit(1)
  )[0];
  if (!r) return null;
  return {
    positionSec: r.positionSec ?? 0,
    updatedAt: r.updatedAt,
    completed: !!r.completedAt,
  };
}

export async function upsertEpisodeProgress(
  userId: string,
  episodeId: string,
  positionSec: number,
  completed = false,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insert(schema.episodeProgress)
    .values({
      userId,
      episodeId,
      positionSec,
      completedAt: completed ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.episodeProgress.userId, schema.episodeProgress.episodeId],
      set: {
        positionSec,
        completedAt: completed ? now : null,
        updatedAt: now,
      },
    });
}

export async function listContinueWatching(
  userId: string,
  limit = 6,
): Promise<Array<{ episode: Episode; show: Show; positionSec: number }>> {
  const rows = await db
    .select({
      progress: schema.episodeProgress,
      episode: schema.episodes,
      show: schema.shows,
    })
    .from(schema.episodeProgress)
    .innerJoin(schema.episodes, eq(schema.episodes.id, schema.episodeProgress.episodeId))
    .innerJoin(schema.shows, eq(schema.shows.id, schema.episodes.showId))
    .where(
      and(
        eq(schema.episodeProgress.userId, userId),
        isNull(schema.episodeProgress.completedAt),
      ),
    )
    .orderBy(desc(schema.episodeProgress.updatedAt))
    .limit(limit);
  return rows.map((r) => ({
    episode: toEpisode(r.episode),
    show: toShow(r.show),
    positionSec: r.progress.positionSec,
  }));
}

export type WatchlistEntry = {
  userId: string;
  showId: string;
  status: typeof schema.showWatchlist.$inferSelect.status;
  addedAt: string;
};

export async function getWatchlistEntry(
  userId: string,
  showId: string,
): Promise<WatchlistEntry | null> {
  const row = (
    await db
      .select()
      .from(schema.showWatchlist)
      .where(
        and(
          eq(schema.showWatchlist.userId, userId),
          eq(schema.showWatchlist.showId, showId),
        ),
      )
      .limit(1)
  )[0];
  return row ? { ...row } : null;
}

export async function upsertWatchlistEntry(
  userId: string,
  showId: string,
  status: WatchlistEntry["status"],
): Promise<void> {
  await db
    .insert(schema.showWatchlist)
    .values({ userId, showId, status })
    .onConflictDoUpdate({
      target: [schema.showWatchlist.userId, schema.showWatchlist.showId],
      set: { status },
    });
}

export async function removeWatchlistEntry(
  userId: string,
  showId: string,
): Promise<void> {
  await db
    .delete(schema.showWatchlist)
    .where(
      and(
        eq(schema.showWatchlist.userId, userId),
        eq(schema.showWatchlist.showId, showId),
      ),
    );
}
