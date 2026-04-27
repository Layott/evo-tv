import type { UUID, ISODate, Player } from "@/lib/types";
import { sleep, now, daysAhead, daysAgo } from "./_util";
import { players } from "./players";
import { profiles } from "./users";
import { userAvatar } from "./_media";

const STORAGE_KEY = "evotv_fantasy_v1";

export type FantasyStatus = "active" | "drafting" | "completed";
export type ScoringSystem = "kills" | "kda" | "objectives";

export interface FantasyLeague {
  id: UUID;
  name: string;
  description: string;
  gameId: UUID;
  ownerId: UUID;
  members: UUID[];
  maxMembers: number;
  salaryCap: number;
  prizePool: number;
  entryFee: number;
  scoringSystem: ScoringSystem;
  status: FantasyStatus;
  endsAt: ISODate;
  createdAt: ISODate;
  bannerSeed: string;
}

export interface PlayerSelection {
  playerId: UUID;
  cost: number;
  pointsScored: number;
}

export interface FantasyLineup {
  id: UUID;
  leagueId: UUID;
  userId: UUID;
  players: PlayerSelection[];
  totalCost: number;
  totalPoints: number;
  submittedAt: ISODate;
}

export interface FantasyLeaderboardEntry {
  rank: number;
  userId: UUID;
  handle: string;
  avatarUrl: string;
  totalPoints: number;
  lineupCount: number;
}

export interface FantasyActivityItem {
  id: UUID;
  leagueId: UUID;
  kind: "join" | "lineup" | "score";
  message: string;
  createdAt: ISODate;
}

interface PersistedShape {
  leagues: FantasyLeague[];
  lineups: FantasyLineup[];
  activity: FantasyActivityItem[];
}

const SCORING_LABELS: Record<ScoringSystem, string> = {
  kills: "Kills-based",
  kda: "KDA + assists",
  objectives: "Objectives + plays",
};

export function scoringLabel(s: ScoringSystem): string {
  return SCORING_LABELS[s];
}

// Return the cost (in EVO Coins) for a player. Higher KDA & followers = pricier.
export function playerCost(p: Player): number {
  const kdaPart = Math.round(p.kda * 1500);
  const followersPart = Math.round(p.followers / 100);
  return Math.max(800, Math.min(8000, kdaPart + followersPart));
}

// Synthetic per-player point total for finished leagues, based on KDA + a deterministic spice
function playerPoints(p: Player, salt = 0): number {
  let h = 0;
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) >>> 0;
  return Math.max(0, Math.round(p.kda * 30 + ((h + salt) % 60)));
}

const DEFAULT_USER_ID = "user_current";

