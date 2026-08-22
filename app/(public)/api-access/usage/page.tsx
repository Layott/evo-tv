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
  title: "API usage",
  description: "Request volume and rate limits for your EVO TV API keys. Not published yet.",
  path: "/api-access/usage",
});


export default function Page() {
  return (
    <ComingSoon
      title="API access"
      description="Public API keys, docs and usage."
    />
  );
}
