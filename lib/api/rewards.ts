import "server-only";
import { and, desc, eq, gt, gte, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const DEFAULT_COINS = 4_280;
const DEFAULT_XP = 2_185;

export type DropKind = "cosmetic" | "premium-trial" | "merch-voucher";
export type Rarity = "common" | "rare" | "epic" | "legendary";
export type RedemptionStatus = "pending" | "delivered" | "expired";
export type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

const TIER_THRESHOLDS: Record<Tier, number> = {
  Bronze: 0,
  Silver: 500,
  Gold: 1_500,
  Platinum: 4_000,
  Diamond: 9_000,
};
const TIER_ORDER: Tier[] = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

export interface Drop {
  id: string;
  name: string;
  kind: DropKind;
  cost: number;
  stock: number;
  imageUrl: string;
  partner: string;
  description: string;
  category: string;
  rarity: Rarity;
  expiresAt: string | null;
}

export interface Redemption {
  id: string;
  userId: string;
  dropId: string;
  dropName: string;
  dropKind: DropKind;
  partner: string;
  imageUrl: string;
  code: string;
  cost: number;
  redeemedAt: string;
  status: RedemptionStatus;
}

export interface XpTierInfo {
  userId: string;
  totalXp: number;
  tier: Tier;
  nextTier: Tier | null;
  pointsIntoTier: number;
  pointsToNextTier: number;
  progressPct: number;
  coinsBalance: number;
}

function tierFor(xp: number): Tier {
  let result: Tier = "Bronze";
  for (const t of TIER_ORDER) {
    if (xp >= TIER_THRESHOLDS[t]) result = t;
  }
  return result;
}

function nextTierOf(t: Tier): Tier | null {
  const idx = TIER_ORDER.indexOf(t);
  return idx >= 0 && idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1]! : null;
}

function newCode(): string {
  const seg = () =>
    Math.random().toString(36).slice(2, 6).toUpperCase().padStart(4, "0");
  return [seg(), seg(), seg(), seg()].join("-");
}

async function ensureBalance(userId: string): Promise<{
  coins: number;
  xp: number;
}> {
  const existing = (
    await db
      .select()
      .from(schema.coinBalances)
      .where(eq(schema.coinBalances.userId, userId))
      .limit(1)
  )[0];
  if (existing) {
    return { coins: existing.coins, xp: existing.xp };
  }
  await db
    .insert(schema.coinBalances)
    .values({
      userId,
      coins: DEFAULT_COINS,
      xp: DEFAULT_XP,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
  return { coins: DEFAULT_COINS, xp: DEFAULT_XP };
}

/* ── Drops ────────────────────────────────────────────────────────── */

export async function listDrops(filter?: {
  kind?: DropKind;
  category?: string;
}): Promise<Drop[]> {
  const conds = [eq(schema.rewardsDrops.active, 1)];
  if (filter?.kind) conds.push(eq(schema.rewardsDrops.kind, filter.kind));
  if (filter?.category)
    conds.push(eq(schema.rewardsDrops.category, filter.category));
  const rows = await db
    .select()
    .from(schema.rewardsDrops)
    .where(and(...conds));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind as DropKind,
    cost: r.cost,
    stock: r.stock,
    imageUrl: r.imageUrl,
    partner: r.partner,
    description: r.description,
    category: r.category,
    rarity: r.rarity as Rarity,
    expiresAt: r.expiresAt,
  }));
}

export async function getDropById(id: string): Promise<Drop | null> {
  const r = (
    await db
      .select()
      .from(schema.rewardsDrops)
      .where(eq(schema.rewardsDrops.id, id))
      .limit(1)
  )[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    kind: r.kind as DropKind,
    cost: r.cost,
    stock: r.stock,
    imageUrl: r.imageUrl,
    partner: r.partner,
    description: r.description,
    category: r.category,
    rarity: r.rarity as Rarity,
    expiresAt: r.expiresAt,
  };
}

/* ── Wallet ───────────────────────────────────────────────────────── */

