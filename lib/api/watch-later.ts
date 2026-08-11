import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export interface WatchLaterEntry {
  vodId: string;
  createdAt: string;
  title: string;
  thumbnailUrl: string;
  durationSec: number;
  /** Null for anime, lifestyle and podcast recordings. */
  gameId: string | null;
  isPremium: boolean;
  pillar: "esports" | "anime" | "lifestyle" | null;
}

export async function listWatchLater(
  userId: string,
  limit = 50,
): Promise<WatchLaterEntry[]> {
  return db
    .select({
      vodId: schema.vodBookmarks.vodId,
      createdAt: schema.vodBookmarks.createdAt,
      title: schema.vods.title,
      thumbnailUrl: schema.vods.thumbnailUrl,
      durationSec: schema.vods.durationSec,
      gameId: schema.vods.gameId,
      isPremium: schema.vods.isPremium,
      pillar: schema.vods.pillar,
    })
    .from(schema.vodBookmarks)
    .innerJoin(schema.vods, eq(schema.vodBookmarks.vodId, schema.vods.id))
    .where(
      and(
        eq(schema.vodBookmarks.userId, userId),
        isNull(schema.vods.deletedAt),
      ),
    )
    .orderBy(desc(schema.vodBookmarks.createdAt))
    .limit(Math.max(1, Math.min(200, limit)));
}

export async function isBookmarked(
  userId: string,
  vodId: string,
): Promise<boolean> {
  const row = (
    await db
      .select()
      .from(schema.vodBookmarks)
      .where(
        and(
          eq(schema.vodBookmarks.userId, userId),
          eq(schema.vodBookmarks.vodId, vodId),
        ),
      )
      .limit(1)
  )[0];
  return !!row;
}

export async function addBookmark(userId: string, vodId: string): Promise<void> {
  await db
    .insert(schema.vodBookmarks)
    .values({ userId, vodId, createdAt: new Date().toISOString() })
    .onConflictDoNothing();
}

export async function removeBookmark(
  userId: string,
  vodId: string,
): Promise<void> {
  await db
    .delete(schema.vodBookmarks)
    .where(
      and(
        eq(schema.vodBookmarks.userId, userId),
        eq(schema.vodBookmarks.vodId, vodId),
      ),
    );
}
