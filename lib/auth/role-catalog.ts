/**
 * What each platform role is for, in one place.
 *
 * `lib/auth/roles.ts` is `server-only`, so nothing in the browser could read
 * the ladder: the roles screen offered three of the nine roles because those
 * three were hardcoded in the component, and `moderator`, `finance_admin` and
 * `support_admin` existed in the database and in every guard while being
 * unassignable from the dashboard.
 *
 * This module is pure so both sides can import it. `roles.ts` re-exports the
 * rank map from here rather than keeping its own copy, because two ladders that
 * disagree is exactly the bug that ships as "the admin page let me do it but
 * the API said no".
 *
 * The ladder is a ladder: a higher rank satisfies every requirement below it.
 * The tiers are deliberately spaced so a role can be inserted between two of
 * them without renumbering the rest.
 */

export type PlatformRole =
  | "guest"
  | "user"
  | "premium"
  | "creator"
  | "support_admin"
  | "programmer"
  | "broadcast_op"
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
  /*
   * The two room roles sit above support and below moderator on purpose.
   *
   * Rank is seniority: who may grant what, and who outranks whom. It is no
   * longer what opens a room, because a ladder would hand a programmer every
   * moderation power for being ranked above it. Rooms come from
   * `capabilities.ts`, and these two hold exactly one each.
   */
  programmer: 15,
  broadcast_op: 15,
  moderator: 20,
  finance_admin: 30,
  admin: 40,
  head_admin: 100,
};

const VALID_ROLES = Object.keys(RANK) as PlatformRole[];

export function isPlatformRole(value: unknown): value is PlatformRole {
  return (
    typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value)
  );
}

/** Anything unrecognised ranks as a guest, so a typo never grants access. */
export function roleRank(role: string | null | undefined): number {
  if (!role || !isPlatformRole(role)) return 0;
  return RANK[role];
}

/**
 * The canonical comparison, and the reason this is not a set of equality
 * checks. `role === "admin"` is false for a head_admin, which is how the admin
 * dashboard came to lock out the highest role on the platform.
 */
export function hasMinRole(
  actual: string | null | undefined,
  min: PlatformRole,
): boolean {
  return roleRank(actual) >= RANK[min];
}

export interface RoleInfo {
  value: PlatformRole;
  label: string;
  /** One line, in the words an operator granting it would use. */
  summary: string;
  /** True for the tiers that can reach the admin dashboard at all. */
  isStaff: boolean;
  /** Whether this role can be handed out from the roster screen. */
  assignable: boolean;
}

export const ROLE_CATALOG: RoleInfo[] = [
  {
    value: "guest",
    label: "Guest",
    summary:
      "Signed out. Never granted: giving it to an account locks it out rather than demoting it.",
    isStaff: false,
    assignable: false,
  },
  {
    value: "user",
    label: "User",
    summary: "A normal account. Free content only.",
    isStaff: false,
    assignable: true,
  },
  {
    value: "premium",
    label: "Premium",
    summary: "Past the paywall. Granted here only for comps and staff; paying members get it from Paystack.",
    isStaff: false,
    assignable: true,
  },
  {
    value: "creator",
    label: "Creator",
    summary:
      "A content partner. Not assignable: every creator screen is still Coming Soon, so granting it changes nothing a person can see.",
    isStaff: false,
    // Deliberately off the list. The creator dashboard, its clips, audience and
    // earnings pages are all ComingSoon, so this role was an option that did
    // nothing, which is worse than an option that is absent.
    assignable: false,
  },
  {
    value: "support_admin",
    label: "Support",
    summary: "Reads accounts and orders to answer tickets. Changes nothing that a viewer sees.",
    isStaff: true,
    assignable: true,
  },
  {
    value: "programmer",
    label: "Programmer",
    summary:
      "Plans what airs: shows, episodes, library, calendar and the schedule. No streams, no money, no roles.",
    isStaff: true,
    assignable: true,
  },
  {
    value: "broadcast_op",
    label: "Broadcast",
    summary:
      "The control room: streams, ingest keys, playout and ending a broadcast. Nothing editorial.",
    isStaff: true,
    assignable: true,
  },
  {
    value: "moderator",
    label: "Moderator",
    summary:
      "Chat, reports and sanctions, plus read access to the library. Cannot publish or change the schedule.",
    isStaff: true,
    assignable: true,
  },
  {
    value: "finance_admin",
    label: "Finance",
    summary: "Orders, subscriptions and payouts. No editorial control.",
    isStaff: true,
    assignable: true,
  },
  {
    value: "admin",
    label: "Admin",
    summary:
      "Everything a viewer sees: shows, schedule, streams, ads, roles. Can add other admins.",
    isStaff: true,
    assignable: true,
  },
  {
    value: "head_admin",
    label: "Head admin",
    summary:
      "Admin, plus the audit log in full and the only role that can grant head admin.",
    isStaff: true,
    assignable: true,
  },
];

const BY_VALUE = new Map(ROLE_CATALOG.map((r) => [r.value, r]));

export function roleInfo(role: string | null | undefined): RoleInfo | null {
  return role ? (BY_VALUE.get(role as PlatformRole) ?? null) : null;
}

export function roleLabel(role: string | null | undefined): string {
  return roleInfo(role)?.label ?? "User";
}

/** Roles that can be handed out, weakest first. `guest` is never among them. */
export const ASSIGNABLE_ROLES: RoleInfo[] = ROLE_CATALOG.filter((r) => r.assignable);
