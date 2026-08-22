import { pageMetadata } from "@/lib/seo/metadata";

/**
 * Metadata for /home, which is a client component and so cannot carry its own.
 *
 * `export const metadata` is a server-only feature: a file with "use client"
 * at the top can never have one. Without this layout the page inherits the
 * site default, which is how every page came to share one title and one
 * description. A crawler reading two pages with identical titles treats them
 * as the same page and keeps whichever it saw first.
 *
 * The page itself is untouched, so nothing about the rendering changes.
 *
 * This is the signed-in shell that `/` redirects a member to. `/` is the page
 * a visitor should find, and indexing both would put two near-identical
 * results in front of the same search.
 */
export const metadata = pageMetadata({
  title: "Home",
  description: "Live now, continuing where you left off, and what is coming up on EVO TV.",
  path: "/home",
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
