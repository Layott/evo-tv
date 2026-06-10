import { pgTable, text, boolean, index } from "drizzle-orm/pg-core";

/**
 * Pre-launch waitlist. Visitors on the marketing website reserve an email +
 * username now and confirm it by clicking a link emailed to them.
 *
 * A username is "held" while it is verified, or unverified but reserved within
 * the last 24 hours. After 24 hours unverified, it opens up for someone else.
 */
export const waitlist = pgTable(
  "waitlist",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    username: text("username").notNull().unique(),
    source: text("source").notNull().default("web"),
    createdAt: text("created_at").notNull(),
    verified: boolean("verified").notNull().default(false),
    verifyToken: text("verify_token"),
    verifiedAt: text("verified_at"),
  },
  (t) => [index("waitlist_created_idx").on(t.createdAt)],
);
