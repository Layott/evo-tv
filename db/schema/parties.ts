import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./users";
import { streams } from "./streaming";

/**
 * Watch parties — synced playback rooms anchored to a live stream.
 * Host controls play/pause/seek; members see same playhead.
 * SSE topic `party:<id>:sync` broadcasts host actions.
 */
export const parties = pgTable(
  "parties",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    hostUserId: text("host_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    streamId: text("stream_id").references(() => streams.id, {
      onDelete: "set null",
    }),
    maxMembers: integer("max_members").notNull().default(20),
    isPrivate: boolean("is_private").notNull().default(false),
    inviteCode: text("invite_code"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }),
  },
  (t) => [
    index("parties_host_idx").on(t.hostUserId),
    index("parties_invite_idx").on(t.inviteCode),
  ],
);

export const partyMembers = pgTable(
  "party_members",
  {
    partyId: text("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true, mode: "string" }),
  },
  (t) => [
    primaryKey({ columns: [t.partyId, t.userId] }),
    index("party_members_user_idx").on(t.userId),
  ],
);

/**
 * Persistent party chat (Phase 7.1 follow-up).
 * Append-only; broadcast via SSE topic `party:<id>:chat` on insert.
 */
export const partyMessages = pgTable(
  "party_messages",
  {
    id: text("id").primaryKey(),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("party_messages_party_created_idx").on(t.partyId, t.createdAt),
  ],
);
