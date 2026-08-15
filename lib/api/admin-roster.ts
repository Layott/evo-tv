import "server-only";
import { and, count, inArray, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { RANK, roleRank, type PlatformRole } from "@/lib/auth/roles";

/**
 * The floor under the admin roster.
 *
 * `canGrantRole` answers "may this actor hand out that role". It cannot answer
 * "would this leave the platform with nobody who can hand out roles at all",
 * because that needs a row count. Every path that can strip or remove a
 * top-level admin goes through here first: PATCH /api/admin/users,
 * POST /api/admin/users/bulk, POST /api/admin/users/promote and the account
 * self-delete on DELETE /api/users/me.
 *
 * Losing the last one is unrecoverable from inside the product: with zero
 * admins nobody can promote anybody, and the only way back is a hand-written
 * UPDATE against production Postgres.
 */

/** Roles that can administer the platform. Ranked at or above `admin`. */
export const TOP_LEVEL_ROLES: PlatformRole[] = ["admin", "head_admin"];

export function isTopLevelRole(role: string | null | undefined): boolean {
  return roleRank(role) >= RANK.admin;
}

/**
 * How many live accounts still hold a top-level role.
 *
 * Soft-deleted accounts do not count: an account with `deletedAt` set is on
 * its way to the GDPR purge and cannot sign in, so it cannot administer
 * anything.
 */
export async function countTopLevelAdmins(): Promise<number> {
  const row = (
    await db
      .select({ value: count() })
      .from(schema.user)
      .where(
        and(
          inArray(schema.user.role, TOP_LEVEL_ROLES),
          isNull(schema.user.deletedAt),
        ),
      )
  )[0];
  return row?.value ?? 0;
}

/** Same count, ignoring one account. Used to ask "who is left if this one goes". */
export async function countOtherTopLevelAdmins(
  excludeUserId: string,
): Promise<number> {
  const row = (
    await db
      .select({ value: count() })
      .from(schema.user)
      .where(
        and(
          inArray(schema.user.role, TOP_LEVEL_ROLES),
          isNull(schema.user.deletedAt),
          ne(schema.user.id, excludeUserId),
        ),
      )
  )[0];
  return row?.value ?? 0;
}

/**
 * True when moving `userId` from `currentRole` to `nextRole` would empty the
 * admin roster. Only a top-level account being moved off a top-level role can
 * do that, so anything else short-circuits without a query.
 */
export async function wouldEmptyAdminRoster(
  userId: string,
  currentRole: string | null | undefined,
  nextRole: PlatformRole,
): Promise<boolean> {
  if (!isTopLevelRole(currentRole)) return false;
  if (isTopLevelRole(nextRole)) return false;
  return (await countOtherTopLevelAdmins(userId)) === 0;
}

/** True when removing `userId` outright would empty the admin roster. */
export async function wouldEmptyAdminRosterOnRemoval(
  userId: string,
  currentRole: string | null | undefined,
): Promise<boolean> {
  if (!isTopLevelRole(currentRole)) return false;
  return (await countOtherTopLevelAdmins(userId)) === 0;
}

/** One message, so every refusal reads the same wherever it is raised. */
export const LAST_ADMIN_MESSAGE =
  "This is the last account with admin access. Promote another admin first, " +
  "otherwise nobody would be able to administer the platform.";
