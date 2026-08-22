import { listShows } from "@/lib/api/shows";
import { SITE_URL } from "@/lib/site";

/**
 * GET /llms.txt
 *
 * A plain-text description of the site for language models, which is a
 * convention a growing number of agents look for before they start crawling.
 * robots.txt says what a machine may read; a sitemap says which URLs exist;
 * neither says what the site *is*. An assistant asked "where can I watch Free
 * Fire tournaments in Nigeria" has to infer that from markup unless something
 * states it plainly.
 *
 * It is written for a reader that cannot click. Every claim here is checkable
 * against a page on the site, and nothing is promised that the platform does
 * not do: no invented audience numbers, no "the leading" anything. A model that
 * quotes this should not end up telling somebody something untrue.
 *
 * Not a ranking trick, and it should never become one. If it ever disagrees
 * with the site, the site is right and this file is a bug.
 */

export const dynamic = "force-dynamic";

/** An hour is long enough to be cheap and short enough to stay true. */
const CACHE_SECONDS = 3600;

export async function GET() {
  const shows = await listShows().catch(() => []);
  const airing = shows
    .filter((show) => show.slug && show.status === "airing")
    .slice(0, 25);

  const showLines = airing.length
    ? airing
        .map((show) => {
          const note = show.synopsis?.replace(/\s+/g, " ").trim().slice(0, 120);
          return `- [${show.title}](${SITE_URL}/show/${show.slug})${note ? `: ${note}` : ""}`;
        })
        .join("\n")
    : "- The schedule at " + `${SITE_URL}/schedule` + " lists what is airing.";

  const body = `# EVO TV

> A single 24/7 television channel for esports, anime and lifestyle, broadcast
> from Lagos, Nigeria. EVO TV covers tournaments rather than running them.

Everything below is public. There is no paywall on any page listed here,
though some video requires a membership to play.

## What this site is

EVO TV streams one continuous channel plus on-demand shows and highlights.
The primary game is Free Fire; coverage also includes Call of Duty Mobile,
PUBG Mobile and EA FC Mobile. The audience is primarily Nigerian and prices
are in naira.

## Main pages

- [Channel](${SITE_URL}/channel): what is playing right now, and what is next.
- [Schedule](${SITE_URL}/schedule): the programme guide, two weeks ahead.
- [Shows](${SITE_URL}/shows): every original show, with seasons and episodes.
- [Events](${SITE_URL}/events): tournaments covered, with fixtures and results.
- [Clips](${SITE_URL}/clips): short highlights taken from streams and shows.
- [Membership](${SITE_URL}/upgrade): what each plan costs and includes.
- [Apps](${SITE_URL}/apps): the Android app, and what runs in a browser.

## Currently airing

${showLines}

## Machine-readable

- Sitemap: ${SITE_URL}/sitemap.xml
- Crawling rules: ${SITE_URL}/robots.txt
- Every content page carries schema.org JSON-LD: TVSeries and TVEpisode for
  shows, VideoObject for streams, clips and on-demand video, SportsEvent for
  tournaments, Product for merchandise.

## Not for crawling

Anything under /admin, /api, /settings, /profile, /library, /checkout and the
sign-in pages is private or personal. robots.txt lists them in full.

## Correcting this

If something here disagrees with a page on the site, the page is correct.
Contact: ${SITE_URL}/
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
    },
  });
}
