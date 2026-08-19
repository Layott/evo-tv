import "server-only";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { releasedCondition } from "@/lib/api/release";
import type { Vod, Clip } from "@/lib/types";
import { looksLikeId } from "@/lib/slug";

function toVod(r: typeof schema.vods.$inferSelect): Vod {
  return {
    id: r.id,
    streamId: r.streamId,
    slug: r.slug,
    title: r.title,
    description: r.description,
    gameId: r.gameId,
    durationSec: r.durationSec,
    hlsUrl: r.hlsPath,
    mp4Url: r.mp4Path,
    thumbnailUrl: r.thumbnailUrl,
    publishedAt: r.publishedAt,
    publishAt: r.publishAt ?? null,
    chapters: r.chapters,
    viewCount: r.viewCount,
    likeCount: r.likeCount,
    isPremium: r.isPremium,
    pillar: r.pillar as Vod["pillar"],
    maturityRating: (r.maturityRating ?? "teen") as Vod["maturityRating"],
    contentTags: r.contentTags ?? [],
  };
}

function toClip(r: typeof schema.clips.$inferSelect): Clip {
  return {
    id: r.id,
    vodId: r.vodId,
    streamId: r.streamId,
    title: r.title,
    creatorHandle: r.creatorHandle,
    creatorAvatarUrl: r.creatorAvatarUrl,
    durationSec: r.durationSec,
    mp4Url: r.mp4Path,
    thumbnailUrl: r.thumbnailUrl,
    viewCount: r.viewCount,
    likeCount: r.likeCount,
    createdAt: r.createdAt,
    gameId: r.gameId,
    pillar: r.pillar as Clip["pillar"],
    maturityRating: (r.maturityRating ?? "teen") as Clip["maturityRating"],
    contentTags: r.contentTags ?? [],
  };
}

export async function listVods(filter?: {
  gameId?: string;
  isPremium?: boolean;
  limit?: number;
}): Promise<Vod[]> {
  const conds = [
    isNull(schema.vods.deletedAt),
    // Scheduled rows are not in the library until their date arrives. A rail
    // that shows next week's release is a leak whichever way the click goes:
    // either it plays early or it errors.
    releasedCondition(schema.vods.publishAt),
  ];
  if (filter?.gameId) conds.push(eq(schema.vods.gameId, filter.gameId));
  if (typeof filter?.isPremium === "boolean")
    conds.push(eq(schema.vods.isPremium, filter.isPremium));
  let q = db
    .select()
    .from(schema.vods)
    .where(and(...conds))
    .orderBy(desc(schema.vods.publishedAt))
    .$dynamic();
  if (filter?.limit) q = q.limit(filter.limit);
  return (await q).map(toVod);
}

export async function getVodById(id: string): Promise<Vod | null> {
  const r = (
    await db
      .select()
      .from(schema.vods)
      .where(and(eq(schema.vods.id, id), isNull(schema.vods.deletedAt)))
      .limit(1)
  )[0];
  return r ? toVod(r) : null;
}

/**
 * A VOD by whichever form the URL used.
 *
 * Slugs never contain an underscore and every id does, so the two cannot be
 * confused. Both resolve so that links published before slugs existed keep
 * working; `/vod/[slug]/page.tsx` is what redirects the id form to the slug.
 */
export async function getVodBySlugOrId(param: string): Promise<Vod | null> {
  if (looksLikeId(param)) return getVodById(param);
  const r = (
    await db
      .select()
      .from(schema.vods)
      .where(and(eq(schema.vods.slug, param), isNull(schema.vods.deletedAt)))
      .limit(1)
  )[0];
  return r ? toVod(r) : getVodById(param);
}

export async function listRelatedVods(vodId: string, limit = 6): Promise<Vod[]> {
  const base = (
    await db
      .select()
      .from(schema.vods)
      .where(and(eq(schema.vods.id, vodId), isNull(schema.vods.deletedAt)))
      .limit(1)
  )[0];
  if (!base)
    return (
      await db
        .select()
        .from(schema.vods)
        .where(isNull(schema.vods.deletedAt))
        .limit(limit)
    ).map(toVod);
  return (
    await db
      .select()
      .from(schema.vods)
      .where(
        and(
          // Same game when there is one. An anime or lifestyle recording has
          // no game, so the pillar is what makes another VOD related; without
          // this fallback "related" would mean the entire library.
          // An unfiled recording has neither a game nor a pillar to match on,
          // so it gets the rest of the library rather than nothing: a related
          // rail with one row in it looks broken, and "no pillar" is not a
          // statement that these two are unrelated.
          base.gameId
            ? eq(schema.vods.gameId, base.gameId)
            : base.pillar
              ? eq(schema.vods.pillar, base.pillar)
              : undefined,
          ne(schema.vods.id, vodId),
          isNull(schema.vods.deletedAt),
        ),
      )
      .orderBy(desc(schema.vods.publishedAt))
      .limit(limit)
  ).map(toVod);
}

export async function listTrendingClips(limit = 10): Promise<Clip[]> {
  return (
    await db
      .select()
      .from(schema.clips)
      .where(isNull(schema.clips.deletedAt))
      .orderBy(desc(schema.clips.viewCount))
      .limit(limit)
  ).map(toClip);
}

export async function getClipById(id: string): Promise<Clip | null> {
  const r = (
    await db
      .select()
      .from(schema.clips)
      .where(and(eq(schema.clips.id, id), isNull(schema.clips.deletedAt)))
      .limit(1)
  )[0];
  return r ? toClip(r) : null;
}
