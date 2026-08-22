import type { Metadata } from "next";

/**
 * A bracket is a view of an event, not a page worth its own search result.
 *
 * Indexing it would put two results in front of the same searcher for the same
 * tournament, and the bracket is the less useful of the two to arrive on cold.
 * `follow` stays on so the links out to teams and matches still count.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
};

export default function BracketLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
