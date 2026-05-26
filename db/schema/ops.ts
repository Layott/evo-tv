import { pgTable, text, integer, boolean, jsonb, index, primaryKey } from "drizzle-orm/pg-core";
import { user } from "./users";

export const ads = pgTable(
  "ads",
  {
    id: text("id").primaryKey(),
    placement: text("placement", {
      enum: ["home_banner", "stream_preroll", "sidebar", "between_content"],
    }).notNull(),
    mediaUrl: text("media_url").notNull(),
    clickUrl: text("click_url").notNull(),
    advertiser: text("advertiser").notNull(),
    active: boolean("active").notNull().default(true),
    startAt: text("start_at").notNull(),
    endAt: text("end_at").notNull(),
    weight: integer("weight").notNull().default(100),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
  },
  (t) => [index("ads_placement_active_idx").on(t.placement, t.active)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    linkUrl: text("link_url"),
    readAt: text("read_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("notifications_user_read_idx").on(t.userId, t.readAt)],
);

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description").notNull().default(""),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
});

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("push_user_idx").on(t.userId)],
);

/**
 * Expo push tokens for native (iOS / Android) clients. Distinct from
 * `push_subscriptions` which holds Web Push (browser PushManager) payloads
 * — Expo gives a single opaque string per device, no key pair.
 *
 * Token is unique globally (one device → one row, latest wins). A user can
 * have multiple tokens (phone + tablet). `lastSeenAt` lets the cron prune
 * stale tokens (Expo treats >6 months of no delivery as invalid).
 */
export const expoPushTokens = pgTable(
  "expo_push_tokens",
  {
    token: text("token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    platform: text("platform", { enum: ["ios", "android", "web"] }).notNull(),
    createdAt: text("created_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
  },
  (t) => [index("expo_push_user_idx").on(t.userId)],
);

export const reminders = pgTable(
  "reminders",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eventId: text("event_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("reminders_user_idx").on(t.userId)],
);

/**
 * EPG reminders. User taps a bell on a schedule row; cron fans out an Expo
 * Push leadMin minutes before airsAt and stamps notifiedAt so we don't
 * double-fire. Composite PK on (userId, targetId) makes toggle a simple
 * INSERT ... ON CONFLICT DO NOTHING / DELETE pair.
 *
 * targetId mirrors the EpgRow.id shape: "ep_<id>" | "stream_<id>" | "match_<id>".
 * The cron does not need to dereference the target — airsAt is the source of
 * truth for when to fire. If the target moves or is cancelled, a future
 * housekeeping cron can prune.
 */
export const epgReminders = pgTable(
  "epg_reminders",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetId: text("target_id").notNull(),
    airsAt: text("airs_at").notNull(),
    leadMin: integer("lead_min").notNull().default(15),
    notifiedAt: text("notified_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.targetId] }),
    index("epg_reminders_due_idx").on(t.airsAt),
    index("epg_reminders_user_idx").on(t.userId),
  ],
);

/**
 * Idempotency keys for money-touching routes. Required header
 * `Idempotency-Key` on /api/orders, /api/tips, /api/rewards/redeem,
 * /api/payments/*. Replay of the same key returns the cached response.
 * 24h retention.
 */
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: jsonb("response_body").$type<unknown>(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idempotency_user_key_idx").on(t.userId, t.key)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);
