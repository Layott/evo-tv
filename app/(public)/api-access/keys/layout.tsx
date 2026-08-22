import { pageMetadata } from "@/lib/seo/metadata";

/**
 * Metadata for /api-access/keys, which is a client component and so cannot carry its own.
 *
 * `export const metadata` is a server-only feature: a file with "use client"
 * at the top can never have one. Without this layout the page inherits the
 * site default, which is how every page came to share one title and one
 * description. A crawler reading two pages with identical titles treats them
 * as the same page and keeps whichever it saw first.
 *
 * The page itself is untouched, so nothing about the rendering changes.
 *
 * It says "coming soon", and a searcher landing on it can do nothing.
 */
export const metadata = pageMetadata({
  title: "API keys",
  description: "Create and revoke your EVO TV API keys. Not published yet.",
  path: "/api-access/keys",
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
