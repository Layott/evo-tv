import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core";
import { games } from "./catalog";
import { events } from "./events";
import { user } from "./users";

export const streams = sqliteTable(
  "streams",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    eventId: text("event_id").references(() => events.id, { onDelete: "set null" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    streamerType: text("streamer_type", { enum: ["official", "creator"] })
      .notNull()
      .default("official"),
    streamerName: text("streamer_name").notNull(),
    streamerAvatarUrl: text("streamer_avatar_url").notNull().default(""),
    streamKeyHash: text("stream_key_hash").notNull().unique(),
    isLive: integer("is_live", { mode: "boolean" }).notNull().default(false),
    startedAt: text("started_at"),
    endedAt: text("ended_at"),
    hlsPath: text("hls_path").notNull().default(""),
    thumbnailUrl: text("thumbnail_url").notNull().default(""),
    viewerCount: integer("viewer_count").notNull().default(0),
    peakViewerCount: integer("peak_viewer_count").notNull().default(0),
    language: text("language").notNull().default("en"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    isPremium: integer("is_premium", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("streams_live_idx").on(t.isLive), index("streams_game_idx").on(t.gameId)]
);

export const vods = sqliteTable(
  "vods",
  {
    id: text("id").primaryKey(),
    streamId: text("stream_id").references(() => streams.id, { onDelete: "set null" }),
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
    chapters: text("chapters", { mode: "json" })
      .$type<{ label: string; startSec: number }[]>()
      .notNull()
      .default([]),
    viewCount: integer("view_count").notNull().default(0),
    likeCount: integer("like_count").notNull().default(0),
    isPremium: integer("is_premium", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("vods_game_idx").on(t.gameId), index("vods_published_idx").on(t.publishedAt)]
);

export const clips = sqliteTable(
  "clips",
  {
    id: text("id").primaryKey(),
    vodId: text("vod_id").references(() => vods.id, { onDelete: "set null" }),
    streamId: text("stream_id").references(() => streams.id, { onDelete: "set null" }),
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
  },
  (t) => [index("clips_game_idx").on(t.gameId)]
);

export const vodProgress = sqliteTable(
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
  (t) => [primaryKey({ columns: [t.userId, t.vodId] })]
);

export const chatMessages = sqliteTable(
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
    isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
    isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("chat_stream_idx").on(t.streamId, t.createdAt)]
);

export const polls = sqliteTable("polls", {
  id: text("id").primaryKey(),
  streamId: text("stream_id")
    .notNull()
    .references(() => streams.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  options: text("options", { mode: "json" })
    .$type<{ id: string; label: string; votes: number }[]>()
    .notNull(),
  createdAt: text("created_at").notNull(),
  closesAt: text("closes_at").notNull(),
  isClosed: integer("is_closed", { mode: "boolean" }).notNull().default(false),
  totalVotes: integer("total_votes").notNull().default(0),
});

export const pollVotes = sqliteTable(
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
  (t) => [primaryKey({ columns: [t.userId, t.pollId] })]
);

export const follows = sqliteTable(
  "follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetType: text("target_type", { enum: ["team", "player", "streamer"] }).notNull(),
    targetId: text("target_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] })]
);

export const likes = sqliteTable(
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
  ]
);
