import { pgTable, text, index } from "drizzle-orm/pg-core";
import { user } from "./users";

/**
 * Forensic log of every successful sign-in. Used by admin to:
 *   - detect ban-evasion (same IP / fingerprint across multiple accounts)
 *   - investigate account takeover claims
 *   - audit who-logged-in-when-from-where
 *
 * IPs are stored as sha256(ip + salt) so we keep correlation without
 * holding raw PII.
 */
export const loginEvents = pgTable(
  "login_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** sha256(ip + LOGIN_HASH_SALT). */
    ipHash: text("ip_hash"),
    /** Where they were, as Cloudflare reports it: "Lagos, LA, NG". City and
     * region need the "Add visitor location headers" managed transform; the
     * country arrives regardless. Read from Vercel headers until August, which
     * is why every row from the droplet era says nothing. */
    region: text("region"),
    userAgent: text("user_agent"),
    /** Stable per-device fingerprint set by RN client header `x-device-id`. */
    deviceFp: text("device_fp"),
    /** 'email' | 'social' | 'api-key'. */
    method: text("method").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("login_events_user_idx").on(t.userId, t.createdAt),
    index("login_events_ip_idx").on(t.ipHash),
    index("login_events_fp_idx").on(t.deviceFp),
  ],
);

export type LoginEvent = typeof loginEvents.$inferSelect;
