import type { UUID, ISODate } from "@/lib/types";
import { sleep, now } from "./_util";
import { events } from "./events";
import { teams } from "./teams";
import { profiles } from "./users";
import { userAvatar } from "./_media";

const STORAGE_KEY = "evotv_pickem_v1";

export type PickemRound = "quarterfinal" | "semifinal" | "final";

export interface BracketMatch {
  id: string;          // synthetic id, scoped to event
  eventId: UUID;
  round: PickemRound;
  slot: number;        // 0..N within round
  teamAId: UUID | null;
  teamBId: UUID | null;
  // For "completed" mock-truth (used to score user picks)
  truthWinnerId: UUID | null;
  feeds?: { fromMatchA?: string; fromMatchB?: string };
}

export interface BracketPick {
  matchId: string;
  winnerTeamId: UUID;
}

export interface PickemEntry {
  id: UUID;
  eventId: UUID;
  userId: UUID;
  picks: BracketPick[];
  score: number;
  submittedAt: ISODate;
}

export interface PickemLeaderboardEntry {
  rank: number;
  userId: UUID;
  handle: string;
  avatarUrl: string;
  score: number;
  correctPicks: number;
  totalPicks: number;
}

interface PersistedShape {
  entries: PickemEntry[];
  brackets: Record<string, BracketMatch[]>;       // eventId -> bracket
}

