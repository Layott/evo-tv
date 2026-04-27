// Tipping / Cheers mock module.
// Phase F mock — every helper preserves the signature it will keep when swapped to lib/api/tips.

import { sleep, hoursAgo, daysAgo, minutesAgo } from "./_util";

export interface Tip {
  id: string;
  fromUserId: string;
  fromHandle: string;
  fromAvatarUrl: string;
  toStreamerHandle: string;
  toStreamerName: string;
  toStreamerAvatarUrl: string;
  streamId: string | null;
  streamTitle: string | null;
  amountCoins: number;
  message: string;
  atIso: string;
}

export interface TopTipper {
  handle: string;
  displayName: string;
  avatarUrl: string;
  totalCoins: number;
  tipCount: number;
}

const STORAGE_KEY = "evotv_tips_v1";
const REWARDS_KEY = "evotv_rewards_v1"; // shared wallet ledger with rewards module

interface PersistedState {
  tips: Tip[];
  seeded: boolean;
}

const DEFAULT_COINS = 4_280;

function emptyState(): PersistedState {
  return { tips: [], seeded: false };
}

function loadState(): PersistedState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as PersistedState;
    return { tips: parsed.tips ?? [], seeded: !!parsed.seeded };
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

// Shared coin wallet — read/written via the rewards persisted state so tipping
// and the rewards store both see one balance.
interface RewardsWallet {
  coins?: Record<string, number>;
  xp?: Record<string, number>;
  questProgress?: Record<string, { progress: number; claimed: boolean }>;
  redemptions?: unknown[];
  dropStock?: Record<string, number>;
  events?: unknown[];
}

function readWallet(userId: string): { state: RewardsWallet; coins: number } {
  if (typeof window === "undefined") return { state: {}, coins: DEFAULT_COINS };
  try {
    const raw = window.localStorage.getItem(REWARDS_KEY);
    const state = (raw ? JSON.parse(raw) : {}) as RewardsWallet;
    const coins = state.coins?.[userId] ?? DEFAULT_COINS;
    return { state, coins };
  } catch {
    return { state: {}, coins: DEFAULT_COINS };
  }
}

