import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  primaryKey,
  index,
  timestamp,
} from "drizzle-orm/pg-core";
import { games } from "./catalog";
import { events } from "./events";
import { user } from "./users";

export const streams = pgTable(
  "streams",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    /**
     * URL slug, generated from the title. Null means "address this row by its
     * id", which is what every row written before migration 0035 does. Unique
     * where present; Postgres lets multiple NULLs coexist.
     */
    slug: text("slug"),
    description: text("description").notNull().default(""),
    eventId: text("event_id").references(() => events.id, { onDelete: "set null" }),
    // Optional: an anime episode or a podcast has no game. `pillar` is what
    // classifies a programme; this stays a real FK when a game does apply.
    gameId: text("game_id")
      .references(() => games.id, { onDelete: "cascade" }),
    // Phase 3 multi-tenant: nullable during backfill; will be required once
    // Phase 3.2 populates every row. Not adding FK constraint via Drizzle since
    // `channels` is in a separate schema file - let the migration capture it.
    channelId: text("channel_id"),
    streamerType: text("streamer_type", { enum: ["official", "creator"] })
      .notNull()
      .default("official"),
    streamerName: text("streamer_name").notNull(),
    streamerAvatarUrl: text("streamer_avatar_url").notNull().default(""),
    streamKeyHash: text("stream_key_hash").notNull().unique(),
    /**
     * Which ingest this stream expects: `cloudflare`, `rtmp` or `manual`.
     * Drives the instructions the admin UI shows and what the reconcile sweep
     * asks about. Defaults to `manual`, the pre-existing behaviour.
     */
    ingestKind: text("ingest_kind", {
      enum: ["manual", "cloudflare", "rtmp"],
    })
      .notNull()
      .default("manual"),
    /** Cloudflare Stream live input id. Null for the other two ingests. */
    cfLiveInputUid: text("cf_live_input_uid"),
    /**
     * The flagship channel. At most one row may have this set, enforced by a
     * partial unique index rather than by convention, so the home page can
     * select it without a tiebreak and can never render two heroes.
     */
    isMainChannel: boolean("is_main_channel").notNull().default(false),
    /** Full-bleed image shown behind the hero when the channel is off air. */
    posterUrl: text("poster_url").notNull().default(""),
    /** One line under the title on the hero. Empty renders nothing. */
    tagline: text("tagline").notNull().default(""),
    isLive: boolean("is_live").notNull().default(false),
    startedAt: text("started_at"),
    endedAt: text("ended_at"),
    /**
     * How long the feed may be gone before the broadcast is really over.
     *
     * Losing the feed used to end the stream outright on the first
     * `on_publish_done`, so a dropped RTMP connection took the channel off air
     * even when the encoder reconnected a second later. Zero restores that
     * behaviour for anyone who wants it.
     */
    reconnectWindowSec: integer("reconnect_window_sec").notNull().default(300),
    /** When the feed went, or null while it is healthy. Cleared on publish. */
    feedLostAt: text("feed_lost_at"),
    /**
     * Somebody pressed "End broadcast".
     *
     * Kept apart from `endedAt` because the reconciler brings a stream back
     * when the encoder is demonstrably still publishing, and without this it
     * would undo an operator's decision within the minute.
     */
    offlineByOperator: boolean("offline_by_operator").notNull().default(false),
    // Phase MVP - EPG/schedule. Pre-announced airtime for upcoming streams.
    // NULL for live-only or unscheduled streams.
    scheduledStartAt: text("scheduled_start_at"),
    scheduledDurationMin: integer("scheduled_duration_min"),
    // Linear playout - "now airing" pointer. Set by the playout engine
    // (ffplayout) via POST /api/internal/now-airing on every program change so
    // a continuous linear-channel stream can advertise what is REALLY on air,
    // not just what was scheduled. NULL on non-linear / idle streams.
    nowAiringTitle: text("now_airing_title"),
    nowAiringSubtitle: text("now_airing_subtitle"),
    nowAiringTargetId: text("now_airing_target_id"),
    nowAiringThumbnailUrl: text("now_airing_thumbnail_url"),
    nowAiringStartedAt: text("now_airing_started_at"),
    // Linear playout - which media file the office playout engine should air for
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
    /**
     * Top-level content pillar, or nothing.
     *
     * Null means unfiled: it appears under Everything and under no pillar
     * filter. This was NOT NULL defaulting to esports, so a programme that was
     * none of the three was filed as esports and showed up under that filter,
     * and an operator had no way to say otherwise.
     */
    pillar: text("pillar", {
      enum: ["esports", "anime", "lifestyle"],
    }),
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
    /**
     * URL slug, generated from the title. Null means "address this row by its
     * id", which is what every row written before migration 0035 does. Unique
     * where present; Postgres lets multiple NULLs coexist.
     */
    slug: text("slug"),
    description: text("description").notNull().default(""),
    // Nullable for the same reason as `streams.gameId`: the recording of an
    // anime episode or a podcast has no game.
    gameId: text("game_id").references(() => games.id, { onDelete: "cascade" }),
    durationSec: integer("duration_sec").notNull(),
    hlsPath: text("hls_path").notNull().default(""),
    mp4Path: text("mp4_path").notNull().default(""),
    thumbnailUrl: text("thumbnail_url").notNull().default(""),
    publishedAt: text("published_at").notNull(),
    /**
     * When this becomes visible. Null means it already is.
     *
     * `publishedAt` was never a gate: it sorted the library and nothing read it
     * as a condition, so a row dated next Friday was on the site now. This one
     * is filtered on, and the detail page answers "coming soon" rather than a
     * 404 so a link shared early still lands somewhere.
     */
    publishAt: text("publish_at"),
    chapters: jsonb("chapters")
      .$type<{ label: string; startSec: number }[]>()
      .notNull()
      .default([]),
    viewCount: integer("view_count").notNull().default(0),
    likeCount: integer("like_count").notNull().default(0),
    isPremium: boolean("is_premium").notNull().default(false),
    /**
     * Top-level content pillar, or nothing.
     *
     * Null means unfiled: it appears under Everything and under no pillar
     * filter. This was NOT NULL defaulting to esports, so a programme that was
     * none of the three was filed as esports and showed up under that filter,
     * and an operator had no way to say otherwise.
     */
    pillar: text("pillar", {
      enum: ["esports", "anime", "lifestyle"],
    }),
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
    /**
     * The show, and optionally the episode, this clip was cut from.
     *
     * Untyped `text` rather than a Drizzle `references()` because `shows` and
     * `episodes` live in another schema module that this one does not import,
     * and the real constraints are added by migration 0037. The relation is in
     * Postgres either way; what is missing here is only the type-level link.
     *
     * Setting an episode sets the show too, so "clips for this show" never has
     * to join through episodes to find them.
     */
    showId: text("show_id"),
    episodeId: text("episode_id"),
    channelId: text("channel_id"),
    title: text("title").notNull(),
    /**
     * URL slug, generated from the title. Null means "address this row by its
     * id", which is what every row written before migration 0035 does. Unique
     * where present; Postgres lets multiple NULLs coexist.
     */
    slug: text("slug"),
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
    /**
     * Top-level content pillar, or nothing.
     *
     * Null means unfiled: it appears under Everything and under no pillar
     * filter. This was NOT NULL defaulting to esports, so a programme that was
     * none of the three was filed as esports and showed up under that filter,
     * and an operator had no way to say otherwise.
     */
    pillar: text("pillar", {
      enum: ["esports", "anime", "lifestyle"],
    }),
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

  /**
   * Who is allowed to vote.
   *
   * `signed_in` is the old behaviour and stays the default. `subscribers` is
   * for the votes that decide something worth paying for, and `everyone` is
   * deliberately absent: a vote nobody can be identified for is a vote that can
   * be cast a thousand times from one browser.
   */
  whoCanVote: text("who_can_vote").notNull().default("signed_in"),
  /**
   * Whether viewers see the totals while it runs.
   *
   * Off is not a smaller version of on. A poll with the numbers hidden is a
   * different thing: nobody is voting with the crowd, and the reveal at the
   * close is the moment the poll exists for.
   */
  showResultsLive: boolean("show_results_live").notNull().default(true),
  /** Put the winner on screen over the video when it closes. */
  showWinnerOnStream: boolean("show_winner_on_stream").notNull().default(false),
  /** Whether a voter can change their mind while it is open. */
  allowVoteChange: boolean("allow_vote_change").notNull().default(false),
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

/**
 * Per-video playback analytics, one row per percent of a video a session
 * reached.
 *
 * See migration 0040 for why the shape is (video, session, bucket): it bounds a
 * viewer to 100 rows per video however long they watch, and re-watching a part
 * collides on the primary key and costs nothing. It is the only table that can
 * answer "where did people stop watching", which `episode_progress` and
 * `vod_progress` cannot - those hold the latest position per viewer, so they
 * describe the survivors and say nothing about who left.
 */
export const videoViewBuckets = pgTable(
  "video_view_buckets",
  {
    /** "vod" or "episode". Two catalogues, one analytics table. */
    videoType: text("video_type").notNull(),
    videoId: text("video_id").notNull(),
    /** Per playback, not per account, so signed-out viewing still counts. */
    sessionId: text("session_id").notNull(),
    /** 0-99, the percent of total duration this row represents. */
    bucket: integer("bucket").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    country: text("country").notNull().default(""),
    device: text("device").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({
      columns: [t.videoType, t.videoId, t.sessionId, t.bucket],
    }),
    index("video_view_buckets_video_idx").on(t.videoType, t.videoId, t.createdAt),
    index("video_view_buckets_created_idx").on(t.createdAt),
    index("video_view_buckets_user_idx").on(t.userId),
  ],
);

/**
 * The chat rules an operator can change without a deploy.
 *
 * `streamId` null is the house rule. A row with a stream is that broadcast's
 * own and it replaces the house rule rather than adding to it: two sets of
 * rules that partly apply is not something anybody can reason about at 9pm with
 * chat moving.
 */
export const chatRules = pgTable("chat_rules", {
  id: text("id").primaryKey(),
  streamId: text("stream_id").references(() => streams.id, { onDelete: "cascade" }),
  blockLinks: boolean("block_links").notNull().default(true),
  /** Hosts still allowed when links are blocked. */
  allowedDomains: jsonb("allowed_domains").$type<string[]>().notNull().default([]),
  bannedWords: jsonb("banned_words").$type<string[]>().notNull().default([]),
  strikesBeforeBan: integer("strikes_before_ban").notNull().default(3),
  banMinutes: integer("ban_minutes").notNull().default(60),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * Strikes, per person per broadcast.
 *
 * Somebody who pasted a link in a match three weeks ago is not two thirds of
 * the way to a ban tonight, so this is not a running total against the account.
 */
export const chatStrikes = pgTable(
  "chat_strikes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    streamId: text("stream_id")
      .notNull()
      .references(() => streams.id, { onDelete: "cascade" }),
    count: integer("count").notNull().default(0),
    lastAt: text("last_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.streamId] })],
);