function readStore(): PersistedShape {
  if (typeof window === "undefined") return { entries: [], brackets: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: [], brackets: {} };
    return JSON.parse(raw) as PersistedShape;
  } catch {
    return { entries: [], brackets: {} };
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

// Hash function for deterministic bracket-mock generation per event.
function eventHash(eventId: string): number {
  let h = 0;
  for (let i = 0; i < eventId.length; i++) h = (h * 31 + eventId.charCodeAt(i)) >>> 0;
  return h;
}

// Build an 8-team bracket for an event using 8 teams from the global teams list,
// biased toward teams declared on the event when present.
export function buildBracket(eventId: string): BracketMatch[] {
  const ev = events.find((e) => e.id === eventId);
  const eventTeamIds = ev?.teamIds ?? [];
  // Ensure exactly 8 teams: pad with global teams not already included.
  const eventTeams = eventTeamIds
    .map((id) => teams.find((t) => t.id === id))
    .filter((x): x is (typeof teams)[number] => Boolean(x));
  const others = teams.filter((t) => !eventTeamIds.includes(t.id));
  const eight = [...eventTeams, ...others].slice(0, 8);
  // Stable shuffle by event hash
  const h = eventHash(eventId);
  const seeded = eight
    .map((t, i) => ({ t, k: (h + i * 7919) % 9999 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.t);

  // Quarterfinals (4 matches: pairs (0,1) (2,3) (4,5) (6,7))
  const qf: BracketMatch[] = Array.from({ length: 4 }, (_, slot) => {
    const a = seeded[slot * 2]!;
    const b = seeded[slot * 2 + 1]!;
    // mock truth: deterministic by hash & slot
    const truth = ((h >> slot) & 1) === 0 ? a.id : b.id;
    return {
      id: `pk_${eventId}_qf_${slot}`,
      eventId,
      round: "quarterfinal" as const,
      slot,
      teamAId: a.id,
      teamBId: b.id,
      truthWinnerId: truth,
    };
  });

  // Semifinals: winners of QF pairs feed in, but for empty bracket UI we leave teams null
  // and let user picks fill them. The truth winners are based on truth chain.
  const sf: BracketMatch[] = [0, 1].map((slot) => {
    const fromA = qf[slot * 2]!;
    const fromB = qf[slot * 2 + 1]!;
    const truth = ((h >> (slot + 4)) & 1) === 0 ? fromA.truthWinnerId : fromB.truthWinnerId;
    return {
      id: `pk_${eventId}_sf_${slot}`,
      eventId,
      round: "semifinal" as const,
      slot,
      teamAId: null,
      teamBId: null,
      truthWinnerId: truth,
      feeds: { fromMatchA: fromA.id, fromMatchB: fromB.id },
    };
  });

  // Final
  const fromA = sf[0]!;
  const fromB = sf[1]!;
  const truth = ((h >> 8) & 1) === 0 ? fromA.truthWinnerId : fromB.truthWinnerId;
  const final: BracketMatch = {
    id: `pk_${eventId}_f_0`,
    eventId,
    round: "final" as const,
    slot: 0,
    teamAId: null,
    teamBId: null,
    truthWinnerId: truth,
    feeds: { fromMatchA: fromA.id, fromMatchB: fromB.id },
  };

  return [...qf, ...sf, final];
}

export async function getBracketForEvent(eventId: string): Promise<BracketMatch[]> {
  await sleep(80);
  const store = readStore();
  if (!store.brackets[eventId]) {
    store.brackets[eventId] = buildBracket(eventId);
    writeStore(store);
  }
  return store.brackets[eventId]!.map((m) => ({ ...m }));
}

// User's picks fill in the blanks for SF/Final slots based on QF picks etc.
export function deriveBracketWithPicks(
  bracket: BracketMatch[],
  picks: BracketPick[]
): BracketMatch[] {
  const map = new Map(bracket.map((m) => [m.id, { ...m }]));
  const pickMap = new Map(picks.map((p) => [p.matchId, p.winnerTeamId]));
  // QF flows to SF, SF flows to F
  for (const m of map.values()) {
    if (m.round === "semifinal" && m.feeds) {
      m.teamAId = pickMap.get(m.feeds.fromMatchA!) ?? m.teamAId ?? null;
      m.teamBId = pickMap.get(m.feeds.fromMatchB!) ?? m.teamBId ?? null;
    }
  }
  for (const m of map.values()) {
    if (m.round === "final" && m.feeds) {
      m.teamAId = pickMap.get(m.feeds.fromMatchA!) ?? m.teamAId ?? null;
      m.teamBId = pickMap.get(m.feeds.fromMatchB!) ?? m.teamBId ?? null;
    }
  }
  return [...map.values()].sort((a, b) => {
    const order = { quarterfinal: 0, semifinal: 1, final: 2 };
    return order[a.round] - order[b.round] || a.slot - b.slot;
  });
}

function scorePicks(bracket: BracketMatch[], picks: BracketPick[]): { score: number; correct: number } {
  let correct = 0;
  for (const p of picks) {
    const m = bracket.find((x) => x.id === p.matchId);
    if (!m) continue;
    if (m.truthWinnerId && m.truthWinnerId === p.winnerTeamId) correct += 1;
  }
  return { score: correct * 10, correct };
}

export async function submitPickemEntry(
  eventId: string,
  picks: BracketPick[],
  userId: string = "user_current"
): Promise<{ ok: true; entry: PickemEntry } | { ok: false; error: string }> {
  await sleep(220);
  const store = readStore();
  if (!store.brackets[eventId]) store.brackets[eventId] = buildBracket(eventId);
  const bracket = store.brackets[eventId]!;
  const existing = store.entries.find((e) => e.eventId === eventId && e.userId === userId);
  if (existing) return { ok: false, error: "You already submitted a bracket for this event." };

  const totalRequired = bracket.length;
  if (picks.length < totalRequired) {
    return { ok: false, error: `Pick all ${totalRequired} matches before submitting.` };
  }

  const { score } = scorePicks(bracket, picks);
  const entry: PickemEntry = {
    id: `pickem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    eventId,
    userId,
    picks,
    score,
    submittedAt: now(),
  };
  store.entries.push(entry);
  writeStore(store);
  return { ok: true, entry };
}

export async function listMyEntries(userId: string = "user_current"): Promise<PickemEntry[]> {
  await sleep();
  return readStore().entries.filter((e) => e.userId === userId);
}

export async function getEntry(entryId: string): Promise<PickemEntry | null> {
  await sleep(60);
  return readStore().entries.find((e) => e.id === entryId) ?? null;
}

export async function getMyEntryForEvent(
  eventId: string,
  userId: string = "user_current"
): Promise<PickemEntry | null> {
  await sleep(60);
  return readStore().entries.find((e) => e.eventId === eventId && e.userId === userId) ?? null;
}

export async function listEntriesForEvent(eventId: string): Promise<PickemEntry[]> {
  await sleep();
  return readStore().entries.filter((e) => e.eventId === eventId);
}

// Seeded competitor entries so leaderboards aren't empty
function buildSeededLeaderboard(eventId: string): PickemLeaderboardEntry[] {
  const seedNames = [
    "DragonByte", "ZeroCool", "GhostRider", "NightOwl", "Vortex", "Neon", "Phoenix",
    "Reaper", "Shogun", "Titan", "Valk", "Wraith", "Xeno", "Yoru", "Zen", "Apex",
    "Bandit", "Cypher", "Dusk", "Echo", "Flux", "Glacier", "Halcyon", "Igni",
    "Jolt", "Kraken", "Lynx", "Mirage", "Nova", "Onyx", "Pulse", "Quark", "Rune",
    "Storm", "Talon", "Umbra", "Vex", "Wisp", "Xerxes", "Yuki", "Zephyr",
    "ArcAngel", "Bishop", "Chimera", "Drift", "Ember", "Fang", "Glint", "Helix",
    "Inferno", "Juggernaut", "Karma", "Lance",
  ];
  const h = eventHash(eventId);
  return seedNames.map((handle, i) => {
    // Total picks always = 7 in our 8-team bracket
    const total = 7;
    const correct = Math.max(0, Math.min(total, 7 - Math.floor((i + (h % 5)) / 6)));
    return {
      rank: 0,
      userId: `pkuser_${i}`,
      handle,
      avatarUrl: userAvatar(handle),
      correctPicks: correct,
      totalPicks: total,
      score: correct * 10,
    };
  });
}

export async function listLeagueLeaderboardForEvent(eventId: string): Promise<PickemLeaderboardEntry[]> {
  await sleep(120);
  const store = readStore();
  if (!store.brackets[eventId]) store.brackets[eventId] = buildBracket(eventId);
  const bracket = store.brackets[eventId]!;
  const seeds = buildSeededLeaderboard(eventId);

  // Mix in real entries for this event
  const real = store.entries.filter((e) => e.eventId === eventId);
  for (const entry of real) {
    const profile = profiles.find((p) => p.id === entry.userId);
    if (!profile) continue;
    const { correct } = scorePicks(bracket, entry.picks);
    seeds.push({
      rank: 0,
      userId: entry.userId,
      handle: profile.handle,
      avatarUrl: profile.avatarUrl,
      correctPicks: correct,
      totalPicks: bracket.length,
      score: entry.score,
    });
  }

  seeds.sort((a, b) => b.score - a.score || a.handle.localeCompare(b.handle));
  return seeds.map((s, i) => ({ ...s, rank: i + 1 }));
}
