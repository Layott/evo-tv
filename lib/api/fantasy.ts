import "server-only";
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
