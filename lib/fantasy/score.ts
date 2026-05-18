import "server-only";
import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Fantasy scoring engine — v2 (per-player stats with team-proxy fallback).
 *
 * For each pick:
 *   1. Look up every `match_player_stats` row for that playerId, scoped to
 *      completed matches in the league's game inside the league window.
 *   2. If any rows exist, apply the league.scoringSystem formula to the sum:
 *        - kills      → kills*10 - deaths*5
 *        - kda        → kills*10 + assists*5 - deaths*5
 *        - objectives → objectives*25 + kills*5
 *      Pin to >= 0.
 *   3. If no stat rows exist, fall back to the v1 team-proxy:
 *        pointsScored = (team_wins_in_window) * 10
 *      where team is the player's current team_id from the players catalog.
 *
 * Idempotent — overwrites lineup_picks.pointsScored and lineups.totalPoints
 * on every run. Safe to re-run after each match completes.
 */

export interface FantasyScoreResult {
  leagueId: string;
  matchesScanned: number;
  picksUpdated: number;
  lineupsUpdated: number;
  /** How many picks were scored via per-player stats vs team-proxy. */
  picksByStats: number;
  picksByProxy: number;
}

type ScoringSystem = "kills" | "kda" | "objectives";

function applyFormula(
  system: ScoringSystem,
  k: number,
  d: number,
  a: number,
  o: number,
): number {
  switch (system) {
    case "kills":
      return Math.max(0, k * 10 - d * 5);
    case "kda":
      return Math.max(0, k * 10 + a * 5 - d * 5);
    case "objectives":
      return Math.max(0, o * 25 + k * 5);
  }
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
        scoringSystem: schema.fantasyLeagues.scoringSystem,
      })
      .from(schema.fantasyLeagues)
      .where(eq(schema.fantasyLeagues.id, leagueId))
      .limit(1)
  )[0];

  if (!league) {
    return {
      leagueId,
      matchesScanned: 0,
      picksUpdated: 0,
      lineupsUpdated: 0,
      picksByStats: 0,
      picksByProxy: 0,
    };
  }

  const system = (league.scoringSystem ?? "kda") as ScoringSystem;

  // 1) Eligible event IDs for this game.
  const eligibleEvents = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(eq(schema.events.gameId, league.gameId));
  const eventIds = eligibleEvents.map((e) => e.id);

  // 2) Completed matches in those events inside the league window.
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

  // 3) Build team-wins map for the proxy fallback.
  const teamWins = new Map<string, number>();
  for (const m of completedMatches) {
    let winner: string | null = null;
    if (m.scoreA > m.scoreB && m.teamAId) winner = m.teamAId;
    else if (m.scoreB > m.scoreA && m.teamBId) winner = m.teamBId;
    if (winner) teamWins.set(winner, (teamWins.get(winner) ?? 0) + 1);
  }

  const matchIds = completedMatches.map((m) => m.id);

  // 4) Lineups + picks.
  const lineups = await db
    .select({
      id: schema.fantasyLineups.id,
      leagueId: schema.fantasyLineups.leagueId,
      userId: schema.fantasyLineups.userId,
    })
    .from(schema.fantasyLineups)
    .where(eq(schema.fantasyLineups.leagueId, leagueId));

  if (lineups.length === 0) {
    return {
      leagueId,
      matchesScanned: completedMatches.length,
      picksUpdated: 0,
      lineupsUpdated: 0,
      picksByStats: 0,
      picksByProxy: 0,
    };
  }

  const lineupIds = lineups.map((l) => l.id);
  const picks = await db
    .select({
      lineupId: schema.fantasyLineupPicks.lineupId,
      playerId: schema.fantasyLineupPicks.playerId,
    })
    .from(schema.fantasyLineupPicks)
    .where(inArray(schema.fantasyLineupPicks.lineupId, lineupIds));

  // 5) Resolve player → teamId (for fallback) + load all relevant stats.
  const playerIds = Array.from(new Set(picks.map((p) => p.playerId)));
  const playerRows = playerIds.length
    ? await db
        .select({ id: schema.players.id, teamId: schema.players.teamId })
        .from(schema.players)
        .where(inArray(schema.players.id, playerIds))
    : [];
  const playerTeam = new Map<string, string | null>();
  for (const p of playerRows) playerTeam.set(p.id, p.teamId);

  // Per-player stats keyed by playerId, summed across matches in the window.
  const playerStatsAgg = new Map<
    string,
    { kills: number; deaths: number; assists: number; objectives: number }
  >();
  if (matchIds.length > 0 && playerIds.length > 0) {
    const statRows = await db
      .select({
        playerId: schema.matchPlayerStats.playerId,
        kills: schema.matchPlayerStats.kills,
        deaths: schema.matchPlayerStats.deaths,
        assists: schema.matchPlayerStats.assists,
        objectives: schema.matchPlayerStats.objectives,
      })
      .from(schema.matchPlayerStats)
      .where(
        and(
          inArray(schema.matchPlayerStats.matchId, matchIds),
          inArray(schema.matchPlayerStats.playerId, playerIds),
        ),
      );
    for (const r of statRows) {
      const cur = playerStatsAgg.get(r.playerId) ?? {
        kills: 0,
        deaths: 0,
        assists: 0,
        objectives: 0,
      };
      cur.kills += r.kills;
      cur.deaths += r.deaths;
      cur.assists += r.assists;
      cur.objectives += r.objectives;
      playerStatsAgg.set(r.playerId, cur);
    }
  }

  // 6) Score each pick.
  const lineupTotals = new Map<string, number>();
  let picksUpdated = 0;
  let picksByStats = 0;
  let picksByProxy = 0;

  for (const pick of picks) {
    let points = 0;
    const stats = playerStatsAgg.get(pick.playerId);
    if (stats) {
      points = applyFormula(
        system,
        stats.kills,
        stats.deaths,
        stats.assists,
        stats.objectives,
      );
      picksByStats += 1;
    } else {
      const teamId = playerTeam.get(pick.playerId) ?? null;
      const wins = teamId ? (teamWins.get(teamId) ?? 0) : 0;
      points = wins * 10;
      picksByProxy += 1;
    }

    await db
      .update(schema.fantasyLineupPicks)
      .set({ pointsScored: points })
      .where(
        and(
          eq(schema.fantasyLineupPicks.lineupId, pick.lineupId),
          eq(schema.fantasyLineupPicks.playerId, pick.playerId),
        ),
      );

    lineupTotals.set(
      pick.lineupId,
      (lineupTotals.get(pick.lineupId) ?? 0) + points,
    );
    picksUpdated += 1;
  }

  // 7) Persist lineup totals.
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
    picksByStats,
    picksByProxy,
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
        picksByStats: 0,
        picksByProxy: 0,
      });
    }
  }
  return results;
}
