import type { UUID, ISODate } from "@/lib/types";
import { sleep, byId, now } from "./_util";
import { events, matches } from "./events";
import { teams } from "./teams";
import { profiles } from "./users";
import { userAvatar } from "./_media";

const STORAGE_KEY = "evotv_predictions_v1";

export type PredictionStatus = "open" | "won" | "lost";

export interface Prediction {
  id: UUID;
  userId: UUID;
  matchId: UUID;
  teamPickedId: UUID;
  coinsStaked: number;
  status: PredictionStatus;
  payoutCoins: number;
  createdAt: ISODate;
}

export interface LeaderboardEntry {
  rank: number;
  userId: UUID;
  handle: string;
  avatarUrl: string;
  totalWins: number;
  totalCoins: number;
}

export interface CoinBalance {
  userId: UUID;
  coins: number;
  lifetimeWins: number;
  lifetimeStakes: number;
}

export interface PredictionEventSummary {
  eventId: UUID;
  title: string;
  gameId: UUID;
  bannerUrl: string;
  startsAt: ISODate;
  status: "scheduled" | "live";
  predictionCount: number;
  prizePoolCoins: number;
  matchesOpen: number;
}

interface PersistedShape {
  predictions: Prediction[];
  balances: Record<string, CoinBalance>;
  seededLeaderboard: LeaderboardEntry[];
}

const DEFAULT_BALANCE = 1000;

function readStore(): PersistedShape {
  if (typeof window === "undefined") return { predictions: [], balances: {}, seededLeaderboard: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { predictions: [], balances: {}, seededLeaderboard: [] };
    return JSON.parse(raw) as PersistedShape;
  } catch {
    return { predictions: [], balances: {}, seededLeaderboard: [] };
  }
}

function writeStore(s: PersistedShape) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota */
  }
}

// Build a deterministic seed leaderboard of ~60 entries (50+ requirement)
function makeSeedLeaderboard(): LeaderboardEntry[] {
  const seedNames = [
    "evo_fan", "pro_watcher", "DragonByte", "ZeroCool", "GhostRider", "NightOwl", "Vortex",
    "Neon", "Phoenix", "Reaper", "Shogun", "Titan", "Valk", "Wraith", "Xeno", "Yoru",
    "Zen", "Apex", "Bandit", "Cypher", "Dusk", "Echo", "Flux", "Glacier", "Halcyon",
    "Igni", "Jolt", "Kraken", "Lynx", "Mirage", "Nova", "Onyx", "Pulse", "Quark",
    "Rune", "Storm", "Talon", "Umbra", "Vex", "Wisp", "Xerxes", "Yuki", "Zephyr",
    "ArcAngel", "Bishop", "Chimera", "Drift", "Ember", "Fang", "Glint", "Helix",
    "Inferno", "Juggernaut", "Karma", "Lance", "Maverick", "Nexus", "Orion", "Prism",
    "Quasar", "Rogue",
  ];
  return seedNames.map((handle, i) => ({
    rank: i + 1,
    userId: i < 3 ? profiles[i]!.id : `pred_user_${i}`,
    handle,
    avatarUrl: userAvatar(handle),
    totalWins: Math.max(2, 60 - i + Math.floor((i % 7) - 2)),
    totalCoins: Math.max(50, 4800 - i * 70 + (i % 5) * 35),
  }));
}

let _cachedSeed: LeaderboardEntry[] | null = null;
function getSeedLeaderboard(): LeaderboardEntry[] {
  if (_cachedSeed) return _cachedSeed;
  _cachedSeed = makeSeedLeaderboard();
  return _cachedSeed;
}

// Auto-resolve predictions whose matches are live: randomly settle ~40% of "open" picks per call.
function autoResolveLivePredictions(store: PersistedShape) {
  let mutated = false;
  for (const p of store.predictions) {
    if (p.status !== "open") continue;
    const m = matches.find((x) => x.id === p.matchId);
    if (!m) continue;
    if (m.state !== "live" && m.state !== "completed") continue;
    if (Math.random() > 0.4) continue;
    const won = Math.random() > 0.45;
    p.status = won ? "won" : "lost";
    p.payoutCoins = won ? Math.round(p.coinsStaked * 1.85) : 0;
    if (won) {
      const bal = store.balances[p.userId] ?? makeBalance(p.userId);
      bal.coins += p.payoutCoins;
      bal.lifetimeWins += 1;
      store.balances[p.userId] = bal;
    }
    mutated = true;
  }
  if (mutated) writeStore(store);
}

function makeBalance(userId: string): CoinBalance {
  return { userId, coins: DEFAULT_BALANCE, lifetimeWins: 0, lifetimeStakes: 0 };
}

function ensureBalance(store: PersistedShape, userId: string): CoinBalance {
  if (!store.balances[userId]) {
    store.balances[userId] = makeBalance(userId);
  }
  return store.balances[userId]!;
}

// Compute team odds based on team rankings (lower rank = lower odds, e.g. 1.50)
export function getTeamOdds(teamId: string, opponentId: string): number {
  const t = teams.find((x) => x.id === teamId);
  const o = teams.find((x) => x.id === opponentId);
  if (!t || !o) return 2.0;
  const diff = o.ranking - t.ranking;
  // Positive diff = picked team is higher ranked → lower odds
  const base = 2.0 - Math.max(-1, Math.min(1, diff * 0.25));
  return Math.round(base * 100) / 100;
}

