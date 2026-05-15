import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Pickem scoring engine.
 *
 * For an event, walk every match with state="completed" and a clear winner
 * (scoreA != scoreB). Compute each user's score as the count of correctly
 * predicted matches in their submitted picks. UPDATE pickem_entries.score
 * in one batch.
 *
 * Idempotent — safe to re-run after each match completes. Re-running on
 * an event with no completed matches just resets everyone to score=0.
 *
 * Returns {matchesScored, entriesUpdated} for the admin trigger UI.
 */
export interface ScoreResult {
  eventId: string;
  matchesScored: number;
  entriesUpdated: number;
  outcomes: Array<{ matchId: string; winnerTeamId: string | null }>;
}

export async function scorePickemForEvent(
  eventId: string,
): Promise<ScoreResult> {
  // 1. Resolve completed-match winners.
  const completedMatches = await db
    .select({
      id: schema.matches.id,
      teamAId: schema.matches.teamAId,
      teamBId: schema.matches.teamBId,
      scoreA: schema.matches.scoreA,
      scoreB: schema.matches.scoreB,
    })
    .from(schema.matches)
    .where(eq(schema.matches.eventId, eventId));

  const winners = new Map<string, string>();
  const outcomes: ScoreResult["outcomes"] = [];
  for (const m of completedMatches) {
    let winnerTeamId: string | null = null;
    if (m.scoreA > m.scoreB && m.teamAId) winnerTeamId = m.teamAId;
    else if (m.scoreB > m.scoreA && m.teamBId) winnerTeamId = m.teamBId;
    if (winnerTeamId) winners.set(m.id, winnerTeamId);
    outcomes.push({ matchId: m.id, winnerTeamId });
  }

  // 2. Load all pickem entries for the event.
  const entries = await db
    .select({
      eventId: schema.pickemEntries.eventId,
      userId: schema.pickemEntries.userId,
      picks: schema.pickemEntries.picks,
    })
    .from(schema.pickemEntries)
    .where(eq(schema.pickemEntries.eventId, eventId));

  if (entries.length === 0) {
    return {
      eventId,
      matchesScored: winners.size,
      entriesUpdated: 0,
      outcomes,
    };
  }

  // 3. Compute + UPDATE each entry's score.
  let updatedCount = 0;
  for (const entry of entries) {
    const picks = entry.picks ?? [];
    let score = 0;
    for (const p of picks) {
      const actualWinner = winners.get(p.matchId);
      if (actualWinner && actualWinner === p.winnerTeamId) {
        score += 1;
      }
    }
    await db
      .update(schema.pickemEntries)
      .set({ score })
      .where(
        sql`${schema.pickemEntries.eventId} = ${entry.eventId} AND ${schema.pickemEntries.userId} = ${entry.userId}`,
      );
    updatedCount += 1;
  }

  return {
    eventId,
    matchesScored: winners.size,
    entriesUpdated: updatedCount,
    outcomes,
  };
}
