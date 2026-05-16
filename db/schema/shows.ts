import {
  pgTable,
  text,
  integer,
  index,
  primaryKey,
  timestamp,
  doublePrecision,
  jsonb,
} from "drizzle-orm/pg-core";

import { user } from "./users";

/**
 * Phase 9b — EVO Originals + Licensed shows.
 *
 * Show → Season → Episode hierarchy. Episode progress + show watchlist
 * tables track per-user state. Frontend mock side already shipped in
 * evotv-app commit 3d2c40a; this is the durable persistence layer.
 */

export const shows = pgTable(
  "shows",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    synopsis: text("synopsis").notNull().default(""),
    heroUrl: text("hero_url").notNull().default(""),
    posterUrl: text("poster_url").notNull().default(""),
    pillar: text("pillar", {
      enum: ["esports", "anime", "lifestyle"],
    })
      .notNull()
      .default("esports"),
    originType: text("origin_type", {
      enum: ["evo_original", "licensed", "syndicated"],
    })
      .notNull()
      .default("evo_original"),
    status: text("status", {
      enum: ["airing", "completed", "upcoming", "hiatus"],
    })
      .notNull()
      .default("upcoming"),
    primaryCreatorHandle: text("primary_creator_handle").notNull().default(""),
    totalSeasons: integer("total_seasons").notNull().default(0),
    totalEpisodes: integer("total_episodes").notNull().default(0),
    rating: doublePrecision("rating").notNull().default(0),
    releasedAt: timestamp("released_at", { withTimezone: true, mode: "string" }),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (t) => [
    index("shows_pillar_idx").on(t.pillar),
    index("shows_status_idx").on(t.status),
    index("shows_slug_idx").on(t.slug),
  ],
);

export const seasons = pgTable(
  "seasons",
  {
    id: text("id").primaryKey(),
    showId: text("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    seasonNumber: integer("season_number").notNull(),
    title: text("title").notNull().default(""),
    episodeCount: integer("episode_count").notNull().default(0),
    releasedAt: timestamp("released_at", { withTimezone: true, mode: "string" }),
  },
  (t) => [
    index("seasons_show_idx").on(t.showId),
    index("seasons_show_number_idx").on(t.showId, t.seasonNumber),
  ],
);

export const episodes = pgTable(
  "episodes",
  {
    id: text("id").primaryKey(),
    showId: text("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    seasonNumber: integer("season_number").notNull(),
    episodeNumber: integer("episode_number").notNull(),
    title: text("title").notNull(),
    synopsis: text("synopsis").notNull().default(""),
    thumbnailUrl: text("thumbnail_url").notNull().default(""),
    runtimeSec: integer("runtime_sec").notNull().default(0),
    hlsUrl: text("hls_url").notNull().default(""),
    introStartSec: integer("intro_start_sec"),
    introEndSec: integer("intro_end_sec"),
    premiereAt: timestamp("premiere_at", { withTimezone: true, mode: "string" }),
    releasedAt: timestamp("released_at", { withTimezone: true, mode: "string" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (t) => [
    index("episodes_show_idx").on(t.showId),
    index("episodes_season_idx").on(t.seasonId),
    index("episodes_lookup_idx").on(t.showId, t.seasonNumber, t.episodeNumber),
  ],
);

export const episodeProgress = pgTable(
  "episode_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    episodeId: text("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    positionSec: integer("position_sec").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.episodeId] }),
    index("episode_progress_user_idx").on(t.userId),
    index("episode_progress_updated_idx").on(t.updatedAt),
  ],
);

export const showWatchlist = pgTable(
  "show_watchlist",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    showId: text("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["watching", "completed", "on_hold", "dropped", "plan_to_watch"],
    })
      .notNull()
      .default("watching"),
    addedAt: timestamp("added_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.showId] }),
    index("show_watchlist_user_idx").on(t.userId),
  ],
);
