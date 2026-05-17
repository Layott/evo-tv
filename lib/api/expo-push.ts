import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type ExpoPlatform = "ios" | "android" | "web";

export async function registerExpoToken(
  userId: string,
  token: string,
  platform: ExpoPlatform,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insert(schema.expoPushTokens)
    .values({
      token,
      userId,
      platform,
      createdAt: now,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: schema.expoPushTokens.token,
      set: {
        userId,
        platform,
        lastSeenAt: now,
      },
    });
}

export async function unregisterExpoToken(
  userId: string,
  token: string,
): Promise<void> {
  await db
    .delete(schema.expoPushTokens)
    .where(
      and(
        eq(schema.expoPushTokens.userId, userId),
        eq(schema.expoPushTokens.token, token),
      ),
    );
}

export async function listExpoTokensForUser(
  userId: string,
): Promise<{ token: string; platform: ExpoPlatform; lastSeenAt: string }[]> {
  const rows = await db
    .select()
    .from(schema.expoPushTokens)
    .where(eq(schema.expoPushTokens.userId, userId));
  return rows.map((r) => ({
    token: r.token,
    platform: r.platform as ExpoPlatform,
    lastSeenAt: r.lastSeenAt,
  }));
}
