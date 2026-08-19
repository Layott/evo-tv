"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Radio, Clock, Eye, Heart, Share2, Info } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers";
import { BackButton } from "@/components/shell/back-button";
import {
  getMainChannel,
  listLiveStreams,
  listScheduleForDay,
  type EpgRow,
} from "@/lib/client";
import { listTrendingClips } from "@/lib/client";
import { listEvents } from "@/lib/client";

function fmtViewers(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

const CHANNEL_TZ = "Africa/Lagos";

/** Today as the channel's own clock sees it, YYYY-MM-DD. */
function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHANNEL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function slotLabel(row: EpgRow): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: CHANNEL_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const start = new Date(row.airsAt);
  const end = new Date(start.getTime() + row.durationMin * 60_000);
  return `${fmt.format(start)} - ${fmt.format(end)}`;
}

export default function ChannelPage() {
  const router = useRouter();
  const { role, toggleFollow, isFollowing } = useAuth();
  const following = isFollowing("streamer", "channel_main");
  const channelQ = useQuery({ queryKey: ["channel", "main"], queryFn: getMainChannel });
  const liveQ = useQuery({
    queryKey: ["streams", "live", "ex-channel"],
    queryFn: () => listLiveStreams(),
  });
  const clipsQ = useQuery({ queryKey: ["clips", "trending"], queryFn: () => listTrendingClips(6) });
  const eventsQ = useQuery({ queryKey: ["events", "upcoming"], queryFn: () => listEvents({ status: "scheduled" }) });

  const channel = channelQ.data;

  /**
   * Today's listing, from the real guide.
   *
   * This was six hardcoded rows in the component ("Weekly Recap: EVO Week 4",
   * "Film Room - Team Alpha", "Casters' Cut"). None of it existed, and because
   * it was written inline rather than imported from `lib/mock` it survived the
   * mock purge. It is the same feed `/schedule` reads, trimmed to the next few
   * hours because this is a summary and the full day has its own page.
   */
  const scheduleQ = useQuery({
    queryKey: ["schedule", "channel-today"],
    queryFn: () => listScheduleForDay(todayKey()),
  });

  const uptime = React.useMemo(() => {
    if (!channel?.isLive || !channel.startedAt) return null;
    const ms = Date.now() - new Date(channel.startedAt).getTime();
    if (ms < 0) return null;
    const h = Math.floor(ms / 3_600_000);
    if (h < 1) return `On air ${Math.max(1, Math.floor(ms / 60_000))}m`;
    return `On air ${h}h`;
  }, [channel?.isLive, channel?.startedAt]);

  // What is on now plus the next few hours. Rows that already finished are of
  // no use on a channel page, and the whole day is a click away.
  const upNext = React.useMemo(() => {
    const rows = scheduleQ.data ?? [];
    const now = Date.now();
    return rows
      .filter(
        (r) => new Date(r.airsAt).getTime() + r.durationMin * 60_000 > now,
      )
      .slice(0, 6);
  }, [scheduleQ.data]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <BackButton fallbackHref="/home" />
        <button
          type="button"
          onClick={() => {
            if (typeof navigator !== "undefined" && "share" in navigator) {
              navigator.share({ title: "EVO TV Channel", url: window.location.href }).catch(() => {});
            } else {
              toast.success("Link copied");
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-card/70 px-3 py-1.5 text-xs text-foreground/80 hover:bg-card hover:text-sky-300"
        >
          <Share2 className="h-3.5 w-3.5" /> Share
        </button>
      </div>

      <section className="relative overflow-hidden rounded-2xl bg-sky-500/10">
        <div className="relative grid gap-6 p-6 md:grid-cols-[2fr,1fr] md:p-8">
          <div>
            <div className="mb-3 inline-flex items-center gap-2">
              {/* Read from the stream row. This was hardcoded, so the channel
                  announced itself as live even with nothing being broadcast. */}
              {channel?.isLive ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  Off air
                </span>
              )}
              <span className="rounded-md bg-sky-500/25 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                Flagship
              </span>
              <span className="rounded-md bg-card/80 px-2 py-0.5 text-[10px] text-muted-foreground">
                24 / 7
              </span>
            </div>
            <div className="mb-2 flex items-center gap-3">
              {/* The mark is a light logo, so its tile stays ink on either theme
                  rather than following the surface tokens. */}
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink p-2">
                <Image
                  src="/evo-logo/evo-tv-152.png"
                  alt="EVO TV"
                  width={56}
                  height={56}
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  {channel?.title ?? "EVO TV Channel"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {channel?.description ?? "Non-stop African esports."}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {channel?.isLive && typeof channel.viewerCount === "number" ? (
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" /> {fmtViewers(channel.viewerCount)} watching
                </span>
              ) : null}
              {/* Uptime is measured, not asserted. It read "Running 72h+" on a
                  channel that had never been on air. */}
              {uptime ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {uptime}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Radio className="h-3.5 w-3.5 text-sky-400" /> Simulcast on app + web
              </span>
            </div>
            <div className="mt-6 flex gap-3">
              <Link
                href="/stream/channel_main"
                /* sky-500/600 are the two fill steps that are NOT theme-indirected,
                   so the hover darkens the same way on paper and on ink. */
                className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sky-600"
              >
                Watch now
              </Link>
              {/* This was a toast and nothing else: it said "Following EVO TV
                  Channel" without writing a follow, and the state was gone on
                  reload. It now goes through the real follows table, and a
                  guest is sent to sign in rather than being told it worked. */}
              <button
                type="button"
                onClick={() => {
                  if (role === "guest") {
                    router.push("/login?next=/channel");
                    return;
                  }
                  toggleFollow("streamer", "channel_main");
                }}
                aria-pressed={following}
                /* Both states are fills. Followed used to be an outline while
                   unfollowed was a fill, so the button changed shape rather
                   than weight, and the ring is banned besides. */
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-colors ${
                  following
                    ? "bg-sky-500/25 text-sky-100 hover:bg-sky-500/35"
                    : "bg-input/40 text-foreground hover:bg-input/60 hover:text-sky-300"
                }`}
              >
                <Heart className={`h-4 w-4 ${following ? "fill-current" : ""}`} />
                {following ? "Following" : "Follow"}
              </button>
            </div>
          </div>

          <div className="relative hidden overflow-hidden rounded-xl md:block">
            <Image
              src="/evo-logo/evo-tv-hero.png"
              alt="EVO TV channel preview"
              width={640}
              height={360}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Today&apos;s schedule</h2>
          <Link
            href="/schedule"
            className="text-xs font-medium text-sky-400 hover:text-sky-300"
          >
            Full week
          </Link>
        </div>
        {scheduleQ.isPending ? (
          <div className="h-52 rounded-xl bg-card" />
        ) : upNext.length === 0 ? (
          <p className="rounded-xl border border-border bg-card/40 px-4 py-6 text-sm text-muted-foreground">
            Nothing else scheduled today.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card/40">
            <table className="w-full text-sm">
              <tbody>
                {upNext.map((row, i) => (
                  <tr key={row.id} className={i % 2 === 0 ? "bg-card/30" : ""}>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {slotLabel(row)}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {row.title}
                      {row.subtitle ? (
                        <span className="block text-xs text-muted-foreground">
                          {row.subtitle}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {row.state === "live" ? (
                        <span className="inline-flex rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          On now
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                          {row.pillar}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">All times WAT.</p>
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Live across EVO TV</h2>
          <Link href="/discover" className="text-xs font-medium text-sky-400 hover:text-sky-300">
            See all →
          </Link>
        </div>
        {liveQ.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-xl bg-card" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(liveQ.data ?? [])
              .filter((s) => s.id !== "channel_main")
              .slice(0, 6)
              .map((s) => (
                <Link
                  key={s.id}
                  href={`/stream/${s.id}`}
                  className="group overflow-hidden rounded-xl border border-border bg-card/60 transition-colors hover:bg-card"
                >
                  <div className="relative aspect-video bg-background">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-80" />
                    <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                      <span className="h-1 w-1 rounded-full bg-red-500" /> Live
                    </div>
                    {typeof s.viewerCount === "number" ? (
                      <div className="absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] text-paper">
                        {fmtViewers(s.viewerCount)}
                      </div>
                    ) : null}
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-1 text-sm font-medium text-foreground group-hover:text-sky-300">
                      {s.title}
                    </div>
                    <div className="text-xs text-muted-foreground">{s.streamerName}</div>
                  </div>
                </Link>
              ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Trending clips</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {(clipsQ.data ?? []).slice(0, 6).map((c) => (
            <Link
              key={c.id}
              href={`/clips/${c.id}`}
              className="group overflow-hidden rounded-xl bg-card/60 hover:bg-card"
            >
              <div className="relative aspect-[9/16] bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-80" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                  <div className="line-clamp-2 text-[11px] font-medium text-foreground">{c.title}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Upcoming on the channel</h2>
          <Link href="/events" className="text-xs font-medium text-sky-400 hover:text-sky-300">
            All events →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(eventsQ.data ?? []).slice(0, 3).map((e) => (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              className="group rounded-xl bg-card/60 p-4 transition-colors hover:bg-card"
            >
              <div className="mb-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="rounded-md bg-sky-500/25 px-1.5 py-0.5 text-sky-100">
                  Tier {e.tier.toUpperCase()}
                </span>
                {new Date(e.startsAt).toLocaleDateString()}
              </div>
              <div className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-sky-300">
                {e.title}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{e.region}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10 flex items-start gap-3 rounded-xl border border-border bg-card/40 p-4 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
        <p>
          The EVO TV Channel is the main feed: one continuous broadcast following the
          schedule above. Everything else on the platform sits alongside it.
        </p>
      </section>
    </div>
  );
}
