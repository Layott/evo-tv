import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getSchedule } from "@/lib/api/epg";
import { artForTitle, showArtBySlug } from "@/lib/epg/artwork";
import {
  getShowBySlug,
  listSeasonsForShow,
  listEpisodesForSeason,
} from "@/lib/api/shows";
import { listProducts } from "@/lib/api/products";
import { Price } from "@/components/ui/price";
import { LocalTime } from "@/components/ui/local-time";
import { BackButton } from "@/components/shell/back-button";
import { MediaImage } from "@/components/ui/media-image";
import { JsonLd, breadcrumbs, tvSeries } from "@/lib/seo/json-ld";

/**
 * A show's own page, inside the app.
 *
 * This used to carry the landing shell, which made opening a show feel like
 * leaving the channel for a brochure. It sits under the same nav as Schedule
 * and Shop now, and uses their card, type and spacing rules.
 *
 * Built from the `shows` table first and the artwork registry second. The
 * registry is hand-made and covers the shows with delivered posters; the table
 * holds every show, including the thirty backfilled out of the grid, and those
 * were answering 404 here when only the registry was consulted.
 */

export const dynamic = "force-dynamic";

/** How far ahead to look for airings. Two weeks covers a weekly show twice. */
const LOOKAHEAD_DAYS = 14;

const PILLAR_LABEL: Record<string, string> = {
  esports: "Esports",
  anime: "Anime",
  lifestyle: "Lifestyle",
};

const STATUS_LABEL: Record<string, string> = {
  airing: "On the channel",
  completed: "Complete",
  hiatus: "On a break",
  upcoming: "Coming soon",
};

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
 * "Friday 21 August", from the guide's own `YYYY-MM-DD`.
 *
 * Split rather than passed through `new Date`, because that key is already in
 * the channel's timezone and parsing it as UTC shifts the date backwards for
 * anyone west of Lagos.
 */
function dayLabel(dateKey: string, dayOfWeek: number): string {
  const [, month, day] = dateKey.split("-").map(Number) as [number, number, number];
  return `${WEEKDAY[dayOfWeek - 1]} ${day} ${MONTH[month - 1]}`;
}

