// Drops & Watch-time Rewards mock module.
// Phase F mock — every helper preserves the signature it will keep when swapped to lib/api/rewards.
//
// Persistence: all mutations are mirrored into localStorage under `evotv_rewards_v1`
// so a refresh keeps progress, claimed quests, and redemptions intact.

import { sleep, daysAgo, hoursAgo, minutesAgo } from "./_util";
import { vodPoster, clipThumb, productPhoto } from "./_media";

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------
export type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export interface XpEvent {
  id: string;
  userId: string;
  source:
    | "watch_minute"
    | "stream_finish"
    | "quest_complete"
    | "first_watch_of_day"
    | "weekly_bonus"
    | "tip_sent"
    | "vod_like";
  points: number;
  at: string;
}

export interface DailyQuest {
  id: string;
  label: string;
  description: string;
  target: number;
  progress: number;
  rewardCoins: number;
  rewardXp: number;
  unit: "minutes" | "likes" | "tips" | "logins" | "predictions" | "streams";
  claimed: boolean;
  expiresAt: string;
}

export type DropKind = "cosmetic" | "premium-trial" | "merch-voucher";

export interface Drop {
  id: string;
  name: string;
  kind: DropKind;
  cost: number; // EVO Coins
  stock: number;
  imageUrl: string;
  partner: string;
  description: string;
  category: string; // for filtering: "Free Fire", "EA FC", "EVO TV", "Apparel", etc.
  rarity: "common" | "rare" | "epic" | "legendary";
  expiresAt: string | null; // null = no expiry
}

export type RedemptionStatus = "pending" | "delivered" | "expired";

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
  progressPct: number; // 0..100
  coinsBalance: number;
}

// -------------------------------------------------------------------
// Tier thresholds
// -------------------------------------------------------------------
const TIER_THRESHOLDS: Record<Tier, number> = {
  Bronze: 0,
  Silver: 500,
  Gold: 1_500,
  Platinum: 4_000,
  Diamond: 9_000,
};

const TIER_ORDER: Tier[] = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

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

// -------------------------------------------------------------------
// Persistence
// -------------------------------------------------------------------
const STORAGE_KEY = "evotv_rewards_v1";

interface PersistedState {
  coins: Record<string, number>;
  xp: Record<string, number>;
  questProgress: Record<string, { progress: number; claimed: boolean }>; // keyed by `${userId}:${questId}`
  redemptions: Redemption[];
  dropStock: Record<string, number>; // override for stock counts
  events: XpEvent[];
}

function emptyState(): PersistedState {
  return { coins: {}, xp: {}, questProgress: {}, redemptions: [], dropStock: {}, events: [] };
}

function loadState(): PersistedState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      coins: parsed.coins ?? {},
      xp: parsed.xp ?? {},
      questProgress: parsed.questProgress ?? {},
      redemptions: parsed.redemptions ?? [],
      dropStock: parsed.dropStock ?? {},
      events: parsed.events ?? [],
    };
  } catch {
    return emptyState();
  }
}

