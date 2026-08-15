import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { user } from "./users";

/**
 * EVO TV is a multi-tenant streaming platform. Partners stream to their own
 * channels and see their own analytics. EVO TV runs its own publisher +
 * channels alongside third-party partners.
 *
 *   publisher (1) ─── (N) publisher_member  (user_id, role)
 *   publisher (1) ─── (N) channel
 *   channel   (1) ─── (1) channel_stream_key (rotatable, hashed)
 *   channel   (1) ─── (N) stream / vod / clip / tip   (FK added on those tables)
 *   channel   (1) ─── (N) channel_follower
 *   channel   (1) ─── (N) analytics_daily
 *   publisher (1) ─── (N) payout
 *
 * App-level role (user/premium/admin) on `user.role` is independent of
 * publisher-scoped role (owner/admin/editor/viewer) on `publisher_members`.
 * EVO admins (`user.role === "admin"`) bypass publisher-scoped checks.
 */

export const publishers = pgTable(
  "publishers",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    contactEmail: text("contact_email").notNull().default(""),
    country: text("country").notNull().default("NG"),
    kycState: text("kyc_state", {
      enum: ["pending", "verified", "rejected"],
    })
      .notNull()
      .default("pending"),
    payoutMethod: text("payout_method", {
      enum: ["paystack", "bank", "manual"],
    })
      .notNull()
      .default("manual"),
    payoutPayload: jsonb("payout_payload").$type<Record<string, unknown>>(),
    revenueSharePct: integer("revenue_share_pct").notNull().default(70),
    isEvotvOwned: boolean("is_evotv_owned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("publishers_slug_idx").on(t.slug)],
);

export const publisherMembers = pgTable(
  "publisher_members",
  {
    publisherId: text("publisher_id")
      .notNull()
      .references(() => publishers.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "editor", "viewer"] })
      .notNull()
      .default("viewer"),
    invitedAt: timestamp("invited_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp("accepted_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (t) => [
    primaryKey({ columns: [t.publisherId, t.userId] }),
    index("publisher_members_user_idx").on(t.userId),
  ],
);

export const channels = pgTable(
  "channels",
  {
    id: text("id").primaryKey(),
    publisherId: text("publisher_id")
      .notNull()
      .references(() => publishers.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    logoUrl: text("logo_url").notNull().default(""),
    bannerUrl: text("banner_url").notNull().default(""),
    brandColor: text("brand_color").notNull().default("#2CD7E3"),
    category: text("category", {
      enum: ["esports", "gaming", "news", "sports", "creator"],
    })
      .notNull()
      .default("esports"),
    isVerified: boolean("is_verified").notNull().default(false),
    isEvotvOwned: boolean("is_evotv_owned").notNull().default(false),
    followerCount: integer("follower_count").notNull().default(0),
    // Phase 9a - top-level content pillar. Defaults to esports for legacy rows.
    pillar: text("pillar", {
      enum: ["esports", "anime", "lifestyle"],
    })
      .notNull()
      .default("esports"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    suspendedAt: timestamp("suspended_at", { withTimezone: true, mode: "string" }),
    suspendedReason: text("suspended_reason"),
  },
  (t) => [
    index("channels_publisher_idx").on(t.publisherId),
    index("channels_slug_idx").on(t.slug),
  ],
);

export const channelStreamKeys = pgTable(
  "channel_stream_keys",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    keyHash: text("key_hash").notNull().unique(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    rotatedAt: timestamp("rotated_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (t) => [
    index("channel_stream_keys_channel_idx").on(t.channelId),
    index("channel_stream_keys_active_idx").on(t.active),
  ],
);

export const channelFollowers = pgTable(
  "channel_followers",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.channelId, t.userId] }),
    index("channel_followers_user_idx").on(t.userId),
  ],
);

/**
 * Append-only event log. One row per viewer-minute heartbeat. Aggregated
 * nightly into `analytics_daily`. Truncated after 90 days.
 */
export const watchEvents = pgTable(
  "watch_events",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    streamId: text("stream_id"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    minuteBucket: text("minute_bucket").notNull(),
    ipHash: text("ip_hash").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("watch_events_channel_bucket_idx").on(t.channelId, t.minuteBucket),
    index("watch_events_created_idx").on(t.createdAt),
  ],
);

/**
 * Daily rollup per channel. Hot read path for partner dashboards.
 * Refreshed by Vercel Cron at 02:00 UTC via lib/analytics/rollup.ts.
 */
export const analyticsDaily = pgTable(
  "analytics_daily",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    views: integer("views").notNull().default(0),
    uniqueViewers: integer("unique_viewers").notNull().default(0),
    watchMinutes: integer("watch_minutes").notNull().default(0),
    peakConcurrent: integer("peak_concurrent").notNull().default(0),
    followersGained: integer("followers_gained").notNull().default(0),
    followersLost: integer("followers_lost").notNull().default(0),
    tipCoinsReceived: integer("tip_coins_received").notNull().default(0),
    tipCount: integer("tip_count").notNull().default(0),
    productOrders: integer("product_orders").notNull().default(0),
    productRevenueNgn: integer("product_revenue_ngn").notNull().default(0),
    adImpressions: integer("ad_impressions").notNull().default(0),
    adRevenueNgn: integer("ad_revenue_ngn").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.channelId, t.date] }),
    index("analytics_daily_date_idx").on(t.date),
  ],
);

export const payouts = pgTable(
  "payouts",
  {
    id: text("id").primaryKey(),
    publisherId: text("publisher_id")
      .notNull()
      .references(() => publishers.id, { onDelete: "cascade" }),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    grossNgn: integer("gross_ngn").notNull().default(0),
    feeNgn: integer("fee_ngn").notNull().default(0),
    netNgn: integer("net_ngn").notNull().default(0),
    status: text("status", {
      enum: ["pending", "approved", "paid", "failed"],
    })
      .notNull()
      .default("pending"),
    paystackTransferRef: text("paystack_transfer_ref"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }),
  },
  (t) => [
    index("payouts_publisher_idx").on(t.publisherId),
    index("payouts_status_idx").on(t.status),
  ],
);

export const publishersRelations = relations(publishers, ({ many }) => ({
  members: many(publisherMembers),
  channels: many(channels),
  payouts: many(payouts),
}));

export const publisherMembersRelations = relations(
  publisherMembers,
  ({ one }) => ({
    publisher: one(publishers, {
      fields: [publisherMembers.publisherId],
      references: [publishers.id],
    }),
    user: one(user, {
      fields: [publisherMembers.userId],
      references: [user.id],
    }),
  }),
);

export const channelsRelations = relations(channels, ({ one, many }) => ({
  publisher: one(publishers, {
    fields: [channels.publisherId],
    references: [publishers.id],
  }),
  streamKeys: many(channelStreamKeys),
  followers: many(channelFollowers),
  analyticsDaily: many(analyticsDaily),
}));
