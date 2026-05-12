import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./users";
import { matches } from "./events";

/**
 * Match-level prediction picks. Each row = one user staking N EVO coins on
 * one team for one match. status=open while match is unresolved; flipped to
 * won/lost via admin resolve; payout_coins credited on win.
 *
 * Coin debit/credit hits coin_balances via db.transaction in the route.
 */
export const predictionPicks = pgTable(
  "prediction_picks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    teamPickedId: text("team_picked_id").notNull(),
    coinsStaked: integer("coins_staked").notNull(),
    status: text("status", { enum: ["open", "won", "lost"] })
      .notNull()
      .default("open"),
    payoutCoins: integer("payout_coins").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "string" }),
  },
  (t) => [
    index("prediction_picks_user_idx").on(t.userId),
    index("prediction_picks_match_idx").on(t.matchId),
    index("prediction_picks_status_idx").on(t.status),
  ],
);
