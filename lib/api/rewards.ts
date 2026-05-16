import "server-only";
import { and, count, countDistinct, desc, eq, gt, gte, isNull, or, sql } from "drizzle-orm";
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

/* ── Daily quests ─────────────────────────────────────────────────── */

export interface DailyQuest {
  id: string;
  label: string;
  description: string;
  unit: string;
  target: number;
  rewardCoins: number;
  rewardXp: number;
  progress: number;
  claimed: boolean;
  expiresAt: string;
}

export interface XpEvent {
  id: string;
  userId: string;
  source: string;
  points: number;
  at: string;
}

/**
 * Static quest definitions. Daily reset is per-UTC-day. Adding/removing quests
 * is a code change — admin-editable templates would be a later phase. Tuple
 * structure keeps each quest's "how to count progress" colocated with the
 * template itself.
 */
const DAILY_QUEST_TEMPLATES = [
  {
    id: "quest_watch_30",
    label: "Watch 30 minutes today",
    description: "Tune in to any live stream for at least 30 minutes total today.",
    unit: "minutes",
    target: 30,
    rewardCoins: 200,
    rewardXp: 80,
    progressSource: "watch_minutes" as const,
  },
  {
    id: "quest_like_3_clips",
    label: "Like 3 clips",
    description: "Hit the like button on three clips today.",
    unit: "likes",
    target: 3,
    rewardCoins: 90,
    rewardXp: 25,
    progressSource: "likes" as const,
  },
  {
    id: "quest_send_tip",
    label: "Send a tip to any creator",
    description: "Tip a creator at least 50 EVO Coins.",
    unit: "tips",
    target: 1,
    rewardCoins: 150,
    rewardXp: 50,
    progressSource: "tips" as const,
  },
  {
    id: "quest_login",
    label: "Daily check-in",
    description: "Open EVO TV today.",
    unit: "logins",
    target: 1,
    rewardCoins: 50,
    rewardXp: 15,
    progressSource: "login" as const,
  },
  {
    id: "quest_predict",
    label: "Make 1 match prediction",
    description: "Lock in a winner on any upcoming match.",
    unit: "predictions",
    target: 1,
    rewardCoins: 120,
    rewardXp: 40,
    progressSource: "predictions" as const,
  },
  {
    id: "quest_watch_3_streams",
    label: "Watch 3 different streams",
    description: "Sample three live channels to discover new creators.",
    unit: "streams",
    target: 3,
    rewardCoins: 180,
    rewardXp: 60,
    progressSource: "distinct_streams" as const,
  },
] as const;

function utcDayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function endOfUtcDayIso(date: Date = new Date()): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59),
  );
  return d.toISOString();
}

function startOfUtcDay(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0),
  );
}

async function computeProgressFor(
  userId: string,
  source: (typeof DAILY_QUEST_TEMPLATES)[number]["progressSource"],
): Promise<number> {
  const dayStart = startOfUtcDay();
  const dayStartIso = dayStart.toISOString();

  switch (source) {
    case "watch_minutes": {
      // Each watchEvent row = 1 viewer-minute heartbeat.
      const [row] = await db
        .select({ n: count() })
        .from(schema.watchEvents)
        .where(
          and(
            eq(schema.watchEvents.userId, userId),
            gte(schema.watchEvents.createdAt, dayStartIso),
          ),
        );
      return Number(row?.n ?? 0);
    }
    case "distinct_streams": {
      const [row] = await db
        .select({ n: countDistinct(schema.watchEvents.streamId) })
        .from(schema.watchEvents)
        .where(
          and(
            eq(schema.watchEvents.userId, userId),
            gte(schema.watchEvents.createdAt, dayStartIso),
          ),
        );
      return Number(row?.n ?? 0);
    }
    case "likes": {
      const [row] = await db
        .select({ n: count() })
        .from(schema.likes)
        .where(
          and(
            eq(schema.likes.userId, userId),
            gte(schema.likes.createdAt, dayStartIso),
          ),
        );
      return Number(row?.n ?? 0);
    }
    case "tips": {
      const [row] = await db
        .select({ n: count() })
        .from(schema.tips)
        .where(
          and(
            eq(schema.tips.fromUserId, userId),
            gte(schema.tips.at, dayStartIso),
            gte(schema.tips.coins, 50),
          ),
        );
      return Number(row?.n ?? 0);
    }
    case "predictions": {
      const [row] = await db
        .select({ n: count() })
        .from(schema.predictionPicks)
        .where(
          and(
            eq(schema.predictionPicks.userId, userId),
            gte(schema.predictionPicks.createdAt, dayStartIso),
          ),
        );
      return Number(row?.n ?? 0);
    }
    case "login": {
      // Count any signal of activity today: watchEvents OR xp_events OR likes.
      // Cheapest single signal: at least one xp_event today (login bonus, watch
      // tick, anything). Fallback to watchEvents.
      const [row] = await db
        .select({ n: count() })
        .from(schema.xpEvents)
        .where(
          and(
            eq(schema.xpEvents.userId, userId),
            gte(schema.xpEvents.at, dayStartIso),
          ),
        );
      const xpToday = Number(row?.n ?? 0);
      if (xpToday > 0) return 1;
      const [w] = await db
        .select({ n: count() })
        .from(schema.watchEvents)
        .where(
          and(
            eq(schema.watchEvents.userId, userId),
            gte(schema.watchEvents.createdAt, dayStartIso),
          ),
        );
      return Number(w?.n ?? 0) > 0 ? 1 : 0;
    }
  }
}

