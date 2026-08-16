import "server-only";

import type { Episode, Show } from "@/lib/types";
import type { Entitlements } from "@/lib/api/entitlements";

/**
 * Whether this viewer may watch this episode, and if not, why not.
 *
 * Early access needed no new column. An episode already carries two dates:
 * `premiereAt`, when it airs on the channel, and `releasedAt`, when it is
 * available on demand to everyone. The gap between them is the early-access
 * window, and a paid viewer watches inside it.
 *
 * That makes the tier page's "early access" claim true with the data that is
 * already there, and it gives the schedule something real to point at: an
 * episode that has aired but is not yet released is exactly the thing worth
 * paying to see now rather than on Friday.
 *
 * The premium flag is separate and stricter: a paid show stays paid after its
 * release date, where an early-access episode opens to everybody.
 */
export type EpisodeAccessReason =
  /** Watchable. */
  | "ok"
  /** Aired, not yet released to everyone, and this viewer is not premium. */
  | "early_access"
  /** A paid show or episode, and this viewer has not paid. */
  | "premium_only"
  /** Has not aired at all yet. Nobody watches this, premium or otherwise. */
  | "unaired";

export interface EpisodeAccess {
  canWatch: boolean;
  reason: EpisodeAccessReason;
  /** When it opens to this viewer, ISO, or null when that is already now. */
  availableAt: string | null;
}

function isFuture(iso: string | null | undefined, now: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t > now;
}

export function episodeAccess(
  episode: Pick<Episode, "premiereAt" | "releasedAt" | "isPremium">,
  show: Pick<Show, "isPremium">,
  entitlements: Entitlements,
  now: number = Date.now(),
): EpisodeAccess {
  // Nothing has aired yet: not even a subscription buys a look at it early,
  // because it does not exist to be watched.
  if (isFuture(episode.premiereAt, now)) {
    return { canWatch: false, reason: "unaired", availableAt: episode.premiereAt };
  }

  const paid = episode.isPremium ?? show.isPremium ?? false;
  if (paid && !entitlements.premiumContent) {
    return { canWatch: false, reason: "premium_only", availableAt: null };
  }

  if (isFuture(episode.releasedAt, now)) {
    if (entitlements.earlyAccess) {
      return { canWatch: true, reason: "ok", availableAt: null };
    }
    return {
      canWatch: false,
      reason: "early_access",
      availableAt: episode.releasedAt,
    };
  }

  return { canWatch: true, reason: "ok", availableAt: null };
}
