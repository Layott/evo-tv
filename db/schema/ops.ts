import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./users";

export const ads = sqliteTable(
  "ads",
  {
    id: text("id").primaryKey(),
    placement: text("placement", {
      enum: ["home_banner", "stream_preroll", "sidebar", "between_content"],
    }).notNull(),
    mediaUrl: text("media_url").notNull(),
    clickUrl: text("click_url").notNull(),
    advertiser: text("advertiser").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    startAt: text("start_at").notNull(),
    endAt: text("end_at").notNull(),
    weight: integer("weight").notNull().default(100),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
  },
  (t) => [index("ads_placement_active_idx").on(t.placement, t.active)]
);

export const notifications = sqliteTable(
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
  (t) => [index("notifications_user_read_idx").on(t.userId, t.readAt)]
);

export const featureFlags = sqliteTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  description: text("description").notNull().default(""),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
});

export const pushSubscriptions = sqliteTable(
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
  (t) => [index("push_user_idx").on(t.userId)]
);

export const reminders = sqliteTable(
  "reminders",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eventId: text("event_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("reminders_user_idx").on(t.userId)]
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)]
);
