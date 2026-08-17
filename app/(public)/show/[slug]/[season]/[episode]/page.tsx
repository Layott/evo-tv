import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getShowBySlug,
  getEpisodeByLookup,
  listSeasonsForShow,
  listEpisodesForSeason,
} from "@/lib/api/shows";
import { getCurrentUser } from "@/lib/auth/guards";
import { getEntitlements } from "@/lib/api/entitlements";
import { episodeAccess } from "@/lib/api/episode-access";
import { VideoPlayer } from "@/components/stream/video-player";
import { LocalTime } from "@/components/ui/local-time";
import { BackButton } from "@/components/shell/back-button";

/**
 * One episode, at the address the schedule has been pointing at all along.
 *
 * `lib/api/schedule.ts` has been emitting `/show/<slug>/<season>/<episode>`
 * links since episodes could be scheduled, and that route did not exist: every
 * scheduled episode on the site linked to a 404.
 *
 * Access is decided on the server by `episodeAccess`, which is where early
 * access becomes real: an episode that has aired but is not yet released plays
 * for a paid viewer and shows everyone else the date it opens.
 */

/**
 * Dynamic, because the build must not touch the database.
 *
 * Known and shared with the show page above it: a missing episode renders the
 * not-found page with a **200** status rather than a 404. Tried and did not
 * fix it: calling `notFound()` from `generateMetadata` first, and swapping
 * `force-dynamic` for `connection()`. Something above the page commits the
 * response before the body runs. A human sees the right page; a crawler reads
 * a soft 404.
 */
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string; season: string; episode: string }>;
}

function parseNumber(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug, season, episode } = await params;
  const show = await getShowBySlug(slug);
  const s = parseNumber(season);
  const e = parseNumber(episode);
  // `notFound()` here rather than a fallback title. Metadata resolves first and
  // returning normally commits a 200, so the page's own `notFound()` then
  // renders the not-found page with a 200 status: the soft 404 that search
  // engines treat as a duplicate of every other one. Same trap as the show
  // page above it.
  if (!show || s === null || e === null) notFound();
  const ep = await getEpisodeByLookup(show.id, s, e);
  if (!ep) notFound();
  return {
    title: `${show.title}, S${s}E${e}: ${ep.title}`,
    description: ep.synopsis || show.synopsis,
  };
}

export default async function EpisodePage({ params }: RouteParams) {
  const { slug, season, episode } = await params;
  const seasonNumber = parseNumber(season);
  const episodeNumber = parseNumber(episode);
  if (seasonNumber === null || episodeNumber === null) notFound();

  const show = await getShowBySlug(slug);
  if (!show) notFound();

  const ep = await getEpisodeByLookup(show.id, seasonNumber, episodeNumber);
  if (!ep) notFound();

  const user = await getCurrentUser();
  const entitlements = await getEntitlements(user?.id, user?.role);
  const access = episodeAccess(ep, show, entitlements);

  const seasons = await listSeasonsForShow(show.id);
  const thisSeason = seasons.find((s) => s.seasonNumber === seasonNumber);
  const siblings = thisSeason ? await listEpisodesForSeason(thisSeason.id) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <BackButton fallbackHref={`/show/${show.slug}`} />

      <nav className="mt-4 text-xs text-muted-foreground">
        <Link href="/shows" className="hover:text-foreground">
          Shows
        </Link>
        {" / "}
        <Link href={`/show/${show.slug}`} className="hover:text-foreground">
          {show.title}
        </Link>
        {` / Season ${seasonNumber}`}
      </nav>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-black">
          {access.canWatch && ep.hlsUrl ? (
            <VideoPlayer
              analytics={{ type: "episode", id: ep.id }}
              src={ep.hlsUrl}
              poster={ep.thumbnailUrl || show.heroUrl}
              mediaId={ep.id}
            />
          ) : (
            <LockedFrame
              posterUrl={ep.thumbnailUrl || show.heroUrl || show.posterUrl}
              reason={access.reason}
              availableAt={access.availableAt}
              hasVideo={Boolean(ep.hlsUrl)}
            />
          )}
        </div>

        <header className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">
            Season {seasonNumber}, episode {episodeNumber}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
            {ep.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {show.title}
            {ep.runtimeSec > 0 ? ` · ${Math.round(ep.runtimeSec / 60)} min` : ""}
            {ep.premiereAt ? (
              <>
                {" · aired "}
                <LocalTime iso={ep.premiereAt} />
              </>
            ) : null}
          </p>
          {ep.synopsis ? (
            <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
              {ep.synopsis}
            </p>
          ) : null}
        </header>

        {siblings.length > 1 ? (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-foreground">
              More of season {seasonNumber}
            </h2>
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {siblings.map((sib) => {
                const current = sib.id === ep.id;
                return (
                  <li key={sib.id}>
                    <Link
                      href={`/show/${show.slug}/${seasonNumber}/${sib.episodeNumber}`}
                      className={[
                        "flex items-baseline gap-4 px-4 py-3 transition-colors",
                        current
                          ? "bg-background/40 text-sky-400"
                          : "hover:bg-background/40",
                      ].join(" ")}
                      aria-current={current ? "page" : undefined}
                    >
                      <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {sib.episodeNumber}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium">
                        {sib.title}
                      </span>
                      {sib.runtimeSec > 0 ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {Math.round(sib.runtimeSec / 60)} min
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
    </div>
  );
}

/**
 * What stands in for the player when this viewer cannot watch.
 *
 * Says which of the four reasons it is, in words, with the date where a date
 * is the answer. "Unavailable" tells somebody nothing and reads as a fault.
 */
function LockedFrame({
  posterUrl,
  reason,
  availableAt,
  hasVideo,
}: {
  posterUrl: string;
  reason: "early_access" | "premium_only" | "unaired" | "ok";
  availableAt: string | null;
  hasVideo: boolean;
}) {
  const copy =
    !hasVideo
      ? { title: "Not up yet", body: "This episode has no video on it yet." }
      : reason === "premium_only"
        ? {
            title: "Part of a paid show",
            body: "A subscription opens this episode and everything else behind it.",
          }
        : reason === "unaired"
          ? {
              title: "Has not aired",
              body: "It airs on the channel first. Nobody has it early.",
            }
          : {
              title: "Early on a subscription",
              body: "It has aired and is not on demand for everyone yet.",
            };

  return (
    <div className="relative flex aspect-video w-full items-center justify-center">
      {posterUrl ? (
        <Image
          src={posterUrl}
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-25"
        />
      ) : null}
      <div className="relative z-10 max-w-[38ch] px-6 text-center">
        <p className="text-lg font-semibold text-white">{copy.title}</p>
        <p className="mt-2 text-[0.92rem] text-white/70">{copy.body}</p>
        {availableAt ? (
          <p className="mt-2 text-[0.92rem] text-white/70">
            Opens <LocalTime iso={availableAt} />.
          </p>
        ) : null}
        {reason === "early_access" || reason === "premium_only" ? (
          <Link
            href="/upgrade"
            className="mt-5 inline-block rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-sky-400"
          >
            See the plans
          </Link>
        ) : null}
      </div>
    </div>
  );
}