function makeSeedLeagues(): FantasyLeague[] {
  const baseSeed: Array<Omit<FantasyLeague, "members" | "createdAt"> & { membersCount: number; createdDaysAgo: number }> = [
    {
      id: "fl_seed_1",
      name: "EVO Continental Premier",
      description: "Africa-wide premier fantasy league. Big payouts, big names.",
      gameId: "game_freefire",
      ownerId: "user_admin",
      maxMembers: 100,
      salaryCap: 30000,
      prizePool: 250000,
      entryFee: 1000,
      scoringSystem: "kda",
      status: "active",
      endsAt: daysAhead(14),
      bannerSeed: "fl_seed_1",
      membersCount: 64,
      createdDaysAgo: 9,
    },
    {
      id: "fl_seed_2",
      name: "Lagos Free Fire Friday",
      description: "Casual weekly Free Fire fantasy with the Lagos crew.",
      gameId: "game_freefire",
      ownerId: "user_premium",
      maxMembers: 24,
      salaryCap: 25000,
      prizePool: 18000,
      entryFee: 200,
      scoringSystem: "kills",
      status: "active",
      endsAt: daysAhead(3),
      bannerSeed: "fl_seed_2",
      membersCount: 18,
      createdDaysAgo: 4,
    },
    {
      id: "fl_seed_3",
      name: "CoD Mobile Pro Circuit",
      description: "Top tier CoDM fantasy mirroring the Pro Circuit standings.",
      gameId: "game_codm",
      ownerId: "user_admin",
      maxMembers: 50,
      salaryCap: 28000,
      prizePool: 75000,
      entryFee: 500,
      scoringSystem: "objectives",
      status: "active",
      endsAt: daysAhead(20),
      bannerSeed: "fl_seed_3",
      membersCount: 27,
      createdDaysAgo: 12,
    },
    {
      id: "fl_seed_4",
      name: "PUBG Mobile Cairo Cup",
      description: "Mirror league for the PUBGM Cairo Cup. Bracket-aligned.",
      gameId: "game_pubgm",
      ownerId: "user_admin",
      maxMembers: 32,
      salaryCap: 26000,
      prizePool: 30000,
      entryFee: 300,
      scoringSystem: "kda",
      status: "drafting",
      endsAt: daysAhead(10),
      bannerSeed: "fl_seed_4",
      membersCount: 12,
      createdDaysAgo: 2,
    },
    {
      id: "fl_seed_5",
      name: "EA FC Friendlies",
      description: "Casual fantasy for EA FC Mobile fans across the continent.",
      gameId: "game_eafc",
      ownerId: "user_premium",
      maxMembers: 20,
      salaryCap: 22000,
      prizePool: 6000,
      entryFee: 100,
      scoringSystem: "kills",
      status: "active",
      endsAt: daysAhead(7),
      bannerSeed: "fl_seed_5",
      membersCount: 9,
      createdDaysAgo: 6,
    },
    {
      id: "fl_seed_6",
      name: "Accra All-Stars",
      description: "Ghana-only Free Fire fantasy. Accra pride on the line.",
      gameId: "game_freefire",
      ownerId: "user_premium",
      maxMembers: 16,
      salaryCap: 24000,
      prizePool: 8000,
      entryFee: 150,
      scoringSystem: "kills",
      status: "active",
      endsAt: daysAhead(5),
      bannerSeed: "fl_seed_6",
      membersCount: 11,
      createdDaysAgo: 3,
    },
    {
      id: "fl_seed_7",
      name: "Battle Royale Champions",
      description: "Cross-game BR fantasy spanning Free Fire & PUBG Mobile.",
      gameId: "game_pubgm",
      ownerId: "user_admin",
      maxMembers: 80,
      salaryCap: 32000,
      prizePool: 120000,
      entryFee: 800,
      scoringSystem: "kda",
      status: "active",
      endsAt: daysAhead(30),
      bannerSeed: "fl_seed_7",
      membersCount: 41,
      createdDaysAgo: 18,
    },
    {
      id: "fl_seed_8",
      name: "Rookie Cup",
      description: "First-time fantasy players welcome. Beginner-friendly cap.",
      gameId: "game_freefire",
      ownerId: "user_admin",
      maxMembers: 50,
      salaryCap: 18000,
      prizePool: 4000,
      entryFee: 50,
      scoringSystem: "kills",
      status: "active",
      endsAt: daysAhead(11),
      bannerSeed: "fl_seed_8",
      membersCount: 22,
      createdDaysAgo: 1,
    },
    {
      id: "fl_seed_9",
      name: "Last Cycle Champions",
      description: "Season 1 fantasy concluded. Hall of fame view only.",
      gameId: "game_freefire",
      ownerId: "user_admin",
      maxMembers: 60,
      salaryCap: 25000,
      prizePool: 80000,
      entryFee: 400,
      scoringSystem: "kda",
      status: "completed",
      endsAt: daysAgo(7),
      bannerSeed: "fl_seed_9",
      membersCount: 44,
      createdDaysAgo: 60,
    },
  ];

  // Build random member pools per league
  const filler = profiles.slice(3); // viewers
  return baseSeed.map((s) => {
    const members = [s.ownerId];
    const pool = filler.map((p) => p.id);
    while (members.length < Math.min(s.membersCount, s.maxMembers) && pool.length) {
      const idx = (s.id.length + members.length) % pool.length;
      members.push(pool.splice(idx, 1)[0]!);
    }
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      gameId: s.gameId,
      ownerId: s.ownerId,
      members,
      maxMembers: s.maxMembers,
      salaryCap: s.salaryCap,
      prizePool: s.prizePool,
      entryFee: s.entryFee,
      scoringSystem: s.scoringSystem,
      status: s.status,
      endsAt: s.endsAt,
      createdAt: daysAgo(s.createdDaysAgo),
      bannerSeed: s.bannerSeed,
    };
  });
}

