"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Radio, Lock } from "@/components/icons";

import { useAuth } from "@/components/providers";
import { VideoPlayer } from "@/components/stream/video-player";
import { ChannelBreaks } from "@/components/stream/channel-breaks";
import { FillerScreen } from "@/components/stream/filler-screen";
import { PollResultOverlay } from "@/components/stream/poll-result-overlay";
import { MediaImage } from "@/components/ui/media-image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * The flagship channel, fixed at the top of the site.
 *
 * EVO TV is a channel first and a catalogue second, so one broadcast owns the
 * prime position and stays there. It does not move down the page when
 * something else is live, and it does not disappear between broadcasts: a hero
 * that vanishes off air leaves a hole where the identity of the site should be.
 *
 * Off air it shows the poster and what is coming, which is what a visitor
 * actually needs at that moment. Not "nothing here", but "back at 20:00".
 *
 * The schedule sits directly beneath, because on a channel the two are one
 * thing: what is on, and what is next.
 */

interface EpgRow {
  id: string;
  title: string;
  subtitle: string;
  pillar: string;
  airsAt: string;
  durationMin: number;
  state: string;
  /** The show's poster, for the on-air cards that carry artwork. */
  thumbnailUrl?: string;
}

interface MainChannel {
  id: string;
  title: string;
  tagline: string;
  posterUrl: string;
  thumbnailUrl: string;
  isLive: boolean;
  hlsUrl: string;
  startedAt: string | null;
  requiresAuth?: boolean;
}

const TZ = "Africa/Lagos";

