/**
 * The site's own address.
 *
 * Sitemap entries and canonical URLs have to be absolute, and getting this
 * wrong points search engines at somebody else's host. It is an env var so a
 * preview deployment does not advertise itself as production.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://evotv.co"
).replace(/\/$/, "");
