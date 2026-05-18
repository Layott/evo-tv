import { pgTable, text, integer, index } from "drizzle-orm/pg-core";
import { user } from "./users";

/**
 * Creator-program applications. One row per user (unique on userId so a
 * resubmit replaces the prior application).
 *
 * Status lifecycle: submitted → in_review → approved | rejected.
 * Once approved, an out-of-band process flips the user's role to a
 * partner-creator role (handled by admin tooling, not this table).
 */
export const creatorApplications = pgTable(
  "creator_applications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    bio: text("bio").notNull(),
    country: text("country").notNull(),
    primaryGameId: text("primary_game_id").notNull(),
    socialPlatform: text("social_platform", {
      enum: ["youtube", "twitch", "tiktok", "kick", "other"],
    }).notNull(),
    socialHandle: text("social_handle").notNull(),
    followerCount: integer("follower_count").notNull().default(0),
    agreementAccepted: integer("agreement_accepted").notNull().default(0),
    status: text("status", {
      enum: ["submitted", "in_review", "approved", "rejected"],
    })
      .notNull()
      .default("submitted"),
    submittedAt: text("submitted_at").notNull(),
    reviewedAt: text("reviewed_at"),
    reviewerNote: text("reviewer_note"),
  },
  (t) => [index("creator_apps_status_idx").on(t.status, t.submittedAt)],
);
