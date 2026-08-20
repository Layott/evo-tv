import "server-only";
import crypto from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { DEFAULT_CHAT_RULES, type ChatRules } from "@/lib/chat/rules";

/**
 * Reading and writing the chat rules, and counting who has broken them.
 *
 * The screening itself lives in `lib/chat/rules.ts` with no database in sight,
 * because that is the part that has to be right and the part worth testing.
 * This is the part that has to be fast: it runs on every message.
 */

function toRules(row: typeof schema.chatRules.$inferSelect | undefined): ChatRules | null {
  if (!row) return null;
  return {
    blockLinks: row.blockLinks,
    allowedDomains: row.allowedDomains ?? [],
    bannedWords: row.bannedWords ?? [],
    strikesBeforeBan: row.strikesBeforeBan,
    banMinutes: row.banMinutes,
  };
}

/**
 * The rules in force for one broadcast.
 *
 * A stream's own row replaces the house rule outright. Merging them would mean
 * an operator relaxing links for one match without noticing they had also
 * inherited a word list from six months ago.
 */
export async function effectiveChatRules(streamId: string): Promise<ChatRules> {
  const [own, house] = await Promise.all([
    db
      .select()
      .from(schema.chatRules)
      .where(eq(schema.chatRules.streamId, streamId))
      .limit(1),
    db
      .select()
      .from(schema.chatRules)
      .where(isNull(schema.chatRules.streamId))
      .limit(1),
  ]);

  return toRules(own[0]) ?? toRules(house[0]) ?? DEFAULT_CHAT_RULES;
}

/** The stored row for a stream, or the house rule when `streamId` is null. */
export async function readChatRules(streamId: string | null): Promise<ChatRules> {
  const rows = await db
    .select()
    .from(schema.chatRules)
    .where(
      streamId === null
        ? isNull(schema.chatRules.streamId)
        : eq(schema.chatRules.streamId, streamId),
    )
    .limit(1);
  return toRules(rows[0]) ?? DEFAULT_CHAT_RULES;
}

export async function writeChatRules(
  streamId: string | null,
  rules: ChatRules,
): Promise<ChatRules> {
  const now = new Date().toISOString();
  const existing = await db
    .select({ id: schema.chatRules.id })
    .from(schema.chatRules)
    .where(
      streamId === null
        ? isNull(schema.chatRules.streamId)
        : eq(schema.chatRules.streamId, streamId),
    )
    .limit(1);

  const values = {
    blockLinks: rules.blockLinks,
    allowedDomains: rules.allowedDomains,
    bannedWords: rules.bannedWords,
    strikesBeforeBan: rules.strikesBeforeBan,
    banMinutes: rules.banMinutes,
    updatedAt: now,
  };

  if (existing[0]) {
    await db
      .update(schema.chatRules)
      .set(values)
      .where(eq(schema.chatRules.id, existing[0].id));
  } else {
    await db.insert(schema.chatRules).values({
      id: "chatrule_" + crypto.randomBytes(6).toString("hex"),
      streamId,
      createdAt: now,
      ...values,
    });
  }
  return rules;
}

/**
 * Count one broken rule against a person, and say whether that is the last one.
 *
 * Strikes are per broadcast on purpose: a link pasted in a match three weeks ago
 * should not be two thirds of a ban tonight.
 */
export async function recordStrike(
  userId: string,
  streamId: string,
): Promise<number> {
  const now = new Date().toISOString();
  const [row] = await db
    .insert(schema.chatStrikes)
    .values({ userId, streamId, count: 1, lastAt: now })
    .onConflictDoUpdate({
      target: [schema.chatStrikes.userId, schema.chatStrikes.streamId],
      set: { count: sql`${schema.chatStrikes.count} + 1`, lastAt: now },
    })
    .returning({ count: schema.chatStrikes.count });

  return row?.count ?? 1;
}

/** Forget a person's strikes on a broadcast, which is what lifting a ban means. */
export async function clearStrikes(userId: string, streamId: string): Promise<void> {
  await db
    .delete(schema.chatStrikes)
    .where(
      and(
        eq(schema.chatStrikes.userId, userId),
        eq(schema.chatStrikes.streamId, streamId),
      ),
    );
}

/**
 * Ban somebody from chat for a while, using the same sanction the moderation
 * queue writes, so there is one list of who is banned and one thing that lifts
 * it.
 */
export async function banFromChatForMinutes(
  userId: string,
  minutes: number,
  reason: string,
): Promise<string> {
  const nowMs = Date.now();
  const expiresAt = new Date(nowMs + minutes * 60_000).toISOString();
  await db.insert(schema.userSanctions).values({
    id: "san_" + crypto.randomBytes(8).toString("hex"),
    userId,
    kind: "chat_banned",
    reason,
    // Null is the system: the rules issued this, not a person.
    issuedBy: null,
    expiresAt,
    revertedAt: null,
    revertedBy: null,
    createdAt: new Date(nowMs).toISOString(),
  });
  return expiresAt;
}
