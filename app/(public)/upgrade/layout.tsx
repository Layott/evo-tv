import { UPGRADE_FAQ } from "@/lib/content/upgrade-faq";
import { JsonLd, faqPage } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * Metadata for /upgrade, which is a client component and so cannot carry its own.
 *
 * `export const metadata` is a server-only feature: a file with "use client"
 * at the top can never have one. Without this layout the page inherits the
 * site default, which is how every page came to share one title and one
 * description. A crawler reading two pages with identical titles treats them
 * as the same page and keeps whichever it saw first.
 *
 * The page itself is untouched, so nothing about the rendering changes.
 */
export const metadata = pageMetadata({
  title: "Membership and pricing",
  description: "What each EVO TV membership includes, what it costs, and how to pay from Nigeria.",
  path: "/upgrade",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/*
        The four questions the page already answers, marked up so they can be
        answered in the search result itself.

        Every answer here is the exact text rendered on the page. Marking up an
        answer a reader cannot see is a manual-action offence rather than a
        grey area, which is why both read from one module.
      */}
      <JsonLd data={faqPage(UPGRADE_FAQ.map((item) => ({ question: item.q, answer: item.a })))} />
      {children}
    </>
  );
}
