import { ComingSoon } from "@/components/shell/coming-soon";

import { comingSoonMetadata } from "@/lib/seo/metadata";

/*
 * Kept out of the index while it says "coming soon".
 *
 * A searcher who lands on a page that cannot do anything for them costs more
 * than the page could ever earn, and Google reads the pattern as a thin site.
 * Delete this export the day the screen does something.
 */
export const metadata = comingSoonMetadata({
  title: "Co-stream",
  description: "Watch alongside a creator’s commentary. Not released yet.",
  path: "/stream",
});


export default function Page() {
  return (
    <ComingSoon
      title="Co-streams"
      description="Community co-streams alongside the main feed."
    />
  );
}
