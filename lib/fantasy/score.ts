import "server-only";
import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Fantasy scoring engine — team-proxy v1.
 *
 * No per-player stats table exists yet. Until match_player_stats lands,
 * each player's pointsScored = (wins by their team in the league window) * 10.
 * Substitute fields like scoringSystem ("kills"/"kda"/"objectives") still
 * map to the same metric — they're informational labels for v1.
 *
 * Window: matches with state="completed" AND scheduledAt BETWEEN league.createdAt
 * AND league.endsAt, where event.gameId === league.gameId. Players without a
 * teamId or with a team in a different game score 0.
 *
 * Idempotent — overwrites lineup_picks.pointsScored and lineups.totalPoints
 * on every run. Re-running mid-season just reflects the new partial.
 */

export interface FantasyScoreResult {
  leagueId: string;
  matchesScanned: number;
  picksUpdated: number;
  lineupsUpdated: number;
}

export async function scoreFantasyForLeague(
  leagueId: string,
): Promise<FantasyScoreResult> {
  const league = (
    await db
      .select({
        id: schema.fantasyLeagues.id,
        gameId: schema.fantasyLeagues.gameId,
        endsAt: schema.fantasyLeagues.endsAt,
        createdAt: schema.fantasyLeagues.createdAt,
      })
      .from(schema.fantasyLeagues)
      .where(eq(schema.fantasyLeagues.id, leagueId))
      .limit(1)
  )[0];

  if (!league) {
    return { leagueId, matchesScanned: 0, picksUpdated: 0, lineupsUpdated: 0 };
  }

  // 1) Find every event in the league's game with the right window.
  const eligibleEvents = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(eq(schema.events.gameId, league.gameId));

  const eventIds = eligibleEvents.map((e) => e.id);

  // 2) Pull completed matches in those events inside the league window.
  let completedMatches: Array<{
    id: string;
    teamAId: string | null;
    teamBId: string | null;
    scoreA: number;
    scoreB: number;
  }> = [];

  if (eventIds.length > 0) {
    completedMatches = await db
      .select({
        id: schema.matches.id,
        teamAId: schema.matches.teamAId,
        teamBId: schema.matches.teamBId,
        scoreA: schema.matches.scoreA,
        scoreB: schema.matches.scoreB,
      })
      .from(schema.matches)
      .where(
        and(
          inArray(schema.matches.eventId, eventIds),
          eq(schema.matches.state, "completed"),
          gte(schema.matches.scheduledAt, league.createdAt),
          lte(schema.matches.scheduledAt, league.endsAt),
        ),
      );
  }

  // 3) Build winner-team-id → wins-count map.
  const teamWins = new Map<string, number>();
  for (const m of completedMatches) {
    let winner: string | null = null;
    if (m.scoreA > m.scoreB && m.teamAId) winner = m.teamAId;
    else if (m.scoreB > m.scoreA && m.teamBId) winner = m.teamBId;
    if (winner) teamWins.set(winner, (teamWins.get(winner) ?? 0) + 1);
  }

  // 4) Load every lineup in the league + each lineup's picks.
  const lineups = await db
    .select({
      id: schema.fantasyLineups.id,
      leagueId: schema.fantasyLineups.leagueId,
      userId: schema.fantasyLineups.userId,
    })
    .from(schema.fantasyLineups)
    .where(eq(schema.fantasyLineups.leagueId, leagueId));

  if (lineups.length === 0) {
    return { leagueId, matchesScanned: completedMatches.length, picksUpdated: 0, lineupsUpdated: 0 };
  }

  const lineupIds = lineups.map((l) => l.id);

  const picks = await db
    .select({
      lineupId: schema.fantasyLineupPicks.lineupId,
      playerId: schema.fantasyLineupPicks.playerId,
    })
    .from(schema.fantasyLineupPicks)
    .where(inArray(schema.fantasyLineupPicks.lineupId, lineupIds));

  // 5) Resolve player→team map.
  const playerIds = Array.from(new Set(picks.map((p) => p.playerId)));
  const playerRows = playerIds.length
    ? await db
        .select({ id: schema.players.id, teamId: schema.players.teamId })
        .from(schema.players)
        .where(inArray(schema.players.id, playerIds))
    : [];

  const playerTeam = new Map<string, string | null>();
  for (const p of playerRows) playerTeam.set(p.id, p.teamId);

  // 6) Compute pointsScored per pick + roll up totalPoints per lineup.
  const lineupTotals = new Map<string, number>();
  let picksUpdated = 0;

  for (const pick of picks) {
    const teamId = playerTeam.get(pick.playerId) ?? null;
    const wins = teamId ? (teamWins.get(teamId) ?? 0) : 0;
    const points = wins * 10;

    await db
      .update(schema.fantasyLineupPicks)
      .set({ pointsScored: points })
      .where(
        and(
          eq(schema.fantasyLineupPicks.lineupId, pick.lineupId),
          eq(schema.fantasyLineupPicks.playerId, pick.playerId),
        ),
      );

    lineupTotals.set(pick.lineupId, (lineupTotals.get(pick.lineupId) ?? 0) + points);
    picksUpdated += 1;
  }

  // 7) Persist lineups.totalPoints.
  let lineupsUpdated = 0;
  for (const lineup of lineups) {
    const total = lineupTotals.get(lineup.id) ?? 0;
    await db
      .update(schema.fantasyLineups)
      .set({ totalPoints: total })
      .where(eq(schema.fantasyLineups.id, lineup.id));
    lineupsUpdated += 1;
  }

  return {
    leagueId,
    matchesScanned: completedMatches.length,
    picksUpdated,
    lineupsUpdated,
  };
}

/** Score every league with status="active". Used by the nightly cron. */
export async function scoreAllActiveLeagues(): Promise<FantasyScoreResult[]> {
  const activeLeagues = await db
    .select({ id: schema.fantasyLeagues.id })
    .from(schema.fantasyLeagues)
    .where(eq(schema.fantasyLeagues.status, "active"));

  const results: FantasyScoreResult[] = [];
  for (const l of activeLeagues) {
    try {
      results.push(await scoreFantasyForLeague(l.id));
    } catch (err) {
      console.error(`fantasy-score failed for league ${l.id}`, err);
      results.push({
        leagueId: l.id,
        matchesScanned: 0,
        picksUpdated: 0,
        lineupsUpdated: 0,
      });
    }
  }
  return results;
}
