/**
 * Four rooms, not four rungs.
 *
 * The ladder in `role-catalog.ts` says a finance admin can do everything a
 * moderator can, and a moderator everything support can, because a higher rank
 * satisfies every requirement below it. That is right for seniority and wrong
 * for jobs: money, moderation, editorial and broadcast are four different
 * rooms, and somebody who plans the week has no business ending a broadcast or
 * reading order history.
 *
 * So rank keeps doing what it is good at, which is deciding who may grant what,
 * and a capability decides who may open which room. A role holds a set of them.
 * Nothing is inherited: `programmer` does not get moderation for being ranked
 * above support.
 *
 * Pure on purpose, like the catalogue beside it: the nav filters on the same
 * table the API enforces, so a screen never offers a door that answers 403.
 */
import { type PlatformRole } from "./role-catalog";

export type Capability =
  /** Shows, episodes, library, schedule, the EPG grid. Planning the week. */
  | "editorial"
  /** Streams, ingest keys, playout, End broadcast. The control room. */
  | "broadcast"
  /** Orders, subscriptions, refunds, price windows, ads. */
  | "commerce"
  /** Reports, sanctions, chat. */
  | "community"
  /** Read accounts and orders to answer a ticket. Changes nothing. */
  | "support"
  /** Granting roles, and the staff list. */
  | "roster"
  /** The audit log in full, including head admin's own rows. */
  | "audit_full";

export interface RoomInfo {
  value: Capability;
  label: string;
  /** What it unlocks, in the words somebody granting it would use. */
  summary: string;
}

export const ROOMS: RoomInfo[] = [
  {
    value: "editorial",
    label: "Editorial",
    summary: "Shows, episodes, library and the schedule. Plans what airs.",
  },
  {
    value: "broadcast",
    label: "Broadcast",
    summary:
      "Streams, ingest keys, playout files and ending a broadcast. The control room.",
  },
  {
    value: "commerce",
    label: "Commerce",
    summary: "Orders, subscriptions, refunds, prices and ads.",
  },
  {
    value: "community",
    label: "Community",
    summary: "Reports, sanctions and chat.",
  },
  {
    value: "support",
    label: "Support",
    summary: "Reads accounts and orders to answer tickets. Changes nothing.",
  },
  {
    value: "roster",
    label: "Roster",
    summary: "The staff list, and granting roles.",
  },
  {
    value: "audit_full",
    label: "Audit",
    summary: "The audit log in full, head admin's own actions included.",
  },
];

const ALL_ROOMS: Capability[] = [
  "editorial",
  "broadcast",
  "commerce",
  "community",
  "support",
  "roster",
];

/**
 * What each role can open.
 *
 * `admin` holds every room; `head_admin` adds the full audit log. The two new
 * roles hold exactly one room each, which is the entire point of them: a
 * programmer cannot rotate a stream key and a broadcast operator cannot cancel
 * somebody's subscription.
 */
export const CAPABILITIES: Record<PlatformRole, Capability[]> = {
  guest: [],
  user: [],
  premium: [],
  // A creator's reach is their own channel, scoped per publisher in guards.ts
  // rather than here. None of these rooms is theirs.
  creator: [],
  support_admin: ["support"],
  programmer: ["editorial"],
  broadcast_op: ["broadcast"],
  moderator: ["community"],
  finance_admin: ["commerce", "support"],
  admin: ALL_ROOMS,
  head_admin: [...ALL_ROOMS, "audit_full"],
};

export function capabilitiesFor(role: string | null | undefined): Capability[] {
  if (!role) return [];
  return CAPABILITIES[role as PlatformRole] ?? [];
}

/** The one comparison. Unknown roles hold nothing, so a typo grants nothing. */
export function hasCapability(
  role: string | null | undefined,
  capability: Capability,
): boolean {
  return capabilitiesFor(role).includes(capability);
}

/** True for anyone who can open any room at all, so the dashboard is worth showing. */
export function isStaffRole(role: string | null | undefined): boolean {
  return capabilitiesFor(role).length > 0;
}
