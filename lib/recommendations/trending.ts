import "server-only";
import { db, schema } from "@/lib/db";
import type { Vod } from "@/lib/types";

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

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Decay factor: 1.0 for anything published in the last 24h, then linearly decays
 * to 0 over a 30-day window. Applied on top of raw viewCount to produce a
 * "trending" signal.
 */
function decayFactor(publishedAt: string): number {
  const age = Date.now() - new Date(publishedAt).getTime();
  if (age <= ONE_DAY_MS) return 1;
  const days = age / ONE_DAY_MS;
  return Math.max(0, 1 - (days - 1) / 29);
}

export async function trendingVods(limit = 20): Promise<Vod[]> {
  const rows = (await db.select().from(schema.vods)).map(toVod);
  const scored = rows.map((v) => ({
    vod: v,
    score: v.viewCount * (0.5 + 0.5 * decayFactor(v.publishedAt)),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.vod);
}
