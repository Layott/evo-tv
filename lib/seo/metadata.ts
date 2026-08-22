import type { Metadata } from "next";

/**
 * One shape for a page's `<head>`, so twenty-odd pages do not each invent one.
 *
 * Every public page needs the same four things and they are easy to get subtly
 * wrong one page at a time: a title that is not the site's default, a
 * description written for a human reading a search result, a canonical URL, and
 * an Open Graph block so a shared link is not a bare string.
 *
 * The title deliberately carries no brand suffix. The root layout's
 * `template: "%s | EVO TV"` appends it, and doing it here as well produced
 * "Schedule | EVO TV | EVO TV" the first time round.
 */
export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  /** Video pages want `video.other`; a show page wants `video.tv_show`. */
  ogType?: "website" | "article" | "video.other" | "video.tv_show" | "video.episode";
  /**
   * Keep it out of the index.
   *
   * For a page that is real but not a useful search result: a screen that
   * still says "coming soon", anything behind a sign-in, an embed meant to sit
   * in somebody else's page. `follow` stays on so link equity still flows
   * through to the pages that are worth finding.
   */
  noIndex?: boolean;
}): Metadata {
  const images = opts.image ? [{ url: opts.image, alt: opts.title }] : undefined;

  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: opts.path,
      type: opts.ogType ?? "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: opts.image ? [opts.image] : undefined,
    },
    ...(opts.noIndex
      ? { robots: { index: false, follow: true, googleBot: { index: false, follow: true } } }
      : {}),
  };
}

/**
 * For a page that exists but has nothing to offer a searcher yet.
 *
 * Every screen rendering `ComingSoon` gets this. Listing them would put a
 * visitor on a dead end from a search result, which costs more than the page
 * could ever earn.
 */
export function comingSoonMetadata(opts: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return pageMetadata({ ...opts, noIndex: true });
}
