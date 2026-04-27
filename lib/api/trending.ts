import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Clip, Vod } from "@/lib/types";

function toVod(r: typeof schema.vods.$inferSelect): Vod {
  return {
    id: r.id,
    streamId: r.streamId,
    title: r.title,
    description: r.description,
    gameId: r.gameId,
    durationSec: r.durationSec,
    hlsUrl: r.hlsPath,
    mp4Url: r.mp4Path,
    thumbnailUrl: r.thumbnailUrl,
    publishedAt: r.publishedAt,
    chapters: r.chapters,
    viewCount: r.viewCount,
    likeCount: r.likeCount,
    isPremium: r.isPremium,
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
  };
}

function last24hIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Trending clips ranked by a simple hotness score:
 *   score = (likes in last 24h) * 2 + viewCount
 * This re-implements `@/lib/api/vods.ts#listTrendingClips` to weight recent
 * engagement more heavily than raw views.
 */
export async function listTrendingClips(limit = 10): Promise<Clip[]> {
  const since = last24hIso();
  const likeAgg = db
    .select({
      targetId: schema.likes.targetId,
      n: sql<number>`count(*)`.as("n"),
    })
    .from(schema.likes)
    .where(
      and(
        eq(schema.likes.targetType, "clip"),
        gte(schema.likes.createdAt, since)
      )
    )
    .groupBy(schema.likes.targetId)
    .as("like_agg");

  const rows = db
    .select({
      clip: schema.clips,
      recentLikes: sql<number>`COALESCE(${likeAgg.n}, 0)`.as("recent_likes"),
    })
    .from(schema.clips)
    .leftJoin(likeAgg, eq(likeAgg.targetId, schema.clips.id))
    .orderBy(
      desc(sql`COALESCE(${likeAgg.n}, 0) * 2 + ${schema.clips.viewCount}`)
    )
    .limit(limit)
    .all();

  return rows.map((r) => toClip(r.clip));
}

/**
 * VODs ranked by recent like velocity (likes in the last 24h), with view count
 * as a tiebreaker so cold VODs still sort deterministically.
 */
export async function listTrendingVodsNow(limit = 10): Promise<Vod[]> {
  const since = last24hIso();
  const likeAgg = db
    .select({
      targetId: schema.likes.targetId,
      n: sql<number>`count(*)`.as("n"),
    })
    .from(schema.likes)
    .where(
      and(
        eq(schema.likes.targetType, "vod"),
        gte(schema.likes.createdAt, since)
      )
    )
    .groupBy(schema.likes.targetId)
    .as("like_agg");

  const rows = db
    .select({
      vod: schema.vods,
      recentLikes: sql<number>`COALESCE(${likeAgg.n}, 0)`.as("recent_likes"),
    })
    .from(schema.vods)
    .leftJoin(likeAgg, eq(likeAgg.targetId, schema.vods.id))
    .orderBy(
      desc(sql`COALESCE(${likeAgg.n}, 0)`),
      desc(schema.vods.viewCount)
    )
    .limit(limit)
    .all();

  return rows.map((r) => toVod(r.vod));
}