function saveState(s: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

// -------------------------------------------------------------------
// Seed data
// -------------------------------------------------------------------
const DEFAULT_COINS = 4_280;
const DEFAULT_XP = 2_185; // ~ Gold tier

function seededXpEvents(userId: string): XpEvent[] {
  // 50+ events spread over the last 30 days.
  const sources: XpEvent["source"][] = [
    "watch_minute",
    "watch_minute",
    "watch_minute",
    "first_watch_of_day",
    "stream_finish",
    "vod_like",
    "quest_complete",
    "tip_sent",
    "weekly_bonus",
  ];
  const out: XpEvent[] = [];
  for (let i = 0; i < 60; i++) {
    const src = sources[i % sources.length]!;
    const base =
      src === "watch_minute"
        ? 5 + (i % 4)
        : src === "first_watch_of_day"
          ? 25
          : src === "stream_finish"
            ? 40
            : src === "vod_like"
              ? 8
              : src === "quest_complete"
                ? 80
                : src === "tip_sent"
                  ? 30
                  : 120;
    out.push({
      id: `xp_${userId}_${i}`,
      userId,
      source: src,
      points: base,
      at: i < 4 ? hoursAgo(i + 1) : daysAgo(Math.floor(i / 2)),
    });
  }
  return out;
}

const QUEST_TEMPLATES: Omit<DailyQuest, "progress" | "claimed">[] = [
  {
    id: "quest_watch_30",
    label: "Watch 30 minutes of live streams",
    description: "Tune in to any live stream for at least 30 minutes total today.",
    target: 30,
    rewardCoins: 200,
    rewardXp: 80,
    unit: "minutes",
    expiresAt: hoursAgo(-12),
  },
  {
    id: "quest_like_3_clips",
    label: "Like 3 clips",
    description: "Hit the like button on three trending clips.",
    target: 3,
    rewardCoins: 90,
    rewardXp: 25,
    unit: "likes",
    expiresAt: hoursAgo(-12),
  },
  {
    id: "quest_send_tip",
    label: "Send a tip to any streamer",
    description: "Cheer on a creator with at least 50 EVO Coins.",
    target: 1,
    rewardCoins: 150,
    rewardXp: 50,
    unit: "tips",
    expiresAt: hoursAgo(-12),
  },
  {
    id: "quest_login",
    label: "Daily check-in",
    description: "Open EVO TV and stay for at least one minute.",
    target: 1,
    rewardCoins: 50,
    rewardXp: 15,
    unit: "logins",
    expiresAt: hoursAgo(-12),
  },
  {
    id: "quest_predict",
    label: "Make 1 match prediction",
    description: "Pick a winner on any upcoming match.",
    target: 1,
    rewardCoins: 120,
    rewardXp: 40,
    unit: "predictions",
    expiresAt: hoursAgo(-12),
  },
  {
    id: "quest_watch_3_streams",
    label: "Watch 3 different streams",
    description: "Sample three live channels to discover new creators.",
    target: 3,
    rewardCoins: 180,
    rewardXp: 60,
    unit: "streams",
    expiresAt: hoursAgo(-12),
  },
];

// Seed default progress so the page always feels populated.
const SEED_PROGRESS: Record<string, number> = {
  quest_watch_30: 18,
  quest_like_3_clips: 1,
  quest_send_tip: 0,
  quest_login: 1, // already complete (claimable)
  quest_predict: 0,
  quest_watch_3_streams: 2,
};

// 20+ drops for the store across categories.
const DROPS: Drop[] = [
  {
    id: "drop_ff_diamond_skin",
    name: "Free Fire — Diamond Bundle Skin",
    kind: "cosmetic",
    cost: 2_400,
    stock: 42,
    imageUrl: clipThumb("drop_ff_diamond_skin"),
    partner: "Garena",
    description: "Limited edition character skin. Redeems via in-game code.",
    category: "Free Fire",
    rarity: "epic",
    expiresAt: daysAgo(-7),
  },
  {
    id: "drop_ff_pet_bundle",
    name: "Free Fire — Pet Spirit Bundle",
    kind: "cosmetic",
    cost: 1_800,
    stock: 64,
    imageUrl: clipThumb("drop_ff_pet_bundle"),
    partner: "Garena",
    description: "Pet skin + 3 emotes. Single-use redemption code.",
    category: "Free Fire",
    rarity: "rare",
    expiresAt: daysAgo(-12),
  },
  {
    id: "drop_codm_blueprint",
    name: "CoD Mobile — Mythic Blueprint",
    kind: "cosmetic",
    cost: 3_600,
    stock: 18,
    imageUrl: clipThumb("drop_codm_blueprint"),
    partner: "Activision",
    description: "Animated weapon blueprint with custom finisher.",
    category: "CoD Mobile",
    rarity: "legendary",
    expiresAt: daysAgo(-5),
  },
  {
    id: "drop_codm_emote",
    name: "CoD Mobile — Operator Emote Pack",
    kind: "cosmetic",
    cost: 900,
    stock: 120,
    imageUrl: clipThumb("drop_codm_emote"),
    partner: "Activision",
    description: "5 operator-themed emotes you can use in lobby.",
    category: "CoD Mobile",
    rarity: "common",
    expiresAt: null,
  },
  {
    id: "drop_pubgm_uc_50",
    name: "PUBG Mobile — 50 UC Top-up",
    kind: "cosmetic",
    cost: 600,
    stock: 200,
    imageUrl: clipThumb("drop_pubgm_uc_50"),
    partner: "Krafton",
    description: "Direct UC top-up to your PUBG Mobile account.",
    category: "PUBG Mobile",
    rarity: "common",
    expiresAt: null,
  },
  {
    id: "drop_pubgm_skin",
    name: "PUBG Mobile — Drift Helmet Skin",
    kind: "cosmetic",
    cost: 2_100,
    stock: 35,
    imageUrl: clipThumb("drop_pubgm_skin"),
    partner: "Krafton",
    description: "Exclusive helmet skin awarded only to EVO TV viewers.",
    category: "PUBG Mobile",
    rarity: "epic",
    expiresAt: daysAgo(-21),
  },
  {
    id: "drop_eafc_mobile_pack",
    name: "EA FC Mobile — Gold Pack x3",
    kind: "cosmetic",
    cost: 1_200,
    stock: 88,
    imageUrl: clipThumb("drop_eafc_mobile_pack"),
    partner: "EA Sports",
    description: "Three gold packs delivered straight to your club.",
    category: "EA FC",
    rarity: "rare",
    expiresAt: daysAgo(-14),
  },
  {
    id: "drop_eafc_kit",
    name: "EA FC — EVO TV Custom Kit",
    kind: "cosmetic",
    cost: 800,
    stock: 145,
    imageUrl: clipThumb("drop_eafc_kit"),
    partner: "EA Sports",
    description: "Wear the EVO TV custom kit in any Ultimate Team match.",
    category: "EA FC",
    rarity: "common",
    expiresAt: null,
  },
  {
    id: "drop_premium_7d",
    name: "EVO Premium — 7 day trial",
    kind: "premium-trial",
    cost: 1_500,
    stock: 50,
    imageUrl: vodPoster("drop_premium_7d"),
    partner: "EVO TV",
    description: "Unlock ad-free streams + film room for one week.",
    category: "EVO TV",
    rarity: "rare",
    expiresAt: null,
  },
  {
    id: "drop_premium_30d",
    name: "EVO Premium — 30 day trial",
    kind: "premium-trial",
    cost: 5_500,
    stock: 25,
    imageUrl: vodPoster("drop_premium_30d"),
    partner: "EVO TV",
    description: "A full month of premium access. No card required.",
    category: "EVO TV",
    rarity: "epic",
    expiresAt: null,
  },
  {
    id: "drop_premium_1d",
    name: "EVO Premium — 24h pass",
    kind: "premium-trial",
    cost: 300,
    stock: 500,
    imageUrl: vodPoster("drop_premium_1d"),
    partner: "EVO TV",
    description: "Quick taste of premium. 24 hours, ad-free.",
    category: "EVO TV",
    rarity: "common",
    expiresAt: null,
  },
  {
    id: "drop_merch_jersey_15",
    name: "15% off Team Alpha Jersey",
    kind: "merch-voucher",
    cost: 700,
    stock: 90,
    imageUrl: productPhoto("merch_jersey"),
    partner: "EVO Shop",
    description: "Single-use code for 15% off the Team Alpha 2026 jersey.",
    category: "Apparel",
    rarity: "common",
    expiresAt: daysAgo(-30),
  },
  {
    id: "drop_merch_hoodie_25",
    name: "25% off EVO TV Hoodie",
    kind: "merch-voucher",
    cost: 1_100,
    stock: 60,
    imageUrl: productPhoto("merch_hoodie"),
    partner: "EVO Shop",
    description: "Quarter off the EVO TV classic hoodie.",
    category: "Apparel",
    rarity: "rare",
    expiresAt: daysAgo(-14),
  },
  {
    id: "drop_merch_cap_full",
    name: "Free Championship Snapback",
    kind: "merch-voucher",
    cost: 4_000,
    stock: 12,
    imageUrl: productPhoto("merch_cap"),
    partner: "EVO Shop",
    description: "Limited edition snapback. Pay shipping only.",
    category: "Apparel",
    rarity: "legendary",
    expiresAt: daysAgo(-7),
  },
  {
    id: "drop_merch_sticker",
    name: "EVO TV Sticker Pack",
    kind: "merch-voucher",
    cost: 250,
    stock: 300,
    imageUrl: productPhoto("merch_sticker"),
    partner: "EVO Shop",
    description: "10 holographic stickers shipped Africa-wide.",
    category: "Apparel",
    rarity: "common",
    expiresAt: null,
  },
  {
    id: "drop_dstv_voucher",
    name: "DStv NOW — 1 month voucher",
    kind: "merch-voucher",
    cost: 3_200,
    stock: 30,
    imageUrl: productPhoto("merch_dstv"),
    partner: "DStv",
    description: "30-day DStv NOW streaming voucher (Africa).",
    category: "Partners",
    rarity: "epic",
    expiresAt: daysAgo(-30),
  },
  {
    id: "drop_jumia_voucher",
    name: "Jumia ₦5,000 Voucher",
    kind: "merch-voucher",
    cost: 2_400,
    stock: 70,
    imageUrl: productPhoto("merch_jumia"),
    partner: "Jumia",
    description: "₦5,000 spend voucher applicable across Jumia.",
    category: "Partners",
    rarity: "rare",
    expiresAt: daysAgo(-21),
  },
  {
    id: "drop_glo_data",
    name: "Glo 2GB Data Bundle",
    kind: "merch-voucher",
    cost: 600,
    stock: 180,
    imageUrl: productPhoto("merch_glo"),
    partner: "Glo Mobile",
    description: "2GB data bundle, valid 14 days from activation.",
    category: "Partners",
    rarity: "common",
    expiresAt: null,
  },
  {
    id: "drop_chicken_meal",
    name: "Chicken Republic Meal Voucher",
    kind: "merch-voucher",
    cost: 1_500,
    stock: 80,
    imageUrl: productPhoto("merch_chicken"),
    partner: "Chicken Republic",
    description: "Free combo meal at any participating store.",
    category: "Partners",
    rarity: "rare",
    expiresAt: daysAgo(-14),
  },
  {
    id: "drop_dstv_xtraview",
    name: "Showmax — 14 day pass",
    kind: "merch-voucher",
    cost: 1_800,
    stock: 60,
    imageUrl: productPhoto("merch_showmax"),
    partner: "Showmax",
    description: "14-day Showmax pass for premium content.",
    category: "Partners",
    rarity: "rare",
    expiresAt: daysAgo(-30),
  },
  {
    id: "drop_ff_emote_dance",
    name: "Free Fire — Signature Dance Emote",
    kind: "cosmetic",
    cost: 700,
    stock: 220,
    imageUrl: clipThumb("drop_ff_emote_dance"),
    partner: "Garena",
    description: "Show off the EVO TV signature dance.",
    category: "Free Fire",
    rarity: "common",
    expiresAt: null,
  },
  {
    id: "drop_codm_camo",
    name: "CoD Mobile — Sunset Camo",
    kind: "cosmetic",
    cost: 1_400,
    stock: 75,
    imageUrl: clipThumb("drop_codm_camo"),
    partner: "Activision",
    description: "Apply the Sunset camo to all your loadouts.",
    category: "CoD Mobile",
    rarity: "rare",
    expiresAt: daysAgo(-21),
  },
];

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
function ensureUserSeed(state: PersistedState, userId: string) {
  if (state.coins[userId] === undefined) state.coins[userId] = DEFAULT_COINS;
  if (state.xp[userId] === undefined) state.xp[userId] = DEFAULT_XP;
  if (state.events.length === 0) state.events = seededXpEvents(userId);
  // ensure quest progress entries exist
  for (const q of QUEST_TEMPLATES) {
    const key = `${userId}:${q.id}`;
    if (!state.questProgress[key]) {
      state.questProgress[key] = {
        progress: SEED_PROGRESS[q.id] ?? 0,
        claimed: false,
      };
    }
  }
}

function rarityCode(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(
      Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()
        .padStart(4, "0"),
    );
  }
  return segments.join("-");
}

