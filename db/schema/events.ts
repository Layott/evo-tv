import { pgTable, text, integer, primaryKey, index } from "drizzle-orm/pg-core";
import { games, teams } from "./catalog";

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    status: text("status", {
      enum: ["scheduled", "live", "completed", "cancelled"],
    }).notNull(),
    tier: text("tier", { enum: ["s", "a", "b", "c"] }).notNull(),
    bannerUrl: text("banner_url").notNull(),
    thumbnailUrl: text("thumbnail_url").notNull(),
    description: text("description").notNull().default(""),
    prizePoolNgn: integer("prize_pool_ngn").notNull().default(0),
    region: text("region").notNull(),
    format: text("format").notNull().default(""),
    viewerCount: integer("viewer_count").notNull().default(0),
  },
  (t) => [index("events_status_idx").on(t.status), index("events_game_idx").on(t.gameId)],
);

export const eventTeams = pgTable(
  "event_teams",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.teamId] })],
);

export const matches = pgTable(
  "matches",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    teamAId: text("team_a_id").references(() => teams.id, { onDelete: "set null" }),
    teamBId: text("team_b_id").references(() => teams.id, { onDelete: "set null" }),
    scheduledAt: text("scheduled_at").notNull(),
    state: text("state", { enum: ["scheduled", "live", "completed"] }).notNull(),
    scoreA: integer("score_a").notNull().default(0),
    scoreB: integer("score_b").notNull().default(0),
    round: text("round").notNull().default(""),
    bestOf: integer("best_of").notNull().default(1),
  },
  (t) => [index("matches_event_idx").on(t.eventId)],
);

/**
 * Per-player stats per match. Optional - present only for matches an admin
 * manually scored. Fantasy scoring v2 prefers these; falls back to team-proxy
 * (team wins * 10) for matches without rows.
 */
export const matchPlayerStats = pgTable(
  "match_player_stats",
  {
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    playerId: text("player_id").notNull(),
    kills: integer("kills").notNull().default(0),
    deaths: integer("deaths").notNull().default(0),
    assists: integer("assists").notNull().default(0),
    objectives: integer("objectives").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.matchId, t.playerId] }),
    index("match_player_stats_player_idx").on(t.playerId),
  ],
);
