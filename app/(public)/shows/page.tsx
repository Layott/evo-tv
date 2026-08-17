import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { listShows } from "@/lib/api/shows";
import { showArtBySlug } from "@/lib/epg/artwork";

/**
 * The catalogue.
 *
 * Inside the app shell, not the landing shell. It was built with the marketing
 * header and footer, which made opening a show feel like being taken off the
 * channel and onto a brochure. These are product pages: they sit under the same
 * nav as Schedule, Discover and Shop, and they use the same card, type and
 * spacing rules as those pages.
 *
 * Grouped by pillar because that is how the channel is organised everywhere
 * else, and because a flat list of thirty titles is a directory rather than a
 * catalogue.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shows",
  description:
    "Every show on EVO TV: esports, anime and lifestyle, with the episodes behind each one.",
};

const PILLARS: { key: "esports" | "anime" | "lifestyle"; label: string }[] = [
  { key: "esports", label: "Esports" },
  { key: "anime", label: "Anime" },
  { key: "lifestyle", label: "Lifestyle" },
];

function statusLabel(status: string): string {
  switch (status) {
    case "airing":
      return "On the channel";
    case "completed":
      return "Complete";
    case "hiatus":
      return "On a break";
    default:
      return "Coming soon";
  }
}

export default async function ShowsPage() {
  const shows = await listShows();

  const groups = PILLARS.map((p) => ({
    ...p,
    shows: shows.filter((s) => s.pillar === p.key),
  })).filter((g) => g.shows.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Shows</h1>
        <p className="text-sm text-muted-foreground">
          Everything that runs on the channel, and everything with its own
          episodes.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl bg-card/50 p-12 text-center text-muted-foreground">
          Nothing in the catalogue yet.
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="mb-10">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              {group.label}
            </h2>

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {group.shows.map((show) => {
                const art = showArtBySlug(show.slug);
                const poster = show.posterUrl || art?.posterSmall || "";
                return (
                  <li key={show.id}>
                    <Link
                      href={`/show/${show.slug}`}
                      className="group block overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-card"
                    >
                      {/* Most of the catalogue was backfilled from the grid and
                          has no artwork. An empty poster frame reads as a failed
                          image, so the title carries the card instead. */}
                      {poster ? (
                        <div className="relative aspect-[2/3] overflow-hidden bg-background">
                          <Image
                            src={poster}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 45vw, 18vw"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex aspect-[4/3] items-end bg-background/60 p-3">
                          <p className="text-sm font-semibold leading-snug text-foreground">
                            {show.title}
                          </p>
                        </div>
                      )}

                      <div className="p-3">
                        {poster ? (
                          <p className="line-clamp-2 text-sm font-semibold text-foreground">
                            {show.title}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {show.totalEpisodes > 0
                            ? `${show.totalEpisodes} episode${show.totalEpisodes === 1 ? "" : "s"}`
                            : statusLabel(show.status)}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
