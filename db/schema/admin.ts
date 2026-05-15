import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./users";

/**
 * Tamper-evident audit log of every platform-admin action.
 *
 * Every mutation issued by an admin/moderator/finance_admin/support_admin/
 * head_admin route must record one row via `lib/audit/log.ts:recordAudit`.
 *
 * - `actorUserId` — who did it
 * - `action` — namespaced verb, e.g. "stream.force_end", "user.suspend",
 *   "role.grant", "tip.refund"
 * - `targetType` + `targetId` — what was acted on (stream, user, channel,
 *   tip, order, role, …)
 * - `details` — arbitrary JSON payload; never include raw secrets
 * - `ipHash` — sha256(req.ip) for ban-evasion / forensic correlation
 *
 * Reads gated by `canReadAuditLog` in `lib/auth/roles.ts` — head_admin sees
 * everyone's actions, admin sees everyone except head_admin's.
 */
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    details: jsonb("details").notNull(),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("admin_audit_log_actor_idx").on(t.actorUserId, t.createdAt),
    index("admin_audit_log_target_idx").on(t.targetType, t.targetId, t.createdAt),
    index("admin_audit_log_action_idx").on(t.action, t.createdAt),
  ],
);

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
