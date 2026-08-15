import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export class PredictionError extends Error {
  code:
    | "match_not_found"
    | "match_closed"
    | "team_not_in_match"
    | "duplicate_pick"
    | "insufficient_coins"
    | "invalid_amount";
  constructor(code: PredictionError["code"], msg: string) {
    super(msg);
    this.code = code;
  }
}

const MIN_STAKE = 10;
const MAX_STAKE = 100_000;

function genPickId(): string {
  return (
    "pp_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export interface PlacePickInput {
  userId: string;
  matchId: string;
  teamPickedId: string;
  coinsStaked: number;
}

/**
 * Place a prediction pick. Atomic debit of coin_balances.coins via
 * UPDATE … WHERE coins >= staked. Duplicate (user, match) blocked.
 */
export async function placePick(input: PlacePickInput) {
  const { userId, matchId, teamPickedId, coinsStaked } = input;
  if (!Number.isInteger(coinsStaked) || coinsStaked < MIN_STAKE || coinsStaked > MAX_STAKE) {
    throw new PredictionError(
      "invalid_amount",
      `Stake must be ${MIN_STAKE}-${MAX_STAKE} coins`,
    );
  }

  const match = (
    await db
      .select({
        id: schema.matches.id,
        state: schema.matches.state,
        teamAId: schema.matches.teamAId,
        teamBId: schema.matches.teamBId,
      })
      .from(schema.matches)
      .where(eq(schema.matches.id, matchId))
      .limit(1)
  )[0];
  if (!match) throw new PredictionError("match_not_found", "Match not found");
  if (match.state !== "scheduled") {
    throw new PredictionError("match_closed", "Match is not open for picks");
  }
  if (teamPickedId !== match.teamAId && teamPickedId !== match.teamBId) {
    throw new PredictionError("team_not_in_match", "Team not in this match");
  }

  const existing = (
    await db
      .select({ id: schema.predictionPicks.id })
      .from(schema.predictionPicks)
      .where(
        and(
          eq(schema.predictionPicks.userId, userId),
          eq(schema.predictionPicks.matchId, matchId),
        ),
      )
      .limit(1)
  )[0];
  if (existing) {
    throw new PredictionError("duplicate_pick", "Already have a pick for this match");
  }

  // Atomic debit guard.
  const debited = await db
    .update(schema.coinBalances)
    .set({
      coins: sql`${schema.coinBalances.coins} - ${coinsStaked}`,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(schema.coinBalances.userId, userId),
        sql`${schema.coinBalances.coins} >= ${coinsStaked}`,
      ),
    )
    .returning({ id: schema.coinBalances.userId });
  if (debited.length === 0) {
    throw new PredictionError("insufficient_coins", "Not enough EVO Coins");
  }

  const id = genPickId();
  await db.insert(schema.predictionPicks).values({
    id,
    userId,
    matchId,
    teamPickedId,
    coinsStaked,
  });
  return id;
}

export async function listMyPicks(userId: string, limit = 50) {
  const rows = await db
    .select()
    .from(schema.predictionPicks)
    .where(eq(schema.predictionPicks.userId, userId))
    .orderBy(desc(schema.predictionPicks.createdAt))
    .limit(limit);
  return rows;
}

/**
 * Resolve all open picks for a match. 2x payout to winners (stake refunded
 * + matching reward). Losers forfeit stake (already debited at pick time).
 */
export async function resolveMatch(matchId: string, winningTeamId: string) {
  const open = await db
    .select()
    .from(schema.predictionPicks)
    .where(
      and(
        eq(schema.predictionPicks.matchId, matchId),
        eq(schema.predictionPicks.status, "open"),
      ),
    );

  let winners = 0;
  let losers = 0;
  const nowIso = new Date().toISOString();

  for (const p of open) {
    if (p.teamPickedId === winningTeamId) {
      const payout = p.coinsStaked * 2;
      await db
        .insert(schema.coinBalances)
        .values({
          userId: p.userId,
          coins: payout,
          xp: 0,
          updatedAt: nowIso,
        })
        .onConflictDoUpdate({
          target: schema.coinBalances.userId,
          set: {
            coins: sql`${schema.coinBalances.coins} + ${payout}`,
            updatedAt: nowIso,
          },
        });
      await db
        .update(schema.predictionPicks)
        .set({ status: "won", payoutCoins: payout, resolvedAt: nowIso })
        .where(eq(schema.predictionPicks.id, p.id));
      winners += 1;
    } else {
      await db
        .update(schema.predictionPicks)
        .set({ status: "lost", payoutCoins: 0, resolvedAt: nowIso })
        .where(eq(schema.predictionPicks.id, p.id));
      losers += 1;
    }
  }

  return { winners, losers, total: open.length };
}