function writeWallet(state: RewardsWallet, userId: string, coins: number) {
  if (typeof window === "undefined") return;
  try {
    state.coins = state.coins ?? {};
    state.coins[userId] = coins;
    window.localStorage.setItem(REWARDS_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

// -------------------------------------------------------------------
// Seed data
// -------------------------------------------------------------------
const STREAMERS: Array<{ handle: string; name: string; avatar: string }> = [
  {
    handle: "evo_tv_official",
    name: "EVO TV Official",
    avatar: "/evo-logo/evo-tv-152.png",
  },
  {
    handle: "evo_tv_channel",
    name: "EVO TV Channel",
    avatar: "/evo-logo/evo-tv-152.png",
  },
  {
    handle: "film_room",
    name: "Film Room",
    avatar: "/interview-panel.png",
  },
  {
    handle: "evo_talk",
    name: "Evo Talk",
    avatar: "/interview-panel.png",
  },
  {
    handle: "lagos_streamer",
    name: "Lagos Streamer",
    avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=lagos_streamer&radius=50`,
  },
  {
    handle: "casablanca_caster",
    name: "Casablanca Caster",
    avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=casablanca_caster&radius=50`,
  },
  {
    handle: "cairo_pro",
    name: "Cairo Pro",
    avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=cairo_pro&radius=50`,
  },
  {
    handle: "accra_anchor",
    name: "Accra Anchor",
    avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=accra_anchor&radius=50`,
  },
  {
    handle: "naija_clutch",
    name: "Naija Clutch",
    avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=naija_clutch&radius=50`,
  },
  {
    handle: "kenya_kid",
    name: "Kenya Kid",
    avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=kenya_kid&radius=50`,
  },
];

const TIPPERS: Array<{ userId: string; handle: string; avatar: string }> = [
  { userId: "user_current", handle: "evo_fan", avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=evo_fan&radius=50` },
  { userId: "user_premium", handle: "pro_watcher", avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=pro_watcher&radius=50` },
  { userId: "user_admin", handle: "evo_admin", avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=evo_admin&radius=50` },
  { userId: "user_t_1", handle: "moneybag_zee", avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=moneybag_zee&radius=50` },
  { userId: "user_t_2", handle: "ade_alpha", avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=ade_alpha&radius=50` },
  { userId: "user_t_3", handle: "tunde_t", avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=tunde_t&radius=50` },
  { userId: "user_t_4", handle: "sapphire_x", avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=sapphire_x&radius=50` },
  { userId: "user_t_5", handle: "kelechi_k", avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=kelechi_k&radius=50` },
  { userId: "user_t_6", handle: "phoenix_blast", avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=phoenix_blast&radius=50` },
  { userId: "user_t_7", handle: "amara_ace", avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=amara_ace&radius=50` },
  { userId: "user_t_8", handle: "gamer_obi", avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=gamer_obi&radius=50` },
  { userId: "user_t_9", handle: "nairalord", avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=nairalord&radius=50` },
];

const SAMPLE_MESSAGES = [
  "GG! Massive clutch!",
  "Keep grinding fam",
  "Best caster on the continent",
  "Up the team!",
  "First tip ever 🔥",
  "Africa to the world!",
  "",
  "Insane shot",
  "More content like this please",
  "10/10 stream",
  "",
  "Nigeria watching live!",
  "Ke najia rep!",
  "Ride on champ",
  "More tips coming",
];

const AMOUNTS = [50, 100, 200, 500, 1000, 50, 100, 200, 250, 500, 750, 50];

function buildSeedTips(): Tip[] {
  const tips: Tip[] = [];
  let id = 1;
  for (let i = 0; i < 38; i++) {
    const streamer = STREAMERS[i % STREAMERS.length]!;
    const tipper = TIPPERS[i % TIPPERS.length]!;
    const amount = AMOUNTS[i % AMOUNTS.length]!;
    const msg = SAMPLE_MESSAGES[i % SAMPLE_MESSAGES.length]!;
    tips.push({
      id: `tip_seed_${id++}`,
      fromUserId: tipper.userId,
      fromHandle: tipper.handle,
      fromAvatarUrl: tipper.avatar,
      toStreamerHandle: streamer.handle,
      toStreamerName: streamer.name,
      toStreamerAvatarUrl: streamer.avatar,
      streamId: i % 3 === 0 ? "stream_lagos_final" : i % 3 === 1 ? "channel_main" : "stream_codm_scrim",
      streamTitle:
        i % 3 === 0
          ? "EVO Lagos Invitational — Semifinal 1 LIVE"
          : i % 3 === 1
            ? "EVO TV Channel — 24/7 Esports"
            : "CoD Mobile Scrim Night — Titan vs Rogue",
      amountCoins: amount,
      message: msg,
      atIso:
        i < 4
          ? minutesAgo((i + 1) * 11)
          : i < 12
            ? hoursAgo(i + 1)
            : daysAgo(Math.floor((i - 8) / 2)),
    });
  }
  return tips;
}

function ensureSeed(state: PersistedState) {
  if (!state.seeded) {
    state.tips = buildSeedTips();
    state.seeded = true;
  }
}

// -------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------
export async function sendTip(
  streamerHandle: string,
  streamId: string | null,
  amountCoins: number,
  message: string,
  options?: {
    fromUserId?: string;
    fromHandle?: string;
    fromAvatarUrl?: string;
    toStreamerName?: string;
    toStreamerAvatarUrl?: string;
    streamTitle?: string | null;
  },
): Promise<{ success: boolean; tip?: Tip; reason?: string; balance?: number }> {
  await sleep(220);
  if (!streamerHandle) return { success: false, reason: "Missing streamer" };
  if (!Number.isFinite(amountCoins) || amountCoins <= 0)
    return { success: false, reason: "Invalid amount" };
  const state = loadState();
  ensureSeed(state);
  const fromUserId = options?.fromUserId ?? "user_current";
  const wallet = readWallet(fromUserId);
  const balance = wallet.coins;
  if (balance < amountCoins) return { success: false, reason: "Insufficient EVO Coins", balance };

  writeWallet(wallet.state, fromUserId, balance - amountCoins);

  const inferredStreamer = STREAMERS.find((s) => s.handle === streamerHandle);

  const tip: Tip = {
    id: `tip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    fromUserId,
    fromHandle: options?.fromHandle ?? "evo_fan",
    fromAvatarUrl: options?.fromAvatarUrl ?? `https://api.dicebear.com/9.x/avataaars/svg?seed=evo_fan&radius=50`,
    toStreamerHandle: streamerHandle,
    toStreamerName: options?.toStreamerName ?? inferredStreamer?.name ?? streamerHandle,
    toStreamerAvatarUrl:
      options?.toStreamerAvatarUrl ??
      inferredStreamer?.avatar ??
      `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(streamerHandle)}&radius=50`,
    streamId: streamId ?? null,
    streamTitle: options?.streamTitle ?? null,
    amountCoins,
    message: (message ?? "").slice(0, 80),
    atIso: new Date().toISOString(),
  };

  state.tips.unshift(tip);
  saveState(state);
  return { success: true, tip, balance: balance - amountCoins };
}

export async function listSentTips(userId: string): Promise<Tip[]> {
  await sleep(100);
  const state = loadState();
  ensureSeed(state);
  saveState(state);
  return state.tips.filter((t) => t.fromUserId === userId);
}

export async function listReceivedTips(streamerHandle: string): Promise<Tip[]> {
  await sleep(100);
  const state = loadState();
  ensureSeed(state);
  saveState(state);
  return state.tips.filter((t) => t.toStreamerHandle === streamerHandle);
}

export async function listAllReceivedForCurrentCreator(): Promise<Tip[]> {
  // Mock: when current user is admin/premium acting as a creator, surface tips
  // sent to a representative streamer handle so the page is never empty.
  await sleep(80);
  const state = loadState();
  ensureSeed(state);
  saveState(state);
  return state.tips.filter(
    (t) =>
      t.toStreamerHandle === "evo_tv_official" ||
      t.toStreamerHandle === "evo_tv_channel" ||
      t.toStreamerHandle === "film_room",
  );
}

export async function topTippers(limit = 10): Promise<TopTipper[]> {
  await sleep(120);
  const state = loadState();
  ensureSeed(state);
  saveState(state);
  // Last 30 days
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const totals = new Map<string, TopTipper>();
  for (const tip of state.tips) {
    if (+new Date(tip.atIso) < cutoff) continue;
    const t = totals.get(tip.fromHandle) ?? {
      handle: tip.fromHandle,
      displayName: tip.fromHandle.replace(/_/g, " "),
      avatarUrl: tip.fromAvatarUrl,
      totalCoins: 0,
      tipCount: 0,
    };
    t.totalCoins += tip.amountCoins;
    t.tipCount += 1;
    totals.set(tip.fromHandle, t);
  }
  return Array.from(totals.values())
    .sort((a, b) => b.totalCoins - a.totalCoins)
    .slice(0, limit);
}

export async function getCoinBalance(userId: string): Promise<number> {
  await sleep(40);
  return readWallet(userId).coins;
}

export const SAMPLE_STREAMERS = STREAMERS;
