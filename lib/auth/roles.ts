import "server-only";

/**
 * Platform-level RBAC ladder.
 *
 * Higher rank = more permissions. `hasMinRole(actual, min)` is the
 * canonical comparison. App-level admin and head_admin bypass everything
 * below them; head_admin is the only role that can mint other admin roles.
 *
 * Publisher-scoped RBAC (owner/admin/editor/viewer) lives in guards.ts
 * and is independent of this ladder - a regular `user` can still be a
 * publisher owner on their own channel.
 */
/**
 * The ladder itself lives in `role-catalog.ts`, which is pure, so the browser
 * can read it too. Re-exported here because every server call site imports
 * `PlatformRole` and `RANK` from this module.
 */
export {
  RANK,
  hasMinRole,
  isPlatformRole,
  roleRank,
  type PlatformRole,
} from "./role-catalog";

import type { PlatformRole } from "./role-catalog";

/**
 * Who can grant which role to other users.
 *
 *   head_admin  → any role
 *   admin       → anything up to and including its own tier, never head_admin
 *                 and never guest (guest is the signed-out sentinel, granting
 *                 it would lock an account out rather than demote it)
 *   anyone else → nothing
 *
 * An admin granting `admin` is the "admins can add admins" product rule. It is
 * an equal-rank grant, never an upward one: nobody mints a role above their
 * own. What keeps that safe is enforced at the route rather than here, because
 * it needs to count rows: an admin cannot change its own role, and the last
 * remaining top-level admin cannot be demoted at all. See
 * `lib/api/admin-roster.ts`.
 */
export function canGrantRole(
  actor: string | null | undefined,
  target: PlatformRole,
): boolean {
  if (actor === "head_admin") return true;
  if (actor === "admin") {
    return target !== "head_admin" && target !== "guest";
  }
  return false;
}

/**
 * Who can read the admin audit log.
 *   head_admin sees everyone's actions.
 *   admin sees everyone's actions except head_admin's.
 *   moderator / finance_admin / support_admin see only their own actions.
 */
export function canReadAuditLog(
  reader: string | null | undefined,
  targetActorRole?: string | null,
): boolean {
  if (reader === "head_admin") return true;
  if (reader === "admin") return targetActorRole !== "head_admin";
  return false;
}
