import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type LikeTarget = "vod" | "clip";

function parentTable(targetType: LikeTarget) {
  return targetType === "vod" ? schema.vods : schema.clips;
}

/**
 * Toggle a user's like for a target. Returns the new state and updated count.
 * Also keeps the cached `likeCount` on the parent row in sync so existing
 * list/detail queries stay truthful without extra joins.
 */
export async function toggleLike(
  userId: string,
  targetType: LikeTarget,
  targetId: string
): Promise<{ liked: boolean; count: number }> {
  const existing = (
    await db
      .select()
      .from(schema.likes)
      .where(
        and(
          eq(schema.likes.userId, userId),
          eq(schema.likes.targetType, targetType),
          eq(schema.likes.targetId, targetId)
        )
      )
      .limit(1)
  )[0];

  const parent = parentTable(targetType);

  if (existing) {
    await db
      .delete(schema.likes)
      .where(
        and(
          eq(schema.likes.userId, userId),
          eq(schema.likes.targetType, targetType),
          eq(schema.likes.targetId, targetId)
        )
      );
    await db
      .update(parent)
      .set({ likeCount: sql`GREATEST(0, ${parent.likeCount} - 1)` })
      .where(eq(parent.id, targetId));
    const count = await likeCountFor(targetType, targetId);
    return { liked: false, count };
  }

  await db
    .insert(schema.likes)
    .values({
      userId,
      targetType,
      targetId,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
  await db
    .update(parent)
    .set({ likeCount: sql`${parent.likeCount} + 1` })
    .where(eq(parent.id, targetId));
  const count = await likeCountFor(targetType, targetId);
  return { liked: true, count };
}

export async function likeCountFor(
  targetType: LikeTarget,
  targetId: string
): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.likes)
    .where(
      and(
        eq(schema.likes.targetType, targetType),
        eq(schema.likes.targetId, targetId)
      )
    );
  return Number(rows[0]?.n ?? 0);
}

export async function hasLiked(
  userId: string,
  targetType: LikeTarget,
  targetId: string
): Promise<boolean> {
  const row = (
    await db
      .select()
      .from(schema.likes)
      .where(
        and(
          eq(schema.likes.userId, userId),
          eq(schema.likes.targetType, targetType),
          eq(schema.likes.targetId, targetId)
        )
      )
      .limit(1)
  )[0];
  return !!row;
}