export async function listDailyQuests(userId: string): Promise<DailyQuest[]> {
  const dayKey = utcDayKey();
  const claims = await db
    .select({ questId: schema.dailyQuestClaims.questId })
    .from(schema.dailyQuestClaims)
    .where(
      and(
        eq(schema.dailyQuestClaims.userId, userId),
        eq(schema.dailyQuestClaims.dayKey, dayKey),
      ),
    );
  const claimedSet = new Set(claims.map((c) => c.questId));

  const out: DailyQuest[] = [];
  for (const tmpl of DAILY_QUEST_TEMPLATES) {
    const raw = await computeProgressFor(userId, tmpl.progressSource);
    const progress = Math.min(tmpl.target, raw);
    out.push({
      id: tmpl.id,
      label: tmpl.label,
      description: tmpl.description,
      unit: tmpl.unit,
      target: tmpl.target,
      rewardCoins: tmpl.rewardCoins,
      rewardXp: tmpl.rewardXp,
      progress,
      claimed: claimedSet.has(tmpl.id),
      expiresAt: endOfUtcDayIso(),
    });
  }
  return out;
}

export class QuestClaimError extends Error {
  code: "not_found" | "incomplete" | "already_claimed";
  constructor(code: "not_found" | "incomplete" | "already_claimed", msg: string) {
    super(msg);
    this.code = code;
  }
}

export async function claimDailyQuest(
  userId: string,
  questId: string,
): Promise<{ coinsAwarded: number; xpAwarded: number; newBalance: number; newXp: number }> {
  const tmpl = DAILY_QUEST_TEMPLATES.find((t) => t.id === questId);
  if (!tmpl) throw new QuestClaimError("not_found", "Unknown quest");

  const dayKey = utcDayKey();
  const existing = (
    await db
      .select()
      .from(schema.dailyQuestClaims)
      .where(
        and(
          eq(schema.dailyQuestClaims.userId, userId),
          eq(schema.dailyQuestClaims.questId, questId),
          eq(schema.dailyQuestClaims.dayKey, dayKey),
        ),
      )
      .limit(1)
  )[0];
  if (existing) {
    throw new QuestClaimError("already_claimed", "Quest already claimed today");
  }

  const progress = await computeProgressFor(userId, tmpl.progressSource);
  if (progress < tmpl.target) {
    throw new QuestClaimError("incomplete", "Quest progress not yet met");
  }

  await ensureBalance(userId);
  await db
    .update(schema.coinBalances)
    .set({
      coins: sql`${schema.coinBalances.coins} + ${tmpl.rewardCoins}`,
      xp: sql`${schema.coinBalances.xp} + ${tmpl.rewardXp}`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.coinBalances.userId, userId));

  const xpEventId =
    "xp_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  await db.insert(schema.xpEvents).values({
    id: xpEventId,
    userId,
    source: "quest_complete",
    points: tmpl.rewardXp,
    at: new Date().toISOString(),
  });

  await db.insert(schema.dailyQuestClaims).values({
    userId,
    questId,
    dayKey,
    rewardCoins: tmpl.rewardCoins,
    rewardXp: tmpl.rewardXp,
    claimedAt: new Date().toISOString(),
  });

  const fresh = (
    await db
      .select()
      .from(schema.coinBalances)
      .where(eq(schema.coinBalances.userId, userId))
      .limit(1)
  )[0]!;

  return {
    coinsAwarded: tmpl.rewardCoins,
    xpAwarded: tmpl.rewardXp,
    newBalance: fresh.coins,
    newXp: fresh.xp,
  };
}

export async function listRecentXpEvents(
  userId: string,
  limit = 20,
): Promise<XpEvent[]> {
  const rows = await db
    .select()
    .from(schema.xpEvents)
    .where(eq(schema.xpEvents.userId, userId))
    .orderBy(desc(schema.xpEvents.at))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    source: r.source,
    points: r.points,
    at: r.at,
  }));
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
