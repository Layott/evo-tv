import "server-only";
import { and, desc, eq, sql, sum } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCoinBalance } from "./rewards";

export interface Tip {
  id: string;
  fromUserId: string;
  toUserId: string;
  streamId: string | null;
  coins: number;
  message: string;
  at: string;
}

export class TipError extends Error {
  code: "invalid_amount" | "insufficient_coins" | "self_tip" | "user_not_found";
  constructor(
    code: TipError["code"],
    msg: string,
  ) {
    super(msg);
    this.code = code;
  }
}

const MIN_TIP = 10;
const MAX_TIP = 50_000;

export async function sendTip(input: {
  fromUserId: string;
  toUserId: string;
  coins: number;
  message?: string;
  streamId?: string | null;
}): Promise<Tip> {
  const { fromUserId, toUserId, coins, message, streamId } = input;
  if (fromUserId === toUserId)
    throw new TipError("self_tip", "Can't tip yourself");
  if (!Number.isInteger(coins) || coins < MIN_TIP || coins > MAX_TIP)
    throw new TipError(
      "invalid_amount",
      `Tip must be between ${MIN_TIP} and ${MAX_TIP} EVO Coins`,
    );

  const recipient = (
    await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.id, toUserId))
      .limit(1)
  )[0];
  if (!recipient) throw new TipError("user_not_found", "Recipient not found");

  const balance = await getCoinBalance(fromUserId);
  if (balance < coins)
    throw new TipError("insufficient_coins", "Not enough EVO Coins");

  // Debit sender. Atomic guard via WHERE on coins.
  const debited = await db
    .update(schema.coinBalances)
    .set({
      coins: sql`${schema.coinBalances.coins} - ${coins}`,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(schema.coinBalances.userId, fromUserId),
        sql`${schema.coinBalances.coins} >= ${coins}`,
      ),
    )
    .returning({ id: schema.coinBalances.userId });
  if (debited.length === 0)
    throw new TipError("insufficient_coins", "Not enough EVO Coins");

  // Credit recipient (upsert).
  await db
    .insert(schema.coinBalances)
    .values({
      userId: toUserId,
      coins,
      xp: 0,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: schema.coinBalances.userId,
      set: {
        coins: sql`${schema.coinBalances.coins} + ${coins}`,
        updatedAt: new Date().toISOString(),
      },
    });

  const id =
    "tip_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  await db.insert(schema.tips).values({
    id,
    fromUserId,
    toUserId,
    streamId: streamId ?? null,
    coins,
    message: message ?? "",
    at: new Date().toISOString(),
  });

  const inserted = (
    await db.select().from(schema.tips).where(eq(schema.tips.id, id)).limit(1)
  )[0]!;
  return {
    id: inserted.id,
    fromUserId: inserted.fromUserId,
    toUserId: inserted.toUserId,
    streamId: inserted.streamId,
    coins: inserted.coins,
    message: inserted.message,
    at: inserted.at,
  };
}

export async function listTipsFromUser(
  userId: string,
  limit = 50,
): Promise<Tip[]> {
  const rows = await db
    .select()
    .from(schema.tips)
    .where(eq(schema.tips.fromUserId, userId))
    .orderBy(desc(schema.tips.at))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    fromUserId: r.fromUserId,
    toUserId: r.toUserId,
    streamId: r.streamId,
    coins: r.coins,
    message: r.message,
    at: r.at,
  }));
}

export async function listTipsToUser(
  userId: string,
  limit = 50,
): Promise<Tip[]> {
  const rows = await db
    .select()
    .from(schema.tips)
    .where(eq(schema.tips.toUserId, userId))
    .orderBy(desc(schema.tips.at))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    fromUserId: r.fromUserId,
    toUserId: r.toUserId,
    streamId: r.streamId,
    coins: r.coins,
    message: r.message,
    at: r.at,
  }));
}

export async function totalReceivedByUser(userId: string): Promise<number> {
  const rows = await db
    .select({ total: sum(schema.tips.coins) })
    .from(schema.tips)
    .where(eq(schema.tips.toUserId, userId));
  return Number(rows[0]?.total ?? 0);
}
