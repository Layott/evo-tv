import type { MetadataRoute } from "next";

import { originalShows } from "@/lib/epg/artwork";
import { SITE_URL } from "@/lib/site";

/**
 * What we are asking search engines to index.
 *
 * There was no sitemap and no robots.txt at all, so slugs on their own would
 * have been half a job: shareable, but nothing offered to a crawler beyond
 * whatever it stumbled into from the home page.
 *
 * Only pages that are genuinely public and genuinely finished go in here. Any
 * route behind a sign-in, and anything that renders `ComingSoon`, is left out
 * deliberately: listing a page that turns a visitor away is worse for us than
 * not listing it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const fixed: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Shows come from the artwork registry, which is the same source the landing
  // page and `/show/[slug]` read. It ships with the build, so this list cannot
  // drift from the pages that actually exist.
  const shows: MetadataRoute.Sitemap = originalShows().map((show) => ({
    url: `${SITE_URL}/show/${show.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...fixed, ...shows];
}
