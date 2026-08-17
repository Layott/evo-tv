import { roleRank } from "@/lib/auth/role-catalog";

/**
 * Who gets the paid experience: no ads, premium VODs, premium chat rooms.
 *
 * This used to be `role === "premium"`, in fourteen places, and role and
 * subscription were the same column. Two things followed from that, and both
 * are the kind of bug a customer notices before you do.
 *
 * Paying **overwrote** the role. Anybody on staff who bought a subscription was
 * demoted to `premium` and lost their staff access; cancelling made them a plain
 * `user`. Found by promoting a walkthrough account to `head_admin`, exercising
 * checkout with it, and watching every admin route start answering 403.
 *
 * Guarding the role against being overwritten then exposed the other half: with
 * the role left alone, `role === "premium"` is false for an admin or a creator,
 * so somebody who had just paid got **none of what they paid for**. The two
 * facts were never the same fact.
 *
 * So entitlement is computed, from two independent inputs:
 *
 * - an active subscription, which is what a viewer buys, and
 * - being staff, because support and moderation cannot review content they are
 *   locked out of, and an ad-free product is not the perk here.
 *
 * A creator is deliberately not on that list. Creator is a relationship with the
 * platform, not a purchase, and a creator who wants Premium buys it like anyone
 * else.
 */

/** The weakest role that gets the paid experience without paying. */
const STAFF_FLOOR = "support_admin";

export function isPremiumViewer(input: {
  role: string | null | undefined;
  hasActiveSubscription: boolean;
}): boolean {
  if (input.hasActiveSubscription) return true;
  return roleRank(input.role) >= roleRank(STAFF_FLOOR);
}

/**
 * Whether this role is staff, for the places that want to say "you are staff"
 * rather than "you can watch this".
 */
export function isStaff(role: string | null | undefined): boolean {
  return roleRank(role) >= roleRank(STAFF_FLOOR);
}
