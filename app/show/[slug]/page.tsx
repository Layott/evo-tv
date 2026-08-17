import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getSchedule } from "@/lib/api/epg";
import { listProducts } from "@/lib/api/products";
import { Price } from "@/components/ui/price";
import {
  getShowBySlug,
  listSeasonsForShow,
  listEpisodesForSeason,
} from "@/lib/api/shows";
import type { ShowArt } from "@/lib/epg/artwork";
import { artForTitle, showArtBySlug } from "@/lib/epg/artwork";
import { PILLARS } from "@/components/landing/pillar";
import SiteFooter from "@/components/landing/site-footer";
import SiteHeader from "@/components/landing/site-header";

/**
 * A show's own page, and its own URL.
 *
 * The Originals were already the best thing on the landing page and they linked
 * nowhere: the posters carried a slug that was used as a React key and nothing
 * else. So nobody could share a show, and a crawler had one page to index for
 * the whole catalogue.
 *
 * Built from the artwork registry rather than the `shows` table on purpose. The
 * table has no rows for any of these: `/api/shows/otaku-and-chillz` answers 404
 * in production today. The registry has the poster, the trailer, the strapline
 * off the poster and the day it airs, all of which are real, so the page is
 * built from what exists instead of waiting for a content import. When the
 * table is populated, this is where the synopsis and episode list join.
 *
 * Styled as the landing page rather than the app shell because that is where it
 * is reached from and what a shared link should open into.
 */

export const dynamic = "force-dynamic";

/** How far ahead to look for airings. Two weeks covers a weekly show twice. */
const LOOKAHEAD_DAYS = 14;

const WEEKDAY = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const MONTH = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * "Friday 14 August", from the guide's own `YYYY-MM-DD`.
 *
 * Split rather than passed through `new Date`, because that key is already in
 * the channel's timezone and parsing it as UTC shifts the date backwards for
 * anyone west of Lagos. A weekly show lists the same weekday repeatedly, so
 * without the date two rows read as an accidental duplicate.
 */
function dayLabel(dateKey: string, dayOfWeek: number): string {
  const [, month, day] = dateKey.split("-").map(Number) as [number, number, number];
  return `${WEEKDAY[dayOfWeek - 1]} ${day} ${MONTH[month - 1]}`;
}


/**
 * The artwork for a show, or something usable built from its row.
 *
 * The registry is hand-made and covers the shows with delivered posters. The
 * `shows` table has thirty five rows, most backfilled from the grid, and until
 * now every one of those answered 404 here because only the registry was
 * consulted. A row is enough to render a page: title, synopsis, whatever
 * artwork the CMS holds.
 */
