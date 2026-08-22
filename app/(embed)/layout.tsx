// Bare layout for /embed and /embed/player/[id] - no shell, no nav. Lives inside
// a route group so the segments stay at /embed and /embed/player.
import type { Metadata } from "next";

/**
 * An embed is meant to sit inside somebody else's page, not to be a result.
 *
 * Indexed on its own it would compete with the real stream page for the same
 * content, which is duplication we would be doing to ourselves.
 *
 * A layout's metadata applies to every page under it, so this one line covers
 * the whole group and cannot be forgotten on the next page added to it.
 * `follow` stays on: a crawler that lands here should still walk the links out
 * to the pages that are worth indexing.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
};


export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
