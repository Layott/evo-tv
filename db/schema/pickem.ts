import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { user } from "./users";
import { events } from "./events";

/**
 * Bracket pick'em. One entry per (user, event) — picks stored as JSON
 * because the bracket shape is fixed per event. Score computed by the
 * resolve route or a cron.
 */
export const pickemEntries = pgTable(
  "pickem_entries",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    picks: jsonb("picks")
      .$type<{ matchId: string; winnerTeamId: string }[]>()
      .notNull(),
    score: integer("score").notNull().default(0),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.userId] }),
    index("pickem_entries_event_idx").on(t.eventId),
    index("pickem_entries_score_idx").on(t.eventId, t.score),
  ],
);