function artFromRow(row: {
  slug: string;
  title: string;
  synopsis: string;
  posterUrl: string;
  heroUrl: string;
  pillar: "esports" | "anime" | "lifestyle";
}): ShowArt {
  return {
    slug: row.slug,
    title: row.title,
    tagline: row.synopsis || undefined,
    poster: row.posterUrl || row.heroUrl || "",
    posterSmall: row.posterUrl || row.heroUrl || "",
    // A one-pixel transparent GIF: no flash, and no pretending there is art.
    blurDataURL:
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    polarity: "dark",
    accent: "#46E3CE",
    accentOnDark: "#46E3CE",
    pillar: row.pillar,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const row = await getShowBySlug(slug);
  const show = showArtBySlug(slug) ?? (row ? artFromRow(row) : null);
  // `notFound()` here rather than a "Show not found" title, because metadata
  // resolves first and returning normally commits a 200 before the page
  // component ever runs. That served the 404 page with a 200 status, which is
  // the soft 404 search engines treat as a duplicate of every other one.
  if (!show) notFound();

  // The strapline is taken verbatim off the poster, so it is the show's own
  // words rather than a description written to fill a meta tag.
  const description =
    show.tagline ??
    (show.airs
      ? `${show.title} on EVO TV, ${show.airs}.`
      : `${show.title} on EVO TV.`);

  return {
    title: show.title,
    description,
    alternates: { canonical: `/show/${show.slug}` },
    openGraph: {
      title: show.title,
      description,
      url: `/show/${show.slug}`,
      type: "video.tv_show",
      // The poster is 4:5 and shipped as WebP. A share card cropping it is
      // better than a generic site image, which says nothing about the show.
      images: [{ url: show.poster, alt: `${show.title} poster` }],
    },
    twitter: {
      card: "summary_large_image",
      title: show.title,
      description,
      images: [show.poster],
    },
  };
}

export default async function ShowPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const row = await getShowBySlug(slug);
  const show = showArtBySlug(slug) ?? (row ? artFromRow(row) : null);
  if (!show) notFound();

  // Seasons and episodes come from the CMS. A show with none simply has none
  // yet, which the section says rather than rendering an empty shelf.
  const seasons = row ? await listSeasonsForShow(row.id) : [];
  // Merchandise for this programme. The shop and the catalogue were two worlds
  // until `products.show_id`: a viewer reading about a show was never told
  // there was a shirt for it.
  const merch = row ? await listProducts({ showId: row.id }) : [];
  const seasonEpisodes = await Promise.all(
    seasons.map(async (s) => ({ season: s, episodes: await listEpisodesForSeason(s.id) })),
  );

  /**
   * Airings, matched two ways because there are two kinds of show.
   *
   * The artwork registry knows which grid titles belong to a hand-made show, so
   * that lookup stays. It returns nothing for the thirty rows backfilled out of
   * the grid itself, and those were the shows telling visitors they were "not
   * on the published schedule" while sitting in the middle of it. Their titles
   * came from the grid verbatim, so comparing the title is exactly right for
   * them, and is only reached when the registry has no answer.
   */
  const week = await getSchedule(new Date(), LOOKAHEAD_DAYS);
  const normalise = (value: string) => value.trim().toLowerCase();
  const showTitle = normalise(row?.title ?? show.title);
  const airings = week
    .flatMap((day) =>
      day.entries
        .filter((entry) => {
          const art = artForTitle(entry.title);
          if (art) return art.slug === show.slug;
          return normalise(entry.title) === showTitle;
        })
        .map((entry) => ({ entry, dayOfWeek: day.dayOfWeek, dateKey: day.dateKey })),
    )
    .slice(0, 6);

  const pillar = PILLARS[show.pillar];

  return (
    <div className="landing-root landing-grain relative min-h-screen selection:bg-[var(--brand)] selection:text-[var(--ink)]">
      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-[92rem] px-5 pb-24 pt-6 sm:px-10 sm:pt-10">
        <Link
          href="/#originals"
          className="landing-display text-[0.95rem] text-[var(--paper-dim)] transition-colors hover:text-[var(--paper)]"
        >
          EVO Originals
        </Link>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
          <div>
            {/* Capped: the two-column grid only starts at `lg`, so without this
                the poster stretched to the full 768px of a tablet. */}
            <div
              className="relative flex aspect-[4/5] w-full max-w-[22rem] items-end overflow-hidden bg-[var(--ink-raised)] p-5"
              style={
                show.poster
                  ? {
                      boxShadow: `0 26px 60px -28px ${show.accent}80, 0 8px 22px -14px rgba(0,0,0,0.85)`,
                    }
                  : undefined
              }
            >
              {/* A row backfilled from the grid has no artwork. Rendering an
                  <Image> with an empty src draws the browser's broken-image
                  icon, which is worse than admitting there is no poster: the
                  title carries the panel instead, the way the catalogue cards
                  do. */}
              {show.poster ? (
                <Image
                  src={show.poster}
                  alt={`${show.title} poster`}
                  fill
                  sizes="(min-width: 1024px) 22rem, 100vw"
                  placeholder="blur"
                  blurDataURL={show.blurDataURL}
                  priority
                  className="object-cover"
                />
              ) : (
                <p className="landing-display text-balance text-[1.4rem] leading-tight text-[var(--paper)]">
                  {show.title}
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {show.brand ? (
                <p className="landing-display text-[1rem] text-[var(--paper-faint)]">
                  {show.brand}
                </p>
              ) : null}
              <p className="landing-display text-[1rem] text-[var(--paper-faint)]">
                {pillar.label}
              </p>
              {show.airs ? (
                <p className="landing-display text-[1rem] text-[var(--brand)]">
                  {show.airs}
                </p>
              ) : null}
            </div>

            <h1
              className="wipe landing-display mt-3 text-[clamp(2.6rem,7vw,5rem)]"
              style={{ color: show.accentOnDark }}
            >
              {show.title}
            </h1>

            {show.tagline ? (
              <p className="reveal mt-4 max-w-[46ch] text-[1.05rem] leading-relaxed text-[var(--paper-dim)]">
                {show.tagline}
              </p>
            ) : null}

            {/* What the CMS knows about this show, and only what it knows. A
                rating of zero is "nobody has rated it", not "zero out of five",
                so it is left out rather than printed as a bad score. */}
            {row ? (
              <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
                {row.rating > 0 ? (
                  <div>
                    <dt className="text-[0.78rem] uppercase tracking-[0.08em] text-[var(--paper-faint)]">
                      Rating
                    </dt>
                    <dd className="landing-display text-[1.1rem] text-[var(--paper)]">
                      {row.rating.toFixed(1)} / 5
                    </dd>
                  </div>
                ) : null}
                {row.totalEpisodes > 0 ? (
                  <div>
                    <dt className="text-[0.78rem] uppercase tracking-[0.08em] text-[var(--paper-faint)]">
                      Episodes
                    </dt>
                    <dd className="landing-display text-[1.1rem] text-[var(--paper)]">
                      {row.totalEpisodes}
                      {row.totalSeasons > 1 ? ` across ${row.totalSeasons} seasons` : ""}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[0.78rem] uppercase tracking-[0.08em] text-[var(--paper-faint)]">
                    Status
                  </dt>
                  <dd className="landing-display text-[1.1rem] text-[var(--paper)]">
                    {row.status === "airing"
                      ? "On the channel"
                      : row.status === "completed"
                        ? "Complete"
                        : row.status === "hiatus"
                          ? "On a break"
                          : "Coming soon"}
                  </dd>
                </div>
                {row.maturityRating ? (
                  <div>
                    <dt className="text-[0.78rem] uppercase tracking-[0.08em] text-[var(--paper-faint)]">
                      Rated
                    </dt>
                    <dd className="landing-display text-[1.1rem] uppercase text-[var(--paper)]">
                      {row.maturityRating}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}

            {show.handle ? (
              <p className="mt-2 text-[0.95rem] text-[var(--paper-faint)]">
                {show.handle}
              </p>
            ) : null}

            {/*
              `preload="none"` and no autoplay: the trailers are around a
              megabyte each, and a visitor who came to read the schedule should
              not pay for one. The poster stands in until they ask.
            */}
            {show.trailer ? (
              <video
                controls
                playsInline
                preload="none"
                poster={show.posterSmall}
                className="mt-8 w-full max-w-[36rem] bg-[var(--ink-raised)]"
              >
                <source src={show.trailer} type="video/mp4" />
              </video>
            ) : null}

            <section className="mt-12">
              <h2 className="landing-display text-[1.6rem]">On the schedule</h2>
              {airings.length > 0 ? (
                <ul className="mt-4 max-w-[36rem]">
                  {airings.map(({ entry, dayOfWeek, dateKey }) => (
                    <li
                      key={`${dateKey}_${entry.id}`}
                      className="flex items-baseline justify-between gap-6 py-3"
                    >
                      <span className="landing-display text-[1.05rem]">
                        {dayLabel(dateKey, dayOfWeek)}
                      </span>
                      {/* h-px, or an empty inline span has no box for the
                          dotted background to paint into. */}
                      <span className="listing-leader h-px min-w-8 flex-1" />
                      <span className="font-mono text-[0.9rem] tabular-nums text-[var(--brand)]">
                        {entry.startLabel}-{entry.endLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 max-w-[44ch] text-[0.98rem] text-[var(--paper-dim)]">
                  Not on the published schedule right now. The full grid is on
                  the{" "}
                  <Link
                    href="/#week"
                    className="text-[var(--brand)] underline underline-offset-4"
                  >
                    home page
                  </Link>
                  .
                </p>
              )}
            </section>
          </div>
        </div>

        {merch.length > 0 ? (
          <section className="mt-16">
            <h2 className="landing-display text-[1.5rem]">In the shop</h2>
            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
              {merch.map((product) => (
                <li key={product.id}>
                  <Link href={`/shop/${product.id}`} className="group block">
                    <div className="relative flex aspect-square items-end overflow-hidden rounded-lg bg-[var(--ink-raised)] p-3">
                      {/* Same rule as the catalogue cards: no photograph is a
                          fact about the product, and an empty square reads as a
                          failed image. */}
                      {product.images[0] ? (
                        <Image
                          src={product.images[0]}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 45vw, 18vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <span className="landing-display text-balance text-[0.95rem] leading-snug text-[var(--paper-dim)]">
                          {product.name}
                        </span>
                      )}
                    </div>
                    <p className="landing-display mt-2 text-balance text-[1rem] text-[var(--paper)] group-hover:text-[var(--brand)]">
                      {product.name}
                    </p>
                    <Price
                      ngn={product.priceNgn}
                      className="mt-0.5 block text-[0.85rem] text-[var(--paper-dim)]"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {seasonEpisodes.some((s) => s.episodes.length > 0) ? (
          <section className="mt-16">
            <h2 className="landing-display text-[1.5rem]">Episodes</h2>
            {seasonEpisodes
              .filter((s) => s.episodes.length > 0)
              .map(({ season, episodes }) => (
                <div key={season.id} className="mt-8">
                  <h3 className="text-[0.85rem] uppercase tracking-[0.08em] text-[var(--paper-faint)]">
                    Season {season.seasonNumber}
                    {season.title ? ` · ${season.title}` : ""}
                  </h3>
                  <ul className="mt-3 divide-y divide-[var(--edge,#12383A)]">
                    {episodes.map((ep) => (
                      <li key={ep.id}>
                        <Link
                          href={`/show/${show.slug}/${season.seasonNumber}/${ep.episodeNumber}`}
                          className="flex items-baseline gap-4 py-3.5 transition-opacity hover:opacity-80"
                        >
                          <span className="w-8 shrink-0 font-mono text-[0.8rem] tabular-nums text-[var(--paper-faint)]">
                            {ep.episodeNumber}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="landing-display block text-[1.05rem] text-[var(--paper)]">
                              {ep.title}
                            </span>
                            {ep.synopsis ? (
                              <span className="mt-0.5 line-clamp-2 block text-[0.82rem] text-[var(--paper-faint)]">
                                {ep.synopsis}
                              </span>
                            ) : null}
                          </span>
                          {ep.runtimeSec > 0 ? (
                            <span className="shrink-0 text-[0.8rem] text-[var(--paper-faint)]">
                              {Math.round(ep.runtimeSec / 60)} min
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  );
}
