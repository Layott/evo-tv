import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * What a crawler may read, and what it should leave alone.
 *
 * `/api` and `/admin` are disallowed because indexing them is pure downside:
 * JSON in search results, and an admin login page advertised to anyone looking
 * for one. The auth pages are excluded because a sign-in form is not a useful
 * search result and it competes with the pages that are.
 *
 * The private paths are listed here **and** carry `noindex` in their layouts,
 * which is not redundant: robots.txt stops a crawler fetching a page, while
 * `noindex` removes a page already in the index. A URL that is only blocked in
 * robots.txt can still appear as a bare link if somebody else links to it,
 * because the crawler is not permitted to fetch it and read the tag saying to
 * drop it.
 */

/**
 * The assistants, listed by name.
 *
 * Every one of these is already covered by the `*` rule, so this block grants
 * nothing new. It is here because the intent is worth stating: these agents are
 * welcome, and a future decision to exclude one should be a deliberate edit to
 * a line that names it rather than a silent consequence of a wildcard.
 *
 * The distinction that matters to the owner: some of these fetch a page to
 * answer somebody's question right now, and some collect pages to train on.
 * They are separated below so either group can be changed without touching the
 * other.
 */
const ASSISTANTS_ANSWERING_QUESTIONS = [
  "ChatGPT-User", // fetches a page because a user asked about it
  "OAI-SearchBot", // builds ChatGPT's search index
  "PerplexityBot",
  "Perplexity-User",
  "Claude-User",
  "Claude-SearchBot",
  "Google-Extended", // gates Gemini and AI Overviews, not Google Search
  "Applebot-Extended",
  "Amazonbot",
  "Bingbot",
  "DuckDuckBot",
];

const ASSISTANTS_COLLECTING_TRAINING_DATA = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot", // Common Crawl, which most training sets are built from
  "Meta-ExternalAgent",
  "Bytespider",
];

/**
 * Paths no crawler should spend a request on.
 *
 * Grouped rather than alphabetical so the reason for each is visible.
 */
const PRIVATE_PATHS = [
  // Machine endpoints and the dashboard.
  "/api/",
  "/admin",
  // Getting in. A form, not a destination.
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/onboarding",
  // Yours alone: these render one person's data or nothing.
  "/settings",
  "/checkout",
  "/cart",
  "/order",
  "/profile",
  "/notifications",
  "/library",
  "/creator-dashboard",
  "/rewards",
  "/tips",
  "/watch-parties",
  "/fantasy",
  "/pickem",
  "/predictions",
  "/multi-stream",
  "/auto-clipper",
  "/integrations",
  "/ussd",
  // Meant to sit inside somebody else's page, not to be a result of its own.
  "/embed",
];

export default function robots(): MetadataRoute.Robots {
  const shared = { allow: "/", disallow: PRIVATE_PATHS };

  return {
    rules: [
      { userAgent: "*", ...shared },
      ...ASSISTANTS_ANSWERING_QUESTIONS.map((userAgent) => ({ userAgent, ...shared })),
      ...ASSISTANTS_COLLECTING_TRAINING_DATA.map((userAgent) => ({ userAgent, ...shared })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
