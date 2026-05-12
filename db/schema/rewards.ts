import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./users";

/**
 * Wallet — shared by rewards, tips, and predictions.
 *
 * One row per user. `coins` is the spendable EVO Coin balance; `xp` is the
 * lifetime XP used to derive Bronze / Silver / Gold / Platinum / Diamond tier
 * client-side.
 */
export const coinBalances = pgTable("coin_balances", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  coins: integer("coins").notNull().default(0),
  xp: integer("xp").notNull().default(0),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .notNull()
    .defaultNow(),
});

/**
 * Rewards drops — the redeemable catalog. Populated via seed + admin panel.
 */
export const rewardsDrops = pgTable(
  "rewards_drops",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    kind: text("kind", {
      enum: ["cosmetic", "premium-trial", "merch-voucher"],
    }).notNull(),
    cost: integer("cost").notNull(),
    stock: integer("stock").notNull(),
    imageUrl: text("image_url").notNull().default(""),
    partner: text("partner").notNull().default(""),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default(""),
    rarity: text("rarity", {
      enum: ["common", "rare", "epic", "legendary"],
    })
      .notNull()
      .default("common"),
    expiresAt: timestamp("expires_at", { mode: "string" }),
    active: integer("active").notNull().default(1),
  },
  (t) => [
    index("rewards_drops_kind_idx").on(t.kind),
    index("rewards_drops_category_idx").on(t.category),
  ],
);

/**
 * Rewards redemptions — when a user spends coins on a drop. The `code` is
 * issued at redemption time and used to claim externally.
 */
export const rewardsRedemptions = pgTable(
  "rewards_redemptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dropId: text("drop_id")
      .notNull()
      .references(() => rewardsDrops.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    cost: integer("cost").notNull(),
    status: text("status", { enum: ["pending", "delivered", "expired"] })
      .notNull()
      .default("delivered"),
    redeemedAt: timestamp("redeemed_at", { mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("rewards_redemptions_user_idx").on(t.userId),
    index("rewards_redemptions_drop_idx").on(t.dropId),
  ],
);

/**
 * XP events — append-only log of XP grants. Used to render the activity
 * timeline + audit trail. Sum of `points` for a user should match
 * coinBalances.xp (we update both in the same transaction).
 */
export const xpEvents = pgTable(
  "xp_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    source: text("source", {
      enum: [
        "watch_minute",
        "stream_finish",
        "quest_complete",
        "first_watch_of_day",
        "weekly_bonus",
        "tip_sent",
        "vod_like",
      ],
    }).notNull(),
    points: integer("points").notNull(),
    at: timestamp("at", { mode: "string" }).notNull().defaultNow(),
  },
  (t) => [index("xp_events_user_idx").on(t.userId)],
);

/**
 * Tips — coin transfers from viewer to streamer / creator. Bounded by the
 * sender's `coin_balances.coins`. Streamer/creator is identified by user id
 * (channels are users in this schema).
 */
export const tips = pgTable(
  "tips",
  {
    id: text("id").primaryKey(),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    streamId: text("stream_id"),
    coins: integer("coins").notNull(),
    message: text("message").notNull().default(""),
    at: timestamp("at", { mode: "string" }).notNull().defaultNow(),
  },
  (t) => [
    index("tips_from_idx").on(t.fromUserId),
    index("tips_to_idx").on(t.toUserId),
  ],
);
