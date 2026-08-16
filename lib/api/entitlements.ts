import "server-only";
import { and, eq, gt, inArray } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { roleRank, RANK } from "@/lib/auth/role-catalog";

/**
 * What a viewer is entitled to, in one place.
 *
 * Until now "premium" meant a badge on a profile and a label on a card. The
 * tiers page has been promising an ad-free channel and early access since the
 * day it was written, and nothing in the codebase enforced either, because
 * there was nothing to enforce them against. Now that the channel has ad
 * breaks, "ad-free" has to mean something, and it has to mean the same thing
 * everywhere it is asked.
 *
 * Two ways to hold an entitlement, deliberately:
 *
 * - an **active subscription** on the `premium` tier, which is what a viewer
 *   buys, and
 * - a **role at or above `premium`**, which is how staff and comped accounts
 *   are handled without inventing a fake payment.
 */
export interface Entitlements {
  /** No pre-roll, no mid-roll, no filler ads. */
  adFree: boolean;
  /** Sees an episode during its early-access window. */
  earlyAccess: boolean;
  /** Marked in chat, and exempt from the slow mode. */
  chatPerks: boolean;
}

export const NO_ENTITLEMENTS: Entitlements = {
  adFree: false,
  earlyAccess: false,
  chatPerks: false,
};

/**
 * A subscription counts while it is `active` and its period has not lapsed.
 *
 * `past_due` deliberately keeps the perks: a failed renewal is usually a bank,
 * not a decision, and taking the ads away and giving them back is a worse
 * experience than carrying somebody for a few days.
 */
export async function getEntitlements(
  userId: string | null | undefined,
  role?: string | null,
): Promise<Entitlements> {
  if (roleRank(role) >= RANK.premium) {
    return { adFree: true, earlyAccess: true, chatPerks: true };
  }
  if (!userId) return NO_ENTITLEMENTS;

  const rows = await db
    .select({ tier: schema.subscriptions.tier })
    .from(schema.subscriptions)
    .where(
      and(
        eq(schema.subscriptions.userId, userId),
        eq(schema.subscriptions.tier, "premium"),
        inArray(schema.subscriptions.status, ["active", "past_due"]),
        gt(schema.subscriptions.currentPeriodEnd, new Date().toISOString()),
      ),
    )
    .limit(5);

  const subscribed = rows.length > 0;
  return {
    adFree: subscribed,
    earlyAccess: subscribed,
    chatPerks: subscribed,
  };
}