function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function MainChannelHero() {
  const { role } = useAuth();
  const signedIn = role !== "guest";
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ["channel", "main"],
    queryFn: async (): Promise<{
      channel: MainChannel | null;
      onNow: EpgRow | null;
      upNext: EpgRow[];
    }> => {
      const res = await fetch("/api/channel/main", { credentials: "include" });
      if (!res.ok) return { channel: null, onNow: null, upNext: [] };
      return res.json();
    },
    // The on-air programme changes on the hour; this keeps the strip honest
    // without the viewer reloading. Going live is handled by the subscription
    // below rather than by polling faster, so this only has to catch the slow
    // stuff: a schedule edit, or an event the socket missed.
    refetchInterval: 60_000,
  });

  /*
   * Come on air without a reload.
   *
   * Polling alone meant a viewer sitting on the home page watched an "Off air"
   * card through the first minute of a broadcast, then had to reload to see it,
   * which reads as a broken page when the show has visibly started.
   *
   * `on-publish` already emitted `stream:live-now` and nothing on the web was
   * listening. This subscribes to it and refetches, so the hero flips within a
   * second of the encoder connecting, and costs no requests while the channel
   * is quiet.
   *
   * The event is treated as a nudge, not as data: the refetch is what decides
   * what is on air, so there is one source of truth rather than a partial
   * object pushed down a pipe.
   */
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }
    const source = new EventSource("/api/sse/channel");
    const nudge = (event: MessageEvent) => {
      // The opening frame only proves the connection is up; refetching on it
      // would fire a pointless request on every page load and every reconnect.
      if (typeof event.data === "string" && event.data.includes('"hello"')) {
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["channel", "main"] });
    };
    source.addEventListener("message", nudge);
    // A dropped connection is ordinary on mobile. EventSource reconnects by
    // itself, and the poll above is the floor if it never does, so this only
    // has to avoid logging noise.
    source.addEventListener("error", () => {});
    return () => {
      source.removeEventListener("message", nudge);
      source.close();
    };
  }, [queryClient]);

  if (isPending) {
    return <div className="mb-8 aspect-video w-full rounded-2xl bg-card" />;
  }

  const channel = data?.channel ?? null;
  const onNow = data?.onNow ?? null;
  const upNext = data?.upNext ?? [];

  // No flagship designated. Say so to an admin, show nothing to everyone else,
  // rather than rendering an empty frame that looks broken.
  if (!channel) {
    if (role !== "admin") return null;
    return (
      <div className="mb-8 rounded-2xl bg-card/60 px-6 py-8 text-center">
        <p className="text-sm font-semibold text-foreground">
          No main channel set
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Mark a stream as the main channel in Admin to give it this position.
        </p>
        <Button asChild className="mt-4 bg-sky-600 hover:bg-sky-500">
          <Link href="/admin/streams">Open Streams</Link>
        </Button>
      </div>
    );
  }

  const canWatch = channel.isLive && channel.hlsUrl && signedIn;

  return (
    <section className="mb-10">
      <div className="overflow-hidden rounded-2xl bg-background">
        {canWatch ? (
          // The channel is the one surface with breaks, an on-air card and
          // filler. Everything else on the site is a video page.
          <ChannelBreaks
            /*
             * Everything the on-air cards need, from the schedule the guide
             * already read. Nothing is written per show: a programme added this
             * afternoon appears tonight with nothing redrawn.
             */
            nowNext={{
              now: onNow
                ? { title: onNow.title, subtitle: onNow.subtitle }
                : null,
              next: upNext[0]
                ? {
                    title: upNext[0].title,
                    startLabel: clock(upNext[0].airsAt),
                    airsAt: upNext[0].airsAt,
                    subtitle: upNext[0].subtitle,
                    durationMin: upNext[0].durationMin,
                    pillar: upNext[0].pillar,
                    posterUrl: upNext[0].thumbnailUrl || undefined,
                  }
                : null,
              lineup: upNext.slice(0, 4).map((row) => ({
                startLabel: clock(row.airsAt),
                title: row.title,
              })),
            }}
          >
            {/* The poll result takes the picture here as well as on the watch
                page: most viewers meet the channel on the home page. */}
            <PollResultOverlay streamId={channel.id} />
            <VideoPlayer
              src={channel.hlsUrl}
              poster={channel.thumbnailUrl || channel.posterUrl}
              autoPlay
              isLive
              mediaId={channel.id}
            />
          </ChannelBreaks>
        ) : (
          /*
           * Off air, or signed out. The filler covers the first of those: an
           * always-on channel showing a poster and the words "Off air" is the
           * situation the filler creative exists for, and it was only ever
           * wired to a feed that dropped while still marked live.
           */
          <FillerScreen enabled={!(channel.isLive && !signedIn)}>
          <div className="relative flex aspect-video w-full items-center justify-center">
            <MediaImage
              src={channel.posterUrl || channel.thumbnailUrl}
              alt=""
              seed={channel.id}
              className="absolute inset-0 h-full w-full object-cover opacity-40"
            />
            <div className="relative flex flex-col items-center gap-3 px-6 text-center">
              {channel.isLive && !signedIn ? (
                <>
                  <Lock className="size-6 text-foreground/80" />
                  <p className="text-lg font-semibold text-foreground">
                    Live now. Sign in to watch.
                  </p>
                  <div className="mt-1 flex flex-wrap justify-center gap-2">
                    <Button asChild className="bg-sky-600 hover:bg-sky-500">
                      <Link href="/login?next=/home">Sign in</Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="bg-card text-foreground hover:bg-accent"
                    >
                      <Link href="/signup?next=/home">Create an account</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-muted-foreground">
                    Off air
                  </p>
                  {upNext[0] ? (
                    <p className="text-lg font-semibold text-foreground">
                      Back at {clock(upNext[0].airsAt)} with {upNext[0].title}
                    </p>
                  ) : (
                    <p className="text-lg font-semibold text-foreground">
                      {channel.title}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
          </FillerScreen>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
            {channel.isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                <Radio className="size-3" />
                Live
              </span>
            ) : null}
            {onNow?.title ?? channel.title}
          </h2>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {onNow?.subtitle || channel.tagline || "The EVO TV channel"}
          </p>
        </div>
        <Link
          href="/schedule"
          className="shrink-0 text-sm font-medium text-sky-400 hover:text-sky-300"
        >
          Full schedule
        </Link>
      </div>

      {/* What is next, on the channel it belongs to. */}
      {/*
        The first row is what comes on when this programme ends, and nothing on
        the list said so: three times and three titles read as a list, not as a
        queue, so a viewer had to compare the clock against the current time to
        work out which one was imminent.

        The rows are ordered by airtime, so index 0 is the answer.
      */}
      {upNext.length > 0 ? (
        <ul className="mt-4 space-y-0.5">
          {upNext.map((row, i) => (
            <li
              key={row.id}
              className={cn(
                "flex items-baseline gap-4 px-4 py-3",
                // Fill, not a rule between rows. The first row sits one step
                // brighter so the queue reads top-down without a line.
                i === 0 ? "rounded-xl bg-card" : "rounded-xl bg-card/40",
              )}
            >
              <span className="w-12 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                {clock(row.airsAt)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">
                  {row.title}
                </span>
                {row.subtitle ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {row.subtitle}
                  </span>
                ) : null}
              </span>
              {i === 0 ? (
                <span className="shrink-0 rounded-md bg-sky-400/20 px-2 py-1 text-xs font-medium text-sky-300">
                  Up next
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