function makeSeedActivity(leagues: FantasyLeague[]): FantasyActivityItem[] {
  const items: FantasyActivityItem[] = [];
  let counter = 0;
  for (const lg of leagues) {
    const handles = ["DragonByte", "Phoenix", "GhostRider", "Vortex", "Neon", "Reaper"];
    for (let i = 0; i < 5; i++) {
      const handle = handles[(counter + i) % handles.length]!;
      const k = (counter + i) % 3;
      const message =
        k === 0
          ? `${handle} joined ${lg.name}`
          : k === 1
            ? `${handle} updated their lineup`
            : `${handle} scored ${380 + ((counter + i) * 17) % 200} points`;
      items.push({
        id: `act_${lg.id}_${i}`,
        leagueId: lg.id,
        kind: k === 0 ? "join" : k === 1 ? "lineup" : "score",
        message,
        createdAt: new Date(Date.now() - (counter + i) * 1000 * 60 * 47).toISOString(),
      });
      counter += 1;
    }
  }
  return items;
}

function readStore(): PersistedShape {
  if (typeof window === "undefined") {
    const seedLeagues = makeSeedLeagues();
    return { leagues: seedLeagues, lineups: [], activity: makeSeedActivity(seedLeagues) };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seedLeagues = makeSeedLeagues();
      const initial: PersistedShape = {
        leagues: seedLeagues,
        lineups: [],
        activity: makeSeedActivity(seedLeagues),
      };
      writeStore(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as PersistedShape;
    return parsed;
  } catch {
    const seedLeagues = makeSeedLeagues();
    return { leagues: seedLeagues, lineups: [], activity: makeSeedActivity(seedLeagues) };
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

export async function listLeagues(filter?: { ownerId?: string; memberId?: string; status?: FantasyStatus }): Promise<FantasyLeague[]> {
  await sleep();
  const store = readStore();
  let result = store.leagues;
  if (filter?.ownerId) result = result.filter((l) => l.ownerId === filter.ownerId);
  if (filter?.memberId) result = result.filter((l) => l.members.includes(filter.memberId!));
  if (filter?.status) result = result.filter((l) => l.status === filter.status);
  return result;
}

export async function getLeagueById(id: string): Promise<FantasyLeague | null> {
  await sleep(60);
  return readStore().leagues.find((l) => l.id === id) ?? null;
}

export async function createLeague(payload: {
  name: string;
  description?: string;
  gameId: string;
  maxMembers: number;
  entryFee: number;
  salaryCap: number;
  scoringSystem: ScoringSystem;
  endsAt: string;
  ownerId?: string;
}): Promise<FantasyLeague> {
  await sleep(220);
  const store = readStore();
  const ownerId = payload.ownerId ?? DEFAULT_USER_ID;
  const lg: FantasyLeague = {
    id: `fl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: payload.name.trim(),
    description: payload.description?.trim() ?? "",
    gameId: payload.gameId,
    ownerId,
    members: [ownerId],
    maxMembers: payload.maxMembers,
    salaryCap: payload.salaryCap,
    prizePool: payload.entryFee * payload.maxMembers,
    entryFee: payload.entryFee,
    scoringSystem: payload.scoringSystem,
    status: "active",
    endsAt: payload.endsAt,
    createdAt: now(),
    bannerSeed: payload.name,
  };
  store.leagues.unshift(lg);
  store.activity.unshift({
    id: `act_${lg.id}_create`,
    leagueId: lg.id,
    kind: "join",
    message: `League "${lg.name}" created`,
    createdAt: now(),
  });
  writeStore(store);
  return lg;
}

export async function joinLeague(leagueId: string, userId: string = DEFAULT_USER_ID): Promise<{ ok: true } | { ok: false; error: string }> {
  await sleep(150);
  const store = readStore();
  const league = store.leagues.find((l) => l.id === leagueId);
  if (!league) return { ok: false, error: "League not found." };
  if (league.members.includes(userId)) return { ok: false, error: "Already a member." };
  if (league.members.length >= league.maxMembers) return { ok: false, error: "League is full." };
  league.members.push(userId);
  store.activity.unshift({
    id: `act_${leagueId}_join_${userId}_${Date.now()}`,
    leagueId,
    kind: "join",
    message: `Joined "${league.name}"`,
    createdAt: now(),
  });
  writeStore(store);
  return { ok: true };
}

export async function submitLineup(
  leagueId: string,
  playerIds: string[],
  userId: string = DEFAULT_USER_ID
): Promise<{ ok: true; lineup: FantasyLineup } | { ok: false; error: string }> {
  await sleep(220);
  const store = readStore();
  const league = store.leagues.find((l) => l.id === leagueId);
  if (!league) return { ok: false, error: "League not found." };
  if (playerIds.length !== 5) return { ok: false, error: "Pick exactly 5 players." };
  const seen = new Set(playerIds);
  if (seen.size !== 5) return { ok: false, error: "Duplicate players in lineup." };

  const selections: PlayerSelection[] = [];
  let totalCost = 0;
  for (const id of playerIds) {
    const p = players.find((x) => x.id === id);
    if (!p) return { ok: false, error: "One or more players not found." };
    if (p.gameId !== league.gameId) return { ok: false, error: "Player game mismatch." };
    const cost = playerCost(p);
    totalCost += cost;
    selections.push({ playerId: p.id, cost, pointsScored: playerPoints(p, eventLikeSalt(league.id)) });
  }
  if (totalCost > league.salaryCap) {
    return { ok: false, error: `Lineup over salary cap by ${(totalCost - league.salaryCap).toLocaleString()} coins.` };
  }
  const totalPoints = selections.reduce((sum, s) => sum + s.pointsScored, 0);

  const existingIdx = store.lineups.findIndex((l) => l.leagueId === leagueId && l.userId === userId);
  const lineup: FantasyLineup = {
    id: existingIdx >= 0 ? store.lineups[existingIdx]!.id : `fll_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    leagueId,
    userId,
    players: selections,
    totalCost,
    totalPoints,
    submittedAt: now(),
  };
  if (existingIdx >= 0) {
    store.lineups[existingIdx] = lineup;
  } else {
    store.lineups.push(lineup);
    if (!league.members.includes(userId)) league.members.push(userId);
  }
  store.activity.unshift({
    id: `act_${leagueId}_lineup_${Date.now()}`,
    leagueId,
    kind: "lineup",
    message: `Submitted a ${totalPoints}-point lineup`,
    createdAt: now(),
  });
  writeStore(store);
  return { ok: true, lineup };
}

function eventLikeSalt(leagueId: string) {
  let h = 0;
  for (let i = 0; i < leagueId.length; i++) h = (h * 31 + leagueId.charCodeAt(i)) >>> 0;
  return h;
}

export async function getLineup(leagueId: string, userId: string = DEFAULT_USER_ID): Promise<FantasyLineup | null> {
  await sleep(80);
  return readStore().lineups.find((l) => l.leagueId === leagueId && l.userId === userId) ?? null;
}

export async function listLeagueLeaderboard(leagueId: string): Promise<FantasyLeaderboardEntry[]> {
  await sleep(140);
  const store = readStore();
  const league = store.leagues.find((l) => l.id === leagueId);
  if (!league) return [];
  const seedHandles = [
    "DragonByte", "Phoenix", "GhostRider", "Vortex", "Neon", "Reaper", "ArcAngel",
    "Bishop", "Chimera", "Drift", "Ember", "Fang", "Glint", "Helix", "Inferno",
    "Juggernaut", "Karma", "Lance", "Maverick", "Nexus", "Orion", "Prism", "Quasar",
    "Rogue", "Storm", "Talon", "Umbra", "Vex", "Wisp", "Xerxes", "Yuki", "Zephyr",
    "ApexEra", "Brisk", "Crater", "Dune", "Edge", "Frost", "Glory", "Hex", "Iris",
    "Jade", "Knight", "Loom", "Mist", "Nimbus", "Orbit", "Plume", "Quill",
  ];
  const seedEntries: FantasyLeaderboardEntry[] = seedHandles.map((handle, i) => ({
    rank: 0,
    userId: `flu_${i}`,
    handle,
    avatarUrl: userAvatar(handle),
    totalPoints: Math.max(80, 1100 - i * 18 + ((eventLikeSalt(leagueId) + i * 13) % 70)),
    lineupCount: 1,
  }));

  const realLineups = store.lineups.filter((l) => l.leagueId === leagueId);
  for (const ln of realLineups) {
    const profile = profiles.find((p) => p.id === ln.userId);
    if (!profile) continue;
    seedEntries.push({
      rank: 0,
      userId: ln.userId,
      handle: profile.handle,
      avatarUrl: profile.avatarUrl,
      totalPoints: ln.totalPoints,
      lineupCount: 1,
    });
  }

  // Sort & rank
  seedEntries.sort((a, b) => b.totalPoints - a.totalPoints);
  return seedEntries.map((e, i) => ({ ...e, rank: i + 1 }));
}

export async function listActivityForLeague(leagueId: string, limit = 8): Promise<FantasyActivityItem[]> {
  await sleep(60);
  return readStore()
    .activity.filter((a) => a.leagueId === leagueId)
    .slice(0, limit);
}

export async function listAvailablePlayers(gameId: string): Promise<Player[]> {
  await sleep();
  return players.filter((p) => p.gameId === gameId);
}
