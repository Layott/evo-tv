import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Stream } from "@/lib/types";

function toStream(r: typeof schema.streams.$inferSelect): Stream {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    eventId: r.eventId,
    gameId: r.gameId,
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
  const conds = [eq(schema.streams.isLive, true)];
  if (filter?.gameId) conds.push(eq(schema.streams.gameId, filter.gameId));
  if (typeof filter?.isPremium === "boolean")
    conds.push(eq(schema.streams.isPremium, filter.isPremium));
  return (
    await db
      .select()
      .from(schema.streams)
      .where(and(...conds))
      .orderBy(desc(schema.streams.viewerCount))
  ).map(toStream);
}

export async function getStreamById(id: string): Promise<Stream | null> {
  const r = (
    await db
      .select()
      .from(schema.streams)
      .where(eq(schema.streams.id, id))
      .limit(1)
  )[0];
  return r ? toStream(r) : null;
}

export async function listFeaturedStreams(): Promise<Stream[]> {
  return (
    await db
      .select()
      .from(schema.streams)
      .where(eq(schema.streams.isLive, true))
      .orderBy(desc(schema.streams.viewerCount))
      .limit(3)
  ).map(toStream);
}
