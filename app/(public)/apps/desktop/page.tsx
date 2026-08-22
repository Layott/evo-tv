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
  title: "EVO TV for desktop",
  description: "A desktop app for Windows and macOS. Not released yet.",
  path: "/apps/desktop",
});


export default function Page() {
  return (
    <ComingSoon
      title="EVO TV on desktop"
      description="There is no desktop build, and there may never need to be: everything works in a browser already."
    />
  );
}
