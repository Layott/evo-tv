import "server-only";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Stream } from "@/lib/types";

/**
 * Read-time viewer-count refresh.
 *
 * We dropped the per-minute viewer-count cron (Vercel Hobby plan blocks
 * `* * * * *` schedules). Instead, derive counts on demand from the
 * watch_events table (Phase 3.7 heartbeats). For each stream, count the
 * distinct viewer-keys whose latest heartbeat is in the last 90s.
 *
 * 90s gives a 1.5x buffer over the 60s heartbeat cadence — if a viewer
 * misses one heartbeat but sends the next, they stay "live."
 */
async function liveViewerCounts(
  streamIds: string[],
): Promise<Map<string, number>> {
  if (streamIds.length === 0) return new Map();
  const cutoff = new Date(Date.now() - 90_000).toISOString();
  const rows = await db
    .select({
      streamId: schema.watchEvents.streamId,
      n: sql<number>`count(distinct coalesce(${schema.watchEvents.userId}, ${schema.watchEvents.ipHash}))::int`,
    })
    .from(schema.watchEvents)
    .where(
      and(
        inArray(schema.watchEvents.streamId, streamIds),
        gte(schema.watchEvents.createdAt, cutoff),
      ),
    )
    .groupBy(schema.watchEvents.streamId);
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.streamId) map.set(r.streamId, Number(r.n));
  }
  return map;
}

function toStream(r: typeof schema.streams.$inferSelect): Stream {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    eventId: r.eventId,
    gameId: r.gameId,
    channelId: r.channelId,
    streamerType: r.streamerType as Stream["streamerType"],
    streamerName: r.streamerName,
    streamerAvatarUrl: r.streamerAvatarUrl,
    isLive: r.isLive,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    hlsUrl: r.hlsPath,
    thumbnailUrl: r.thumbnailUrl,
    viewerCount: r.viewerCount,
    peakViewerCount: r.peakViewerCount,
    language: r.language,
    tags: r.tags,
    isPremium: r.isPremium,
  };
}

export async function listLiveStreams(filter?: {
  gameId?: string;
  isPremium?: boolean;
}): Promise<Stream[]> {
  const conds = [
    eq(schema.streams.isLive, true),
    isNull(schema.streams.deletedAt),
  ];
  if (filter?.gameId) conds.push(eq(schema.streams.gameId, filter.gameId));
  if (typeof filter?.isPremium === "boolean")
    conds.push(eq(schema.streams.isPremium, filter.isPremium));
  const rows = await db
    .select()
    .from(schema.streams)
    .where(and(...conds))
    .orderBy(desc(schema.streams.viewerCount));
  const counts = await liveViewerCounts(rows.map((r) => r.id));
  return rows.map((r) => ({ ...toStream(r), viewerCount: counts.get(r.id) ?? 0 }));
}

export async function getStreamById(id: string): Promise<Stream | null> {
  const r = (
    await db
      .select()
      .from(schema.streams)
      .where(and(eq(schema.streams.id, id), isNull(schema.streams.deletedAt)))
      .limit(1)
  )[0];
  if (!r) return null;
  const counts = r.isLive ? await liveViewerCounts([r.id]) : new Map();
  return {
    ...toStream(r),
    viewerCount: r.isLive ? counts.get(r.id) ?? 0 : r.viewerCount,
  };
}

export async function listFeaturedStreams(): Promise<Stream[]> {
  const rows = await db
    .select()
    .from(schema.streams)
    .where(
      and(eq(schema.streams.isLive, true), isNull(schema.streams.deletedAt)),
    )
    .orderBy(desc(schema.streams.viewerCount))
    .limit(3);
  const counts = await liveViewerCounts(rows.map((r) => r.id));
  return rows.map((r) => ({ ...toStream(r), viewerCount: counts.get(r.id) ?? 0 }));
}
