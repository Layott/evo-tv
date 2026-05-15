import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./users";

/**
 * Personal API keys for users — used by external integrations to call
 * the EVO TV API without a session. Keys are hashed at rest; the plain
 * value is returned ONCE on create and never persisted.
 *
 * Auth middleware (separate change) will accept `X-API-Key: <plain>`
 * by sha256-hashing + matching key_hash, then loading user_id.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** sha256(plain) — 64 hex chars. */
    keyHash: text("key_hash").notNull().unique(),
    /** First 12 chars of plain (e.g. "evo_a3b1c2d4") for identification in UI. */
    prefix: text("prefix").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
  },
  (t) => [
    index("api_keys_user_idx").on(t.userId),
    index("api_keys_hash_idx").on(t.keyHash),
  ],
);
