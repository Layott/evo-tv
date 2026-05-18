import "server-only";
import crypto from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type FantasyStatus = "drafting" | "active" | "completed";
export type ScoringSystem = "kills" | "kda" | "objectives";

export interface FantasyLeagueRow {
  id: string;
  name: string;
  description: string;
  gameId: string;
  ownerId: string;
  members: string[];
  maxMembers: number;
  salaryCap: number;
  prizePool: number;
  entryFee: number;
  scoringSystem: ScoringSystem;
  status: FantasyStatus;
  endsAt: string;
  bannerSeed: string;
  createdAt: string;
}

export interface FantasyLeaderboardRow {
  rank: number;
  userId: string;
  handle: string;
  avatarUrl: string;
  totalPoints: number;
  lineupCount: number;
}

async function membersFor(leagueIds: string[]): Promise<Map<string, string[]>> {
  if (leagueIds.length === 0) return new Map();
  const rows = await db
    .select({
      leagueId: schema.fantasyLeagueMembers.leagueId,
      userId: schema.fantasyLeagueMembers.userId,
    })
    .from(schema.fantasyLeagueMembers);
  const map = new Map<string, string[]>();
  for (const r of rows) {
    if (!leagueIds.includes(r.leagueId)) continue;
    const arr = map.get(r.leagueId) ?? [];
    arr.push(r.userId);
    map.set(r.leagueId, arr);
  }
  return map;
}

export async function listLeagues(filter?: {
  ownerId?: string;
  memberId?: string;
  status?: FantasyStatus;
  gameId?: string;
}): Promise<FantasyLeagueRow[]> {
  const conds = [] as ReturnType<typeof eq>[];
  if (filter?.ownerId) conds.push(eq(schema.fantasyLeagues.ownerId, filter.ownerId));
  if (filter?.status) conds.push(eq(schema.fantasyLeagues.status, filter.status));
  if (filter?.gameId) conds.push(eq(schema.fantasyLeagues.gameId, filter.gameId));

  const where = conds.length > 0 ? and(...conds) : undefined;
  const leagues = where
    ? await db
        .select()
        .from(schema.fantasyLeagues)
        .where(where)
        .orderBy(desc(schema.fantasyLeagues.createdAt))
    : await db
        .select()
        .from(schema.fantasyLeagues)
        .orderBy(desc(schema.fantasyLeagues.createdAt));

  const members = await membersFor(leagues.map((l) => l.id));

  const rows = leagues.map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description,
    gameId: l.gameId,
    ownerId: l.ownerId,
    members: members.get(l.id) ?? [],
    maxMembers: l.maxMembers,
    salaryCap: l.salaryCap,
    prizePool: l.prizePool,
    entryFee: l.entryFee,
    scoringSystem: l.scoringSystem as ScoringSystem,
    status: l.status as FantasyStatus,
    endsAt: l.endsAt,
    bannerSeed: l.bannerSeed,
    createdAt: l.createdAt,
  }));

  if (filter?.memberId) {
    return rows.filter((r) => r.members.includes(filter.memberId!));
  }
  return rows;
}

export async function getLeagueById(id: string): Promise<FantasyLeagueRow | null> {
  const row = (
    await db
      .select()
      .from(schema.fantasyLeagues)
      .where(eq(schema.fantasyLeagues.id, id))
      .limit(1)
  )[0];
  if (!row) return null;
  const members = await membersFor([row.id]);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    gameId: row.gameId,
    ownerId: row.ownerId,
    members: members.get(row.id) ?? [],
    maxMembers: row.maxMembers,
    salaryCap: row.salaryCap,
    prizePool: row.prizePool,
    entryFee: row.entryFee,
    scoringSystem: row.scoringSystem as ScoringSystem,
    status: row.status as FantasyStatus,
    endsAt: row.endsAt,
    bannerSeed: row.bannerSeed,
    createdAt: row.createdAt,
  };
}

