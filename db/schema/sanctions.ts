import { pgTable, text, index } from "drizzle-orm/pg-core";
import { user } from "./users";

/**
 * Admin-issued sanctions against users.
 *
 * - `kind = 'suspended'`  → account disabled, all sessions revoked,
 *                            sign-in blocked while active
 * - `kind = 'banned'`     → same as suspended + signup re-block + email
 *                            cannot re-register
 * - `kind = 'chat_banned'` → user can sign-in + browse, but chat POSTs
 *                            in any channel return 403 while active
 *
 * Active sanction = `revertedAt IS NULL AND (expiresAt IS NULL OR expiresAt > now())`.
 * Sanctions are append-only; reverting sets `revertedAt + revertedBy`.
 */
export const userSanctions = pgTable(
  "user_sanctions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    reason: text("reason").notNull(),
    issuedBy: text("issued_by")
      .notNull()
      .references(() => user.id),
    /** ISO timestamp. NULL = permanent. */
    expiresAt: text("expires_at"),
    revertedAt: text("reverted_at"),
    revertedBy: text("reverted_by").references(() => user.id),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("user_sanctions_user_idx").on(t.userId),
    index("user_sanctions_kind_idx").on(t.kind),
    index("user_sanctions_active_idx").on(t.userId, t.kind, t.revertedAt),
  ],
);

export type UserSanction = typeof userSanctions.$inferSelect;