export async function getXpAndTier(userId: string): Promise<XpTierInfo> {
  const { coins, xp } = await ensureBalance(userId);
  const tier = tierFor(xp);
  const next = nextTierOf(tier);
  const tierStart = TIER_THRESHOLDS[tier];
  const tierEnd = next ? TIER_THRESHOLDS[next] : tierStart + 5_000;
  const into = Math.max(0, xp - tierStart);
  const range = Math.max(1, tierEnd - tierStart);
  return {
    userId,
    totalXp: xp,
    tier,
    nextTier: next,
    pointsIntoTier: into,
    pointsToNextTier: Math.max(0, tierEnd - xp),
    progressPct: Math.min(100, Math.round((into / range) * 100)),
    coinsBalance: coins,
  };
}

export async function getCoinBalance(userId: string): Promise<number> {
  const { coins } = await ensureBalance(userId);
  return coins;
}

/* ── Redemption ───────────────────────────────────────────────────── */

export class RedeemError extends Error {
  code: "not_found" | "out_of_stock" | "insufficient_coins" | "expired";
  constructor(
    code: "not_found" | "out_of_stock" | "insufficient_coins" | "expired",
    msg: string,
  ) {
    super(msg);
    this.code = code;
  }
}

export async function redeemDrop(
  userId: string,
  dropId: string,
): Promise<Redemption> {
  const drop = (
    await db
      .select()
      .from(schema.rewardsDrops)
      .where(eq(schema.rewardsDrops.id, dropId))
      .limit(1)
  )[0];
  if (!drop || drop.active === 0)
    throw new RedeemError("not_found", "Drop not found");
  if (drop.stock <= 0)
    throw new RedeemError("out_of_stock", "Out of stock");
  if (drop.expiresAt && new Date(drop.expiresAt) < new Date())
    throw new RedeemError("expired", "Drop expired");

  const bal = await ensureBalance(userId);
  if (bal.coins < drop.cost)
    throw new RedeemError("insufficient_coins", "Not enough EVO Coins");

  const decremented = await db
    .update(schema.rewardsDrops)
    .set({ stock: sql`${schema.rewardsDrops.stock} - 1` })
    .where(
      and(
        eq(schema.rewardsDrops.id, dropId),
        gt(schema.rewardsDrops.stock, 0),
      ),
    )
    .returning({ id: schema.rewardsDrops.id, stock: schema.rewardsDrops.stock });
  if (decremented.length === 0)
    throw new RedeemError("out_of_stock", "Out of stock");

  await db
    .update(schema.coinBalances)
    .set({
      coins: sql`${schema.coinBalances.coins} - ${drop.cost}`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.coinBalances.userId, userId));

  const id =
    "rdmp_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const status: RedemptionStatus =
    drop.kind === "merch-voucher" ? "pending" : "delivered";

  await db.insert(schema.rewardsRedemptions).values({
    id,
    userId,
    dropId,
    code: newCode(),
    cost: drop.cost,
    status,
    redeemedAt: new Date().toISOString(),
  });

  const inserted = (
    await db
      .select()
      .from(schema.rewardsRedemptions)
      .where(eq(schema.rewardsRedemptions.id, id))
      .limit(1)
  )[0]!;

  return {
    id: inserted.id,
    userId: inserted.userId,
    dropId: drop.id,
    dropName: drop.name,
    dropKind: drop.kind as DropKind,
    partner: drop.partner,
    imageUrl: drop.imageUrl,
    code: inserted.code,
    cost: inserted.cost,
    redeemedAt: inserted.redeemedAt,
    status: inserted.status as RedemptionStatus,
  };
}

export async function listMyRedemptions(userId: string): Promise<Redemption[]> {
  const rows = await db
    .select({
      r: schema.rewardsRedemptions,
      d: schema.rewardsDrops,
    })
    .from(schema.rewardsRedemptions)
    .innerJoin(
      schema.rewardsDrops,
      eq(schema.rewardsRedemptions.dropId, schema.rewardsDrops.id),
    )
    .where(eq(schema.rewardsRedemptions.userId, userId))
    .orderBy(desc(schema.rewardsRedemptions.redeemedAt));
  return rows.map(({ r, d }) => ({
    id: r.id,
    userId: r.userId,
    dropId: d.id,
    dropName: d.name,
    dropKind: d.kind as DropKind,
    partner: d.partner,
    imageUrl: d.imageUrl,
    code: r.code,
    cost: r.cost,
    redeemedAt: r.redeemedAt,
    status: r.status as RedemptionStatus,
  }));
}
