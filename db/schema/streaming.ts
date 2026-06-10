import { pgTable, text, integer, boolean, jsonb, primaryKey, index } from "drizzle-orm/pg-core";
import { games } from "./catalog";
import { events } from "./events";
import { user } from "./users";

export const streams = pgTable(
  "streams",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    eventId: text("event_id").references(() => events.id, { onDelete: "set null" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    // Phase 3 multi-tenant: nullable during backfill; will be required once
    // Phase 3.2 populates every row. Not adding FK constraint via Drizzle since
    // `channels` is in a separate schema file — let the migration capture it.
    channelId: text("channel_id"),
    streamerType: text("streamer_type", { enum: ["official", "creator"] })
      .notNull()
      .default("official"),
    streamerName: text("streamer_name").notNull(),
    streamerAvatarUrl: text("streamer_avatar_url").notNull().default(""),
    streamKeyHash: text("stream_key_hash").notNull().unique(),
    isLive: boolean("is_live").notNull().default(false),
    startedAt: text("started_at"),
    endedAt: text("ended_at"),
    // Phase MVP — EPG/schedule. Pre-announced airtime for upcoming streams.
    // NULL for live-only or unscheduled streams.
    scheduledStartAt: text("scheduled_start_at"),
    scheduledDurationMin: integer("scheduled_duration_min"),
    // Linear playout — "now airing" pointer. Set by the playout engine
    // (ffplayout) via POST /api/internal/now-airing on every program change so
    // a continuous linear-channel stream can advertise what is REALLY on air,
    // not just what was scheduled. NULL on non-linear / idle streams.
    nowAiringTitle: text("now_airing_title"),
    nowAiringSubtitle: text("now_airing_subtitle"),
    nowAiringTargetId: text("now_airing_target_id"),
    nowAiringThumbnailUrl: text("now_airing_thumbnail_url"),
    nowAiringStartedAt: text("now_airing_started_at"),
    // Linear playout — which media file the office playout engine should air for
    // this scheduled program. References playout_media.file_path. NULL = no file
    // chosen yet (the playout adapter falls back to filler). Set by admins via
    // the stream schedule editor's file picker.
    playoutFilePath: text("playout_file_path"),
    hlsPath: text("hls_path").notNull().default(""),
    thumbnailUrl: text("thumbnail_url").notNull().default(""),
    viewerCount: integer("viewer_count").notNull().default(0),
    peakViewerCount: integer("peak_viewer_count").notNull().default(0),
    language: text("language").notNull().default("en"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    isPremium: boolean("is_premium").notNull().default(false),
    // Phase 9a — top-level content pillar. Defaults to esports for legacy rows.
    pillar: text("pillar", {
      enum: ["esports", "anime", "lifestyle"],
    })
      .notNull()
      .default("esports"),
    // Content maturity rating (kids<pg<teen<mature). Defaults to teen for legacy rows.
    maturityRating: text("maturity_rating").notNull().default("teen"),
    // Free-form content descriptors (e.g. "violence", "esports", "fps").
    contentTags: text("content_tags").array().notNull().default([]),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("streams_live_idx").on(t.isLive),
    index("streams_game_idx").on(t.gameId),
    index("streams_scheduled_idx").on(t.scheduledStartAt),
  ],
);

/**
 * Office playout media library. The office "media agent"
 * (scripts/report-media-library.mjs) scans the playout box's media folder and
 * upserts one row per video file here, so admins can pick a real file for a
 * scheduled program from the admin UI instead of hand-editing a JSON map.
 * Files that vanish from the folder are soft-deleted (deletedAt set).
 */
export const playoutMedia = pgTable(
  "playout_media",
  {
    id: text("id").primaryKey(),
    filePath: text("file_path").notNull().unique(),
    fileName: text("file_name").notNull(),
    durationSec: integer("duration_sec"),
    sizeMb: integer("size_mb"),
    lastSeenAt: text("last_seen_at").notNull(),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("playout_media_active_idx").on(t.deletedAt)],
);

export const vods = pgTable(
  "vods",
  {
    id: text("id").primaryKey(),
    streamId: text("stream_id").references(() => streams.id, { onDelete: "set null" }),
    channelId: text("channel_id"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    durationSec: integer("duration_sec").notNull(),
    hlsPath: text("hls_path").notNull().default(""),
    mp4Path: text("mp4_path").notNull().default(""),
    thumbnailUrl: text("thumbnail_url").notNull().default(""),
    publishedAt: text("published_at").notNull(),
    chapters: jsonb("chapters")
      .$type<{ label: string; startSec: number }[]>()
      .notNull()
      .default([]),
    viewCount: integer("view_count").notNull().default(0),
    likeCount: integer("like_count").notNull().default(0),
    isPremium: boolean("is_premium").notNull().default(false),
    // Phase 9a — top-level content pillar. Defaults to esports for legacy rows.
    pillar: text("pillar", {
      enum: ["esports", "anime", "lifestyle"],
    })
      .notNull()
      .default("esports"),
    // Content maturity rating (kids<pg<teen<mature). Defaults to teen for legacy rows.
    maturityRating: text("maturity_rating").notNull().default("teen"),
    // Free-form content descriptors.
    contentTags: text("content_tags").array().notNull().default([]),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("vods_game_idx").on(t.gameId), index("vods_published_idx").on(t.publishedAt)],
);

export const clips = pgTable(
  "clips",
  {
    id: text("id").primaryKey(),
    vodId: text("vod_id").references(() => vods.id, { onDelete: "set null" }),
    streamId: text("stream_id").references(() => streams.id, { onDelete: "set null" }),
    channelId: text("channel_id"),
    title: text("title").notNull(),
    creatorHandle: text("creator_handle").notNull(),
    creatorAvatarUrl: text("creator_avatar_url").notNull().default(""),
    durationSec: integer("duration_sec").notNull(),
    mp4Path: text("mp4_path").notNull().default(""),
    thumbnailUrl: text("thumbnail_url").notNull().default(""),
    viewCount: integer("view_count").notNull().default(0),
    likeCount: integer("like_count").notNull().default(0),
    createdAt: text("created_at").notNull(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    // Phase 9a — top-level content pillar. Defaults to esports for legacy rows.
    pillar: text("pillar", {
      enum: ["esports", "anime", "lifestyle"],
    })
      .notNull()
      .default("esports"),
    // Content maturity rating (kids<pg<teen<mature). Defaults to teen for legacy rows.
    maturityRating: text("maturity_rating").notNull().default("teen"),
    // Free-form content descriptors.
    contentTags: text("content_tags").array().notNull().default([]),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("clips_game_idx").on(t.gameId)],
);

export const vodProgress = pgTable(
  "vod_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    vodId: text("vod_id")
      .notNull()
      .references(() => vods.id, { onDelete: "cascade" }),
    positionSec: integer("position_sec").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.vodId] })],
);