export async function listOpenPredictionEvents(): Promise<PredictionEventSummary[]> {
  await sleep();
  const store = readStore();
  autoResolveLivePredictions(store);
  // Events that are live or scheduled and have at least one match
  const eligible = events.filter((e) => e.status === "live" || e.status === "scheduled");
  return eligible
    .map((e) => {
      const eventMatches = matches.filter((m) => m.eventId === e.id);
      const open = eventMatches.filter((m) => m.state !== "completed").length;
      const predictionCount = store.predictions.filter((p) =>
        eventMatches.some((m) => m.id === p.matchId)
      ).length;
      // Pseudo-fixed prize pool tied to the event id hash for stability
      const prizePoolCoins = (e.id.length * 1300 + 4800) % 100000 + 5000;
      return {
        eventId: e.id,
        title: e.title,
        gameId: e.gameId,
        bannerUrl: e.bannerUrl,
        startsAt: e.startsAt,
        status: e.status as "live" | "scheduled",
        predictionCount,
        prizePoolCoins,
        matchesOpen: Math.max(open, eventMatches.length || 1),
      };
    })
    .sort((a, b) => {
      if (a.status === "live" && b.status !== "live") return -1;
      if (b.status === "live" && a.status !== "live") return 1;
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    });
}

export async function submitPrediction(
  matchId: string,
  teamId: string,
  coinsStaked: number,
  userId: string = "user_current"
): Promise<{ ok: true; prediction: Prediction } | { ok: false; error: string }> {
  await sleep(180);
  if (coinsStaked < 50 || coinsStaked > 500) {
    return { ok: false, error: "Stake must be between 50 and 500 coins." };
  }
  const store = readStore();
  const bal = ensureBalance(store, userId);
  if (bal.coins < coinsStaked) {
    return { ok: false, error: "Not enough coins." };
  }
  const match = matches.find((m) => m.id === matchId);
  if (!match) return { ok: false, error: "Match not found." };
  if (match.state === "completed") {
    return { ok: false, error: "This match is already completed." };
  }
  // Block duplicate predictions on the same match by the same user
  const dup = store.predictions.find((p) => p.userId === userId && p.matchId === matchId);
  if (dup) return { ok: false, error: "You have already picked this match." };

  const opponentId = match.teamAId === teamId ? match.teamBId : match.teamAId;
  const odds = getTeamOdds(teamId, opponentId);
  const newPick: Prediction = {
    id: `pred_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    matchId,
    teamPickedId: teamId,
    coinsStaked,
    status: "open",
    payoutCoins: Math.round(coinsStaked * odds),
    createdAt: now(),
  };
  bal.coins -= coinsStaked;
  bal.lifetimeStakes += coinsStaked;
  store.predictions.push(newPick);
  writeStore(store);
  return { ok: true, prediction: newPick };
}

export async function listMyPredictions(userId: string = "user_current"): Promise<Prediction[]> {
  await sleep();
  const store = readStore();
  autoResolveLivePredictions(store);
  return store.predictions
    .filter((p) => p.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function listPredictionsForEvent(eventId: string, userId: string = "user_current"): Promise<Prediction[]> {
  await sleep(80);
  const store = readStore();
  autoResolveLivePredictions(store);
  const eventMatchIds = new Set(matches.filter((m) => m.eventId === eventId).map((m) => m.id));
  return store.predictions.filter((p) => p.userId === userId && eventMatchIds.has(p.matchId));
}

export async function getCoinBalance(userId: string = "user_current"): Promise<CoinBalance> {
  await sleep(50);
  const store = readStore();
  const bal = ensureBalance(store, userId);
  writeStore(store);
  return { ...bal };
}

export async function listLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  await sleep(120);
  const store = readStore();
  autoResolveLivePredictions(store);

  // Merge persisted balances of real users on top of seed
  const seed = getSeedLeaderboard().slice();
  // Inject the current user's totals so they can see themselves climbing
  for (const userId of Object.keys(store.balances)) {
    const bal = store.balances[userId]!;
    const profile = profiles.find((p) => p.id === userId);
    if (!profile) continue;
    const existing = seed.find((e) => e.userId === userId);
    const totalWins = bal.lifetimeWins + (existing?.totalWins ?? 0);
    const totalCoins = bal.coins + (existing?.totalCoins ?? 0);
    if (existing) {
      existing.totalWins = totalWins;
      existing.totalCoins = totalCoins;
      existing.handle = profile.handle;
      existing.avatarUrl = profile.avatarUrl;
    } else {
      seed.push({
        rank: 0,
        userId,
        handle: profile.handle,
        avatarUrl: profile.avatarUrl,
        totalWins,
        totalCoins,
      });
    }
  }

  seed.sort((a, b) => b.totalCoins - a.totalCoins || b.totalWins - a.totalWins);
  return seed.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }));
}

// Re-export team helper for components that need it
export function getTeamById(id: string) {
  return byId(teams, id);
}
