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
  title: "Match calendar",
  description: "Fixtures and results across every competition EVO TV covers. Not published yet.",
  path: "/calendar",
});


export default function Page() {
  return <ComingSoon title="Calendar" description="Add matches and shows to your calendar." />;
}