// Pre-seed redemptions so /rewards/history is never empty on first load.
function defaultRedemptions(userId: string): Redemption[] {
  return [
    {
      id: "redemption_seed_1",
      userId,
      dropId: "drop_premium_1d",
      dropName: "EVO Premium — 24h pass",
      dropKind: "premium-trial",
      partner: "EVO TV",
      imageUrl: vodPoster("drop_premium_1d"),
      code: "EVO-24H-2J9K-PLM4",
      cost: 300,
      redeemedAt: daysAgo(2),
      status: "delivered",
    },
    {
      id: "redemption_seed_2",
      userId,
      dropId: "drop_eafc_kit",
      dropName: "EA FC — EVO TV Custom Kit",
      dropKind: "cosmetic",
      partner: "EA Sports",
      imageUrl: clipThumb("drop_eafc_kit"),
      code: "EAFC-EVO-V1NT-2026",
      cost: 800,
      redeemedAt: daysAgo(7),
      status: "delivered",
    },
    {
      id: "redemption_seed_3",
      userId,
      dropId: "drop_merch_sticker",
      dropName: "EVO TV Sticker Pack",
      dropKind: "merch-voucher",
      partner: "EVO Shop",
      imageUrl: productPhoto("merch_sticker"),
      code: "STK-EVO-9988-AABB",
      cost: 250,
      redeemedAt: daysAgo(11),
      status: "pending",
    },
  ];
}