export async function listLeaderboard(
  leagueId: string,
): Promise<FantasyLeaderboardRow[]> {
  const rows = await db
    .select({
      userId: schema.fantasyLineups.userId,
      totalPoints: sql<number>`sum(${schema.fantasyLineups.totalPoints})::int`,
      lineupCount: sql<number>`count(*)::int`,
      handle: schema.user.handle,
      name: schema.user.name,
      image: schema.user.image,
    })
    .from(schema.fantasyLineups)
    .innerJoin(schema.user, eq(schema.user.id, schema.fantasyLineups.userId))
    .where(eq(schema.fantasyLineups.leagueId, leagueId))
    .groupBy(schema.fantasyLineups.userId, schema.user.handle, schema.user.name, schema.user.image)
    .orderBy(desc(sql<number>`sum(${schema.fantasyLineups.totalPoints})`));

  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    handle: r.handle ?? r.name ?? "user",
    avatarUrl: r.image ?? "",
    totalPoints: Number(r.totalPoints ?? 0),
    lineupCount: Number(r.lineupCount ?? 0),
  }));
}

function genId(prefix: string): string {
  return (
    prefix +
    "_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export class FantasyError extends Error {
  code:
    | "not_found"
    | "league_full"
    | "already_member"
    | "not_member"
    | "salary_exceeded"
    | "invalid_pick"
    | "locked";
  constructor(code: FantasyError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export interface CreateLeagueInput {
  ownerId: string;
  name: string;
  description?: string;
  gameId: string;
  maxMembers?: number;
  salaryCap: number;
  prizePool?: number;
  entryFee?: number;
  scoringSystem: ScoringSystem;
  endsAt: string;
  bannerSeed?: string;
}

export async function createLeague(
  input: CreateLeagueInput,
): Promise<FantasyLeagueRow> {
  const id = genId("league");
  const now = new Date().toISOString();
  const row = {
    id,
    name: input.name,
    description: input.description ?? "",
    gameId: input.gameId,
    ownerId: input.ownerId,
    maxMembers: input.maxMembers ?? 10,
    salaryCap: input.salaryCap,
    prizePool: input.prizePool ?? 0,
    entryFee: input.entryFee ?? 0,
    scoringSystem: input.scoringSystem,
    status: "drafting" as const,
    endsAt: input.endsAt,
    bannerSeed: input.bannerSeed ?? id,
    createdAt: now,
  };
  await db.insert(schema.fantasyLeagues).values(row);
  // Owner auto-joins as the first member.
  await db
    .insert(schema.fantasyLeagueMembers)
    .values({ leagueId: id, userId: input.ownerId, joinedAt: now })
    .onConflictDoNothing();
  await db.insert(schema.fantasyActivity).values({
    id: genId("act"),
    leagueId: id,
    kind: "join",
    message: "League created",
  });
  return (await getLeagueById(id))!;
}

export async function joinLeague(
  leagueId: string,
  userId: string,
): Promise<void> {
  const league = await getLeagueById(leagueId);
  if (!league) throw new FantasyError("not_found", "League not found");
  if (league.members.includes(userId))
    throw new FantasyError("already_member", "Already in this league");
  if (league.members.length >= league.maxMembers)
    throw new FantasyError("league_full", "League is full");
  await db
    .insert(schema.fantasyLeagueMembers)
    .values({
      leagueId,
      userId,
      joinedAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
  await db.insert(schema.fantasyActivity).values({
    id: genId("act"),
    leagueId,
    kind: "join",
    message: "New member joined",
  });
}

export interface LineupPickInput {
  playerId: string;
  cost: number;
}

export interface LineupRow {
  id: string;
  leagueId: string;
  userId: string;
  totalCost: number;
  totalPoints: number;
  submittedAt: string;
  picks: Array<{ playerId: string; cost: number; pointsScored: number }>;
}

export async function getLineup(
  leagueId: string,
  userId: string,
): Promise<LineupRow | null> {
  const lineup = (
    await db
      .select()
      .from(schema.fantasyLineups)
      .where(
        and(
          eq(schema.fantasyLineups.leagueId, leagueId),
          eq(schema.fantasyLineups.userId, userId),
        ),
      )
      .limit(1)
  )[0];
  if (!lineup) return null;
  const picks = await db
    .select()
    .from(schema.fantasyLineupPicks)
    .where(eq(schema.fantasyLineupPicks.lineupId, lineup.id));
  return {
    id: lineup.id,
    leagueId: lineup.leagueId,
    userId: lineup.userId,
    totalCost: lineup.totalCost,
    totalPoints: lineup.totalPoints,
    submittedAt: lineup.submittedAt,
    picks: picks.map((p) => ({
      playerId: p.playerId,
      cost: p.cost,
      pointsScored: p.pointsScored,
    })),
  };
}

export async function upsertLineup(
  leagueId: string,
  userId: string,
  picks: LineupPickInput[],
): Promise<LineupRow> {
  const league = await getLeagueById(leagueId);
  if (!league) throw new FantasyError("not_found", "League not found");
  if (!league.members.includes(userId))
    throw new FantasyError("not_member", "Join the league before submitting a lineup");
  if (league.status === "completed")
    throw new FantasyError("locked", "League is completed");
  if (picks.length === 0 || picks.length > 12)
    throw new FantasyError("invalid_pick", "1-12 picks required");

  const totalCost = picks.reduce((acc, p) => acc + Math.max(0, p.cost), 0);
  if (totalCost > league.salaryCap)
    throw new FantasyError("salary_exceeded", "Salary cap exceeded");

  const existing = (
    await db
      .select()
      .from(schema.fantasyLineups)
      .where(
        and(
          eq(schema.fantasyLineups.leagueId, leagueId),
          eq(schema.fantasyLineups.userId, userId),
        ),
      )
      .limit(1)
  )[0];

  const lineupId = existing?.id ?? genId("lineup");
  const now = new Date().toISOString();

  if (existing) {
    await db
      .update(schema.fantasyLineups)
      .set({ totalCost, submittedAt: now })
      .where(eq(schema.fantasyLineups.id, lineupId));
    await db
      .delete(schema.fantasyLineupPicks)
      .where(eq(schema.fantasyLineupPicks.lineupId, lineupId));
  } else {
    await db.insert(schema.fantasyLineups).values({
      id: lineupId,
      leagueId,
      userId,
      totalCost,
      totalPoints: 0,
      submittedAt: now,
    });
  }

  for (const p of picks) {
    await db.insert(schema.fantasyLineupPicks).values({
      lineupId,
      playerId: p.playerId,
      cost: Math.max(0, Math.floor(p.cost)),
      pointsScored: 0,
    });
  }

  await db.insert(schema.fantasyActivity).values({
    id: genId("act"),
    leagueId,
    kind: "lineup",
    message: existing ? "Lineup updated" : "Lineup submitted",
  });

  return (await getLineup(leagueId, userId))!;
}

export interface ActivityRow {
  id: string;
  leagueId: string;
  kind: "join" | "lineup" | "score";
  message: string;
  createdAt: string;
}

export async function listActivity(
  leagueId: string,
  limit = 20,
): Promise<ActivityRow[]> {
  const rows = await db
    .select()
    .from(schema.fantasyActivity)
    .where(eq(schema.fantasyActivity.leagueId, leagueId))
    .orderBy(desc(schema.fantasyActivity.createdAt))
    .limit(Math.max(1, Math.min(100, limit)));
  return rows.map((r) => ({
    id: r.id,
    leagueId: r.leagueId,
    kind: r.kind as ActivityRow["kind"],
    message: r.message,
    createdAt: r.createdAt,
  }));
}
