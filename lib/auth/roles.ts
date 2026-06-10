import "server-only";

/**
 * Platform-level RBAC ladder.
 *
 * Higher rank = more permissions. `hasMinRole(actual, min)` is the
 * canonical comparison. App-level admin and head_admin bypass everything
 * below them; head_admin is the only role that can mint other admin roles.
 *
 * Publisher-scoped RBAC (owner/admin/editor/viewer) lives in guards.ts
 * and is independent of this ladder — a regular `user` can still be a
 * publisher owner on their own channel.
 */
export type PlatformRole =
  | "guest"
  | "user"
  | "premium"
  | "creator"
  | "support_admin"
  | "moderator"
  | "finance_admin"
  | "admin"
  | "head_admin";

export const RANK: Record<PlatformRole, number> = {
  guest: 0,
  user: 1,
  premium: 2,
  // Creator is a content-producer role, above premium but not an admin tier.
  creator: 5,
  support_admin: 10,
  moderator: 20,
  finance_admin: 30,
  admin: 40,
  head_admin: 100,
};

const VALID_ROLES = Object.keys(RANK) as PlatformRole[];

export function isPlatformRole(value: unknown): value is PlatformRole {
  return typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value);
}

export function roleRank(role: string | null | undefined): number {
  if (!role || !isPlatformRole(role)) return 0;
  return RANK[role];
}

export function hasMinRole(
  actual: string | null | undefined,
  min: PlatformRole,
): boolean {
  return roleRank(actual) >= RANK[min];
}

/**
 * Who can grant which role to other users.
 *
 *   head_admin  → any role
 *   admin       → moderator, finance_admin, support_admin, user, premium
 *   anyone else → nothing
 */
export function canGrantRole(
  actor: string | null | undefined,
  target: PlatformRole,
): boolean {
  if (actor === "head_admin") return true;
  if (actor === "admin") {
    return (
      target === "moderator" ||
      target === "finance_admin" ||
      target === "support_admin" ||
      target === "creator" ||
      target === "user" ||
      target === "premium"
    );
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
