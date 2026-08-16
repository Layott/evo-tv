import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { listShows } from "@/lib/api/shows";
import { showArtBySlug } from "@/lib/epg/artwork";
import { PILLARS } from "@/components/landing/pillar";
import SiteFooter from "@/components/landing/site-footer";
import SiteHeader from "@/components/landing/site-header";

/**
 * The catalogue.
 *
 * `/show/[slug]` has existed since the shows CMS shipped and nothing linked to
 * it, so a viewer could open a show only if somebody sent them the address.
 * This is the page that was missing between the schedule and a show.
 *
 * Ordered by pillar rather than alphabetically, because that is how the channel
 * is organised everywhere else on the site, and because a flat list of thirty
 * five titles is a directory rather than a catalogue.
 *
 * Artwork comes from the registry where the row has none: most of the grid
 * titles were backfilled from the schedule and have no poster yet, and a
 * generic placeholder on thirty cards reads as a broken page.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shows",
  description:
    "Every show on EVO TV: esports, anime and lifestyle, with the episodes behind each one.",
};

const PILLAR_ORDER = ["esports", "anime", "lifestyle"] as const;

export default async function ShowsPage() {
  const shows = await listShows();

  const byPillar = PILLAR_ORDER.map((pillar) => ({
    pillar,
    label: PILLARS[pillar]?.label ?? pillar,
    shows: shows.filter((s) => s.pillar === pillar),
  })).filter((group) => group.shows.length > 0);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[92rem] px-5 pb-24 pt-12 sm:px-10">
        <header className="max-w-[52ch]">
          <h1 className="landing-display text-[clamp(2rem,5vw,3.2rem)]">Shows</h1>
          <p className="mt-3 text-[1.02rem] leading-relaxed text-[var(--paper-dim)]">
            Everything that runs on the channel, and everything that has its own
            episodes. Open one to see what is inside it.
          </p>
        </header>

        {byPillar.length === 0 ? (
          <p className="mt-16 text-[1.1rem] text-[var(--paper-faint)]">
            Nothing in the catalogue yet.
          </p>
        ) : (
          byPillar.map((group) => (
            <section key={group.pillar} className="mt-14">
              <h2 className="landing-display text-[1.4rem] text-[var(--paper)]">
                {group.label}
              </h2>

              <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
                {group.shows.map((show) => {
                  const art = showArtBySlug(show.slug);
                  const poster = show.posterUrl || art?.posterSmall || "";
                  const status =
                    show.totalEpisodes > 0
                      ? `${show.totalEpisodes} episode${show.totalEpisodes === 1 ? "" : "s"}`
                      : statusLabel(show.status);

                  return (
                    <li key={show.id}>
                      <Link href={`/show/${show.slug}`} className="group block">
                        {poster ? (
                          <>
                            <div className="relative aspect-[2/3] overflow-hidden rounded bg-[var(--ink-raised)]">
                              <Image
                                src={poster}
                                alt=""
                                fill
                                sizes="(max-width: 640px) 45vw, 18vw"
                                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              />
                            </div>
                            <p className="landing-display mt-2.5 text-balance text-[1.02rem] text-[var(--paper)] group-hover:text-[var(--brand)]">
                              {show.title}
                            </p>
                          </>
                        ) : (
                          /* Most of the catalogue was backfilled from the grid
                             and has no artwork. An empty poster-shaped box with
                             the title printed under it reads as a failed image,
                             so the card becomes the type instead: shorter, set
                             deliberately, and it does not say the name twice. */
                          <div className="flex min-h-[7.5rem] items-end rounded-lg bg-[#0b2527] p-3.5 transition-colors group-hover:bg-[#10353a]">
                            <p className="landing-display text-balance text-[1.05rem] leading-snug text-[var(--paper)] group-hover:text-[var(--brand)]">
                              {show.title}
                            </p>
                          </div>
                        )}

                        <p className="mt-1.5 text-[0.8rem] text-[var(--paper-faint)]">
                          {status}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </main>
      <SiteFooter />
    </>
  );
}

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
