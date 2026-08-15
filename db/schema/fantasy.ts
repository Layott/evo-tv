import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { user } from "./users";

/**
 * Fantasy leagues - Phase 7.2 starter. Owner creates a league with a salary
 * cap + scoring system + game; members join, submit a lineup of players,
 * and the scoring engine (nightly cron, deferred) computes points.
 */
export const fantasyLeagues = pgTable(
  "fantasy_leagues",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    gameId: text("game_id").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    maxMembers: integer("max_members").notNull().default(10),
    salaryCap: integer("salary_cap").notNull(),
    prizePool: integer("prize_pool").notNull().default(0),
    entryFee: integer("entry_fee").notNull().default(0),
    scoringSystem: text("scoring_system", {
      enum: ["kills", "kda", "objectives"],
    }).notNull(),
    status: text("status", {
      enum: ["drafting", "active", "completed"],
    })
      .notNull()
      .default("drafting"),
    endsAt: text("ends_at").notNull(),
    bannerSeed: text("banner_seed").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("fantasy_leagues_game_idx").on(t.gameId),
    index("fantasy_leagues_owner_idx").on(t.ownerId),
  ],
);

/** Membership join - composite PK on (leagueId, userId). */
export const fantasyLeagueMembers = pgTable(
  "fantasy_league_members",
  {
    leagueId: text("league_id")
      .notNull()
      .references(() => fantasyLeagues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: text("joined_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.leagueId, t.userId] }),
    index("fantasy_members_user_idx").on(t.userId),
  ],
);

/**
 * One lineup per (league, user). The picks live in fantasy_lineup_picks
 * keyed by lineup id. Submit replaces in a single transaction.
 */
export const fantasyLineups = pgTable(
  "fantasy_lineups",
  {
    id: text("id").primaryKey(),
    leagueId: text("league_id")
      .notNull()
      .references(() => fantasyLeagues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    totalCost: integer("total_cost").notNull().default(0),
    totalPoints: integer("total_points").notNull().default(0),
    submittedAt: text("submitted_at").notNull(),
  },
  (t) => [
    index("fantasy_lineups_league_idx").on(t.leagueId),
    index("fantasy_lineups_user_idx").on(t.userId),
  ],
);

export const fantasyLineupPicks = pgTable(
  "fantasy_lineup_picks",
  {
    lineupId: text("lineup_id")
      .notNull()
      .references(() => fantasyLineups.id, { onDelete: "cascade" }),
    playerId: text("player_id").notNull(),
    cost: integer("cost").notNull(),
    pointsScored: integer("points_scored").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.lineupId, t.playerId] }),
    index("fantasy_lineup_picks_lineup_idx").on(t.lineupId),
  ],
);

/** Append-only activity feed for the league detail screen. */
export const fantasyActivity = pgTable(
  "fantasy_activity",
  {
    id: text("id").primaryKey(),
    leagueId: text("league_id")
      .notNull()
      .references(() => fantasyLeagues.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["join", "lineup", "score"] }).notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("fantasy_activity_league_idx").on(t.leagueId, t.createdAt)],
);
