import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * There was no robots.txt, so every one of these was fair game to a crawler.
 *
 * `/api` and `/admin` are disallowed because indexing them is pure downside:
 * JSON in search results, and an admin login page advertised to anyone looking
 * for one. The auth pages are excluded because a sign-in form is not a useful
 * search result and it competes with the pages that are.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/onboarding",
          "/settings",
          "/checkout",
          "/cart",
          "/order",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
