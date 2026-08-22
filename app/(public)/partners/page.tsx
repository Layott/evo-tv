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
  title: "Partners",
  description: "Brands and organisers working with EVO TV. Not published yet.",
  path: "/partners",
});


export default function Page() {
  return (
    <ComingSoon
      title="Partners"
      description="Partner odds and promotions."
    />
  );
}
