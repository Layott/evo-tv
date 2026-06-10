import { pgTable, text, index } from "drizzle-orm/pg-core";

/**
 * Pre-launch waitlist. Visitors on the marketing website reserve an email +
 * username now and claim it in-app at launch. Email + username are both unique.
 */
export const waitlist = pgTable(
  "waitlist",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    username: text("username").notNull().unique(),
    source: text("source").notNull().default("web"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("waitlist_created_idx").on(t.createdAt)],
);