async function load(slug: string) {
  const row = await getShowBySlug(slug);
  const art = showArtBySlug(slug);
  if (!row && !art) return null;

  const title = row?.title ?? art?.title ?? slug;
  const poster = row?.posterUrl || art?.posterSmall || "";
  const synopsis = row?.synopsis || art?.tagline || "";
  const pillar = row?.pillar ?? art?.pillar ?? "esports";

  return { row, art, title, poster, synopsis, pillar };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  // `notFound()` here rather than a fallback title: metadata resolves first and
  // returning normally commits the response.
  if (!data) notFound();

  const description =
    data.synopsis || `${data.title} on EVO TV.`;

  return {
    title: data.title,
    description,
    alternates: { canonical: `/show/${slug}` },
    openGraph: {
      title: data.title,
      description,
      url: `/show/${slug}`,
      type: "video.tv_show",
      images: data.poster ? [{ url: data.poster, alt: `${data.title} poster` }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: data.title,
      description,
      images: data.poster ? [data.poster] : [],
    },
  };
}

export default async function ShowPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { row, art, title, poster, synopsis, pillar } = data;

  const seasons = row ? await listSeasonsForShow(row.id) : [];
  const seasonEpisodes = await Promise.all(
    seasons.map(async (s) => ({
      season: s,
      episodes: await listEpisodesForSeason(s.id),
    })),
  );
  const merch = row ? await listProducts({ showId: row.id }) : [];

  /**
   * Airings, matched two ways because there are two kinds of show.
   *
   * The registry knows which grid titles belong to a hand-made show. It returns
   * nothing for the rows backfilled out of the grid, and those were the shows
   * claiming not to be on the schedule while sitting in the middle of it. Their
   * titles came from the grid verbatim, so the title is compared when the
   * registry has no answer.
   */
  const week = await getSchedule(new Date(), LOOKAHEAD_DAYS);
  const normalise = (v: string) => v.trim().toLowerCase();
  const showTitle = normalise(title);
  const airings = week
    .flatMap((day) =>
      day.entries
        .filter((entry) => {
          const entryArt = artForTitle(entry.title);
          if (entryArt) return entryArt.slug === slug;
          return normalise(entry.title) === showTitle;
        })
        .map((entry) => ({ entry, dayOfWeek: day.dayOfWeek, dateKey: day.dateKey })),
    )
    .slice(0, 6);

  const facts: { label: string; value: string }[] = [];
  if (row) {
    // A rating of zero is "nobody has rated it", not "zero out of five".
    if (row.rating > 0) facts.push({ label: "Rating", value: `${row.rating.toFixed(1)} / 5` });
    if (row.totalEpisodes > 0) {
      facts.push({
        label: "Episodes",
        value:
          row.totalSeasons > 1
            ? `${row.totalEpisodes} across ${row.totalSeasons} seasons`
            : String(row.totalEpisodes),
      });
    }
    facts.push({ label: "Status", value: STATUS_LABEL[row.status] ?? "Coming soon" });
    if (row.maturityRating) {
      facts.push({ label: "Rated", value: row.maturityRating.toUpperCase() });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {/*
        What this page is, for a machine. A show marked up as a TVSeries is
        eligible to be understood as one thing with seasons rather than a page
        that happens to list episode titles, and it is what an assistant reads
        when somebody asks what EVO TV airs.

        Sits inside the existing wrapper and renders a script tag, so it takes
        no space and moves nothing.
      */}
      <JsonLd
        data={[
          tvSeries({
            name: title,
            description: synopsis,
            path: `/show/${slug}`,
            image: poster,
            genre: PILLAR_LABEL[pillar] ?? undefined,
            seasons: row?.totalSeasons ?? seasons.length,
          }),
          breadcrumbs([
            { name: "EVO TV", path: "/" },
            { name: "Shows", path: "/shows" },
            { name: title, path: `/show/${slug}` },
          ]),
        ]}
      />
      <BackButton fallbackHref="/shows" />

      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {poster ? (
            <div className="relative aspect-[2/3] bg-background">
              <MediaImage
                src={poster}
                alt={`${title} poster`}
                className="absolute inset-0 size-full object-cover"
              />
            </div>
          ) : (
            <div className="flex aspect-[2/3] items-end bg-background/60 p-4">
              <p className="text-lg font-bold leading-tight text-foreground">{title}</p>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-sky-400">
            {PILLAR_LABEL[pillar] ?? pillar}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
            {title}
          </h1>
          {synopsis ? (
            <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
              {synopsis}
            </p>
          ) : null}

          {facts.length > 0 ? (
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs text-muted-foreground">
                    {fact.label}
                  </dt>
                  <dd className="text-sm font-semibold text-foreground">{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {/* `preload="none"`: a trailer is about a megabyte, and somebody who
              came to read the schedule should not pay for one. */}
          {art?.trailer ? (
            <video
              controls
              playsInline
              preload="none"
              poster={art.posterSmall}
              className="mt-6 w-full max-w-[36rem] rounded-xl border border-border bg-card"
            >
              <source src={art.trailer} type="video/mp4" />
            </video>
          ) : null}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">On the schedule</h2>
        {airings.length > 0 ? (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {airings.map(({ entry, dayOfWeek, dateKey }) => (
              <li
                key={`${dateKey}_${entry.id}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3"
              >
                <span className="text-sm font-medium text-foreground">
                  {dayLabel(dateKey, dayOfWeek)}
                </span>
                <span className="font-mono text-xs tabular-nums text-sky-400">
                  <LocalTime iso={entry.startsAt} showChannelTime />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 max-w-[52ch] text-sm text-muted-foreground">
            Not on the published schedule right now. The full grid is on the{" "}
            <Link href="/schedule" className="text-sky-400 hover:text-sky-300">
              schedule
            </Link>
            .
          </p>
        )}
      </section>

      {seasonEpisodes.some((s) => s.episodes.length > 0) ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">Episodes</h2>
          {seasonEpisodes
            .filter((s) => s.episodes.length > 0)
            .map(({ season, episodes }) => (
              <div key={season.id} className="mt-4">
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                  Season {season.seasonNumber}
                  {season.title ? ` · ${season.title}` : ""}
                </h3>
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {episodes.map((ep) => (
                    <li key={ep.id}>
                      <Link
                        href={`/show/${slug}/${season.seasonNumber}/${ep.episodeNumber}`}
                        className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-background/40"
                      >
                        <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                          {ep.episodeNumber}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">
                            {ep.title}
                          </span>
                          {ep.synopsis ? (
                            <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                              {ep.synopsis}
                            </span>
                          ) : null}
                        </span>
                        {ep.runtimeSec > 0 ? (
                          <span className="shrink-0 text-xs text-muted-foreground">
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

      {merch.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">In the shop</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {merch.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/shop/${product.id}`}
                  className="group block overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-card"
                >
                  {product.images[0] ? (
                    <div className="relative aspect-square bg-background">
                      <MediaImage
                        src={product.images[0]}
                        alt={product.name}
                        seed={product.id}
                        className="absolute inset-0 size-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-square items-end bg-background/60 p-3">
                      <span className="text-xs text-muted-foreground">
                        {product.name}
                      </span>
                    </div>
                  )}
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-medium text-foreground">
                      {product.name}
                    </p>
                    <Price
                      ngn={product.priceNgn}
                      className="mt-0.5 block text-xs text-muted-foreground"
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