// -------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------
export async function getXpAndTier(userId: string): Promise<XpTierInfo> {
  await sleep(80);
  const state = loadState();
  ensureUserSeed(state, userId);
  saveState(state);
  const xp = state.xp[userId] ?? DEFAULT_XP;
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
    coinsBalance: state.coins[userId] ?? DEFAULT_COINS,
  };
}

export async function listDailyQuests(userId: string): Promise<DailyQuest[]> {
  await sleep(80);
  const state = loadState();
  ensureUserSeed(state, userId);
  saveState(state);
  return QUEST_TEMPLATES.map((tpl) => {
    const key = `${userId}:${tpl.id}`;
    const p = state.questProgress[key]!;
    return {
      ...tpl,
      progress: p.progress,
      claimed: p.claimed,
    };
  });
}

export async function claimQuest(
  questId: string,
  userId: string,
): Promise<{ success: boolean; rewardCoins: number; rewardXp: number; reason?: string }> {
  await sleep(150);
  const state = loadState();
  ensureUserSeed(state, userId);
  const tpl = QUEST_TEMPLATES.find((q) => q.id === questId);
  if (!tpl) return { success: false, rewardCoins: 0, rewardXp: 0, reason: "Unknown quest" };
  const key = `${userId}:${questId}`;
  const p = state.questProgress[key]!;
  if (p.claimed) return { success: false, rewardCoins: 0, rewardXp: 0, reason: "Already claimed" };
  if (p.progress < tpl.target)
    return { success: false, rewardCoins: 0, rewardXp: 0, reason: "Quest not complete" };
  p.claimed = true;
  state.coins[userId] = (state.coins[userId] ?? DEFAULT_COINS) + tpl.rewardCoins;
  state.xp[userId] = (state.xp[userId] ?? DEFAULT_XP) + tpl.rewardXp;
  state.events.unshift({
    id: `xp_quest_${Date.now()}`,
    userId,
    source: "quest_complete",
    points: tpl.rewardXp,
    at: new Date().toISOString(),
  });
  saveState(state);
  return { success: true, rewardCoins: tpl.rewardCoins, rewardXp: tpl.rewardXp };
}

