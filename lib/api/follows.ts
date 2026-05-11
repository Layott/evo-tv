import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Follow, FollowTarget } from "@/lib/types";

function toFollow(r: typeof schema.follows.$inferSelect): Follow {
  return {
    userId: r.userId,
    targetType: r.targetType as FollowTarget,
    targetId: r.targetId,
    createdAt: r.createdAt,
  };
}

export async function isFollowing(
  userId: string,
  targetType: FollowTarget,
  targetId: string
): Promise<boolean> {
  const row = (
    await db
      .select()
      .from(schema.follows)
      .where(
        and(
          eq(schema.follows.userId, userId),
          eq(schema.follows.targetType, targetType),
          eq(schema.follows.targetId, targetId)
        )
      )
      .limit(1)
  )[0];
  return !!row;
}

/**
 * Flip the follow state for (userId, targetType, targetId).
 * Returns `true` if the user is now following, `false` if they unfollowed.
 */
export async function toggleFollow(
  userId: string,
  targetType: FollowTarget,
  targetId: string
): Promise<boolean> {
  const existing = (
    await db
      .select()
      .from(schema.follows)
      .where(
        and(
          eq(schema.follows.userId, userId),
          eq(schema.follows.targetType, targetType),
          eq(schema.follows.targetId, targetId)
        )
      )
      .limit(1)
  )[0];

  if (existing) {
    await db
      .delete(schema.follows)
      .where(
        and(
          eq(schema.follows.userId, userId),
          eq(schema.follows.targetType, targetType),
          eq(schema.follows.targetId, targetId)
        )
      );
    return false;
  }

  await db
    .insert(schema.follows)
    .values({
      userId,
      targetType,
      targetId,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
  return true;
}

export async function listFollows(userId: string): Promise<Follow[]> {
  return (
    await db
      .select()
      .from(schema.follows)
      .where(eq(schema.follows.userId, userId))
      .orderBy(desc(schema.follows.createdAt))
  ).map(toFollow);
}