/**
 * User-bookmarked VODs ("Watch later"). Composite PK ensures one row per
 * user-vod pair (toggle = INSERT ... ON CONFLICT DO NOTHING / DELETE).
 * Indexed by createdAt for the recent-first list endpoint.
 */
export const vodBookmarks = pgTable(
  "vod_bookmarks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    vodId: text("vod_id")
      .notNull()
      .references(() => vods.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.vodId] }),
    index("vod_bookmarks_user_idx").on(t.userId, t.createdAt),
  ],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    streamId: text("stream_id")
      .notNull()
      .references(() => streams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull(),
    isDeleted: boolean("is_deleted").notNull().default(false),
    isPinned: boolean("is_pinned").notNull().default(false),
  },
  (t) => [index("chat_stream_idx").on(t.streamId, t.createdAt)],
);

export const polls = pgTable("polls", {
  id: text("id").primaryKey(),
  streamId: text("stream_id")
    .notNull()
    .references(() => streams.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  options: jsonb("options")
    .$type<{ id: string; label: string; votes: number }[]>()
    .notNull(),
  createdAt: text("created_at").notNull(),
  closesAt: text("closes_at").notNull(),
  isClosed: boolean("is_closed").notNull().default(false),
  totalVotes: integer("total_votes").notNull().default(0),
});

export const pollVotes = pgTable(
  "poll_votes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    pollId: text("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    optionId: text("option_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.pollId] })],
);

export const follows = pgTable(
  "follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetType: text("target_type", { enum: ["team", "player", "streamer"] }).notNull(),
    targetId: text("target_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] })],
);

export const likes = pgTable(
  "likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetType: text("target_type", { enum: ["vod", "clip"] }).notNull(),
    targetId: text("target_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.targetType, t.targetId] }),
    index("likes_target_idx").on(t.targetType, t.targetId),
    index("likes_recent_idx").on(t.createdAt),
  ],
);