export async function listDrops(filter?: { kind?: DropKind; category?: string }): Promise<Drop[]> {
  await sleep(120);
  const state = loadState();
  let result = DROPS.map((d) => ({
    ...d,
    stock: state.dropStock[d.id] ?? d.stock,
  }));
  if (filter?.kind) result = result.filter((d) => d.kind === filter.kind);
  if (filter?.category) result = result.filter((d) => d.category === filter.category);
  return result;
}

export async function getDropById(dropId: string): Promise<Drop | null> {
  await sleep(60);
  const state = loadState();
  const drop = DROPS.find((d) => d.id === dropId);
  if (!drop) return null;
  return { ...drop, stock: state.dropStock[drop.id] ?? drop.stock };
}

export async function redeemDrop(
  dropId: string,
  userId: string,
): Promise<{ success: boolean; redemption?: Redemption; reason?: string }> {
  await sleep(220);
  const drop = DROPS.find((d) => d.id === dropId);
  if (!drop) return { success: false, reason: "Drop not found" };
  const state = loadState();
  ensureUserSeed(state, userId);
  const stock = state.dropStock[dropId] ?? drop.stock;
  if (stock <= 0) return { success: false, reason: "Out of stock" };
  const balance = state.coins[userId] ?? DEFAULT_COINS;
  if (balance < drop.cost) return { success: false, reason: "Not enough EVO Coins" };

  state.coins[userId] = balance - drop.cost;
  state.dropStock[dropId] = stock - 1;

  const redemption: Redemption = {
    id: `redemption_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId,
    dropId: drop.id,
    dropName: drop.name,
    dropKind: drop.kind,
    partner: drop.partner,
    imageUrl: drop.imageUrl,
    code: rarityCode(),
    cost: drop.cost,
    redeemedAt: new Date().toISOString(),
    status: drop.kind === "merch-voucher" ? "pending" : "delivered",
  };

  state.redemptions.unshift(redemption);
  saveState(state);
  return { success: true, redemption };
}

export async function listMyRedemptions(userId: string): Promise<Redemption[]> {
  await sleep(80);
  const state = loadState();
  if (state.redemptions.length === 0) {
    state.redemptions = defaultRedemptions(userId);
    saveState(state);
  }
  return state.redemptions
    .filter((r) => r.userId === userId)
    .slice()
    .sort((a, b) => +new Date(b.redeemedAt) - +new Date(a.redeemedAt));
}

export async function listRecentXpEvents(userId: string, limit = 12): Promise<XpEvent[]> {
  await sleep(60);
  const state = loadState();
  ensureUserSeed(state, userId);
  saveState(state);
  return state.events
    .filter((e) => e.userId === userId)
    .slice(0, limit);
}

export const TIER_LIST = TIER_ORDER;
export const TIER_THRESHOLDS_MAP = TIER_THRESHOLDS;

// Helpers for UI badges
export function tierColor(t: Tier): string {
  switch (t) {
    case "Bronze":
      return "from-amber-700 to-amber-900";
    case "Silver":
      return "from-neutral-300 to-neutral-500";
    case "Gold":
      return "from-yellow-400 to-amber-600";
    case "Platinum":
      return "from-cyan-300 to-sky-500";
    case "Diamond":
      return "from-fuchsia-400 to-violet-600";
  }
}

export function tierTextColor(t: Tier): string {
  switch (t) {
    case "Bronze":
      return "text-amber-200";
    case "Silver":
      return "text-neutral-100";
    case "Gold":
      return "text-yellow-100";
    case "Platinum":
      return "text-cyan-50";
    case "Diamond":
      return "text-fuchsia-50";
  }
}
