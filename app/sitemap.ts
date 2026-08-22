import type { MetadataRoute } from "next";

import { listEvents } from "@/lib/api/events";
import { listGames } from "@/lib/api/games";
import { listProducts } from "@/lib/api/products";
import { listShows, listSeasonsForShow, listEpisodesForSeason } from "@/lib/api/shows";
import { listTeams } from "@/lib/api/teams";
import { listVods } from "@/lib/api/vods";
import { originalShows } from "@/lib/epg/artwork";
import { SITE_URL } from "@/lib/site";

/**
 * What we are asking search engines to index.
 *
 * This was a fixed list of three pages plus whatever the artwork registry
 * shipped with the build, which meant every VOD, episode, event, team and
 * product on the platform was invisible unless a crawler happened to walk to
 * it from a link. The registry is hand-made and covers the shows with
 * delivered posters; the database holds everything.
 *
 * Two rules decide what goes in:
 *
 * 1. **Only pages that are genuinely public and genuinely finished.** Anything
 *    behind a sign-in and anything rendering `ComingSoon` is left out. Listing
 *    a page that turns a visitor away costs more than not listing it.
 * 2. **`lastModified` is a real timestamp or it is left off.** Stamping every
 *    URL with "now" on every request tells a crawler the whole site changed
 *    today, every day, and the field stops being believed. That is worse than
 *    silence, because the honest entries lose their meaning too.
 */

/*
 * Rendered per request, never prerendered at build.
 *
 * Next generates `sitemap.xml` during `next build` by default, and the image
 * is built inside Docker on the droplet with no database reachable. A sitemap
 * that reads six tables would therefore fail the build with ECONNREFUSED and
 * produce no image at all. The exact same trap already took down `app/page.tsx`
 * once, where it was `export const revalidate` making the page ISR.
 *
 * It is also the right model regardless: a sitemap baked at build time lists
 * whatever existed when the image was made, and an episode published an hour
 * later would wait for a deploy to become findable.
 */
export const dynamic = "force-dynamic";

/** Read a list, and treat a failure as an empty section rather than a 500. */
async function safely<T>(what: string, read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch (err) {
    // A sitemap that renders without the shop is worth far more than a sitemap
    // that 500s because one table was unreachable. Google retries on error and
    // meanwhile has nothing at all.
    console.error(`[sitemap] skipped ${what}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

/** Newest first, so the cap keeps what a crawler most wants. */
function byNewest<T extends { createdAt?: string | null; publishedAt?: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const at = Date.parse(a.publishedAt ?? a.createdAt ?? "") || 0;
    const bt = Date.parse(b.publishedAt ?? b.createdAt ?? "") || 0;
    return bt - at;
  });
}

/**
 * A sitemap file may hold 50,000 URLs. The platform is nowhere near that, but
 * an unbounded query against a growing table is a slow request waiting to
 * happen, so each section is capped and the cap is logged when it bites: a
 * silent truncation reads as "everything is listed" when it is not.
 */
const PER_SECTION = 5_000;

function cap<T>(section: string, rows: T[]): T[] {
  if (rows.length <= PER_SECTION) return rows;
  console.warn(
    `[sitemap] ${section} has ${rows.length} rows; listing the newest ${PER_SECTION}. Time to split the sitemap.`,
  );
  return rows.slice(0, PER_SECTION);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /*
   * The pages that exist regardless of what is in the database.
   *
   * Deliberately absent: /home, which is the signed-in shell that `/`
   * redirects a member to and would be a second result for the same thing.
   * Also every ComingSoon page, which carries `noindex` of its own.
   */
  const fixed: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/channel`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/schedule`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/shows`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/events`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/clips`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/categories`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/team`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/discover`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/shop`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/upgrade`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/apps`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/apps/android`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/apps/ios`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/api-access`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const [shows, vods, events, teams, games, products] = await Promise.all([
    safely("shows", () => listShows()),
    safely("vods", () => listVods()),
    safely("events", () => listEvents()),
    safely("teams", () => listTeams()),
    safely("games", () => listGames()),
    safely("products", () => listProducts()),
  ]);

  /*
   * Shows, from the database and the artwork registry both.
   *
   * The registry covers the shows with delivered posters and the table holds
   * every show including the thirty backfilled out of the grid, so either
   * source alone leaves pages unlisted. A Map keyed on slug merges them
   * without listing anything twice.
   */
  const showPaths = new Map<string, Date | undefined>();
  for (const show of originalShows()) showPaths.set(show.slug, undefined);
  for (const show of shows) {
    if (show.slug) showPaths.set(show.slug, undefined);
  }

  const showEntries: MetadataRoute.Sitemap = [...showPaths.keys()].map((slug) => ({
    url: `${SITE_URL}/show/${slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  /*
   * Episodes, which are the deepest pages on the site and the ones a crawler
   * is least likely to reach on its own: they sit two clicks below a show and
   * are linked from a list that only renders one season at a time.
   */
  const episodeEntries: MetadataRoute.Sitemap = [];
  for (const show of shows) {
    if (!show.slug) continue;
    const seasons = await safely(`seasons for ${show.slug}`, () =>
      listSeasonsForShow(show.id),
    );
    for (const season of seasons) {
      const episodes = await safely(`episodes for ${show.slug} s${season.seasonNumber}`, () =>
        listEpisodesForSeason(season.id),
      );
      for (const ep of episodes) {
        episodeEntries.push({
          url: `${SITE_URL}/show/${show.slug}/${ep.seasonNumber}/${ep.episodeNumber}`,
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    }
  }

  const vodEntries: MetadataRoute.Sitemap = cap("vods", byNewest(vods)).map((vod) => ({
    url: `${SITE_URL}/vod/${vod.slug ?? vod.id}`,
    lastModified: vod.publishedAt ? new Date(vod.publishedAt) : undefined,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const eventEntries: MetadataRoute.Sitemap = cap("events", events).map((event) => ({
    url: `${SITE_URL}/events/${event.slug ?? event.id}`,
    // An event page changes while the event is on and never again after it.
    changeFrequency: event.status === "live" ? "hourly" : "monthly",
    priority: event.status === "live" ? 0.9 : 0.6,
  }));

  const teamEntries: MetadataRoute.Sitemap = cap("teams", teams)
    .filter((team) => team.slug)
    .map((team) => ({
      url: `${SITE_URL}/team/${team.slug}`,
      changeFrequency: "weekly",
      priority: 0.5,
    }));

  const categoryEntries: MetadataRoute.Sitemap = games
    .filter((game) => game.enabled && game.slug)
    .map((game) => ({
      url: `${SITE_URL}/categories/${game.slug}`,
      changeFrequency: "weekly",
      priority: 0.5,
    }));

  const productEntries: MetadataRoute.Sitemap = cap("products", products)
    .filter((item) => item.active)
    .map((item) => ({
      url: `${SITE_URL}/shop/${item.slug ?? item.id}`,
      changeFrequency: "weekly",
      priority: 0.5,
    }));

  return [
    ...fixed,
    ...showEntries,
    ...episodeEntries,
    ...vodEntries,
    ...eventEntries,
    ...teamEntries,
    ...categoryEntries,
    ...productEntries,
  ];
}
