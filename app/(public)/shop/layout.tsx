import { pageMetadata } from "@/lib/seo/metadata";

/**
 * Metadata for /shop, which is a client component and so cannot carry its own.
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
  title: "Shop",
  description: "Official EVO TV merchandise, shipped across Nigeria.",
  path: "/shop",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
