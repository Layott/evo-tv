import "server-only";
import { and, eq, gte, inArray } from "drizzle-orm";
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

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const COMPLETION_THRESHOLD = 0.8;

type ProgressRow = typeof schema.vodProgress.$inferSelect;

function watchedGameIds(progress: ProgressRow[], vodMap: Map<string, Vod>): Set<string> {
  const gameIds = new Set<string>();
  for (const p of progress) {
    const vod = vodMap.get(p.vodId);
    if (vod) gameIds.add(vod.gameId);
  }
  return gameIds;
}

async function gameIdsFromFollows(userId: string): Promise<Set<string>> {
  const gameIds = new Set<string>();
  const follows = await db
    .select()
    .from(schema.follows)
    .where(eq(schema.follows.userId, userId));

  const teamIds: string[] = [];
  const playerIds: string[] = [];
  for (const f of follows) {
    if (f.targetType === "team") teamIds.push(f.targetId);
    else if (f.targetType === "player") playerIds.push(f.targetId);
  }

  if (teamIds.length > 0) {
    const teams = await db
      .select({ gameId: schema.teams.gameId })
      .from(schema.teams)
      .where(inArray(schema.teams.id, teamIds));
    for (const t of teams) gameIds.add(t.gameId);
  }

  if (playerIds.length > 0) {
    const players = await db
      .select({ gameId: schema.players.gameId })
      .from(schema.players)
      .where(inArray(schema.players.id, playerIds));
    for (const p of players) gameIds.add(p.gameId);
  }

  return gameIds;
}

function recencyScore(publishedAt: string): number {
  const age = Date.now() - new Date(publishedAt).getTime();
  if (age <= 0) return 1;
  // Normalize: fresh (<1 day)=1, 30d=0
  const days = age / (24 * 60 * 60 * 1000);
  return Math.max(0, 1 - days / 30);
}

export async function recommendForUser(userId: string, limit = 20): Promise<Vod[]> {
  const cutoffIso = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  const recentProgress = await db
    .select()
    .from(schema.vodProgress)
    .where(
      and(
        eq(schema.vodProgress.userId, userId),
        gte(schema.vodProgress.updatedAt, cutoffIso)
      )
    );

  // Fetch VODs user already interacted with (for exclusions + signal).
  const interactedVodIds = recentProgress.map((p) => p.vodId);
  const interactedVods =
    interactedVodIds.length > 0
      ? (
          await db
            .select()
            .from(schema.vods)
            .where(inArray(schema.vods.id, interactedVodIds))
        ).map(toVod)
      : [];
  const interactedVodMap = new Map<string, Vod>(interactedVods.map((v) => [v.id, v]));

  // Which vods are fully watched (>80%) — exclude these.
  const fullyWatched = new Set<string>();
  for (const p of recentProgress) {
    const vod = interactedVodMap.get(p.vodId);
    if (!vod || vod.durationSec <= 0) continue;
    if (p.positionSec / vod.durationSec > COMPLETION_THRESHOLD) {
      fullyWatched.add(vod.id);
    }
  }

  // Collect signal game ids (from watched vods + follows).
  const likedGameIds = watchedGameIds(recentProgress, interactedVodMap);
  const followedGameIds = await gameIdsFromFollows(userId);

  // Candidate pool: all non-fully-watched vods; prioritize signal games but include fallback.
  const allVods = (await db.select().from(schema.vods)).map(toVod);
  const eligible = allVods.filter((v) => !fullyWatched.has(v.id));

  const maxViews =
    eligible.reduce((m, v) => (v.viewCount > m ? v.viewCount : m), 0) || 1;

  const scored = eligible.map((v) => {
    const sameGameBoost = likedGameIds.has(v.gameId) ? 1 : 0;
    const followSignalBoost = followedGameIds.has(v.gameId) ? 1 : 0;
    const recency = recencyScore(v.publishedAt);
    const globalViewCountNorm = v.viewCount / maxViews;
    const score =
      0.4 * sameGameBoost +
      0.3 * followSignalBoost +
      0.2 * recency +
      0.1 * globalViewCountNorm;
    return { vod: v, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.vod);
}
