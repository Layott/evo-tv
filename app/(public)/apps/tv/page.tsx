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
  title: "EVO TV on your television",
  description: "Apps for smart TVs and streaming boxes. Not released yet.",
  path: "/apps/tv",
});


export default function Page() {
  return (
    <ComingSoon
      title="EVO TV on your TV"
      description="There is no smart TV build yet. A browser on a phone or a laptop is the only way to watch today."
    />
  );
}
