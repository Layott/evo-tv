"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Radio, Clock, Eye, Heart, Share2, Info } from "lucide-react";
import { BackButton } from "@/components/shell/back-button";
import { getMainChannel, listLiveStreams } from "@/lib/mock/streams";
import { listTrendingClips } from "@/lib/mock/vods";
import { listEvents } from "@/lib/mock/events";

function fmtViewers(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

export default function ChannelPage() {
  const channelQ = useQuery({ queryKey: ["channel", "main"], queryFn: getMainChannel });
  const liveQ = useQuery({
    queryKey: ["streams", "live", "ex-channel"],
    queryFn: () => listLiveStreams(),
  });
  const clipsQ = useQuery({ queryKey: ["clips", "trending"], queryFn: () => listTrendingClips(6) });
  const eventsQ = useQuery({ queryKey: ["events", "upcoming"], queryFn: () => listEvents({ status: "scheduled" }) });

  const channel = channelQ.data;

  const now = React.useMemo(() => [
    { slot: "00:00 – 02:00", title: "Weekly Recap: EVO Week 4", tag: "Recap" },
    { slot: "02:00 – 04:00", title: "Film Room — Team Alpha", tag: "Analysis" },
    { slot: "04:00 – 06:00", title: "Best Plays Mixtape", tag: "Highlights" },
    { slot: "06:00 – 08:00", title: "Evo Talk S3 E12", tag: "Show" },
    { slot: "08:00 – 10:00", title: "CoD Mobile Scrim Night", tag: "Live" },
    { slot: "10:00 – 12:00", title: "Casters' Cut", tag: "Podcast" },
  ], []);

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
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs text-neutral-300 hover:border-sky-500/60 hover:text-sky-300"
        >
          <Share2 className="h-3.5 w-3.5" /> Share
        </button>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-sky-500/20 bg-[#05091a]">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/15 via-transparent to-cyan-400/10" />
        <div className="relative grid gap-6 p-6 md:grid-cols-[2fr,1fr] md:p-8">
          <div>
            <div className="mb-3 inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> Live
              </span>
              <span className="rounded-md border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                Flagship
              </span>
              <span className="rounded-md border border-neutral-800 bg-neutral-900/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400">
                24 / 7
              </span>
            </div>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/30 bg-[#05091a] p-2">
                <Image
                  src="/evo-logo/evo-tv-152.png"
                  alt="EVO TV"
                  width={56}
                  height={56}
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-neutral-50 md:text-3xl">
                  {channel?.title ?? "EVO TV Channel"}
                </h1>
                <p className="text-sm text-neutral-400">
                  {channel?.description ?? "Non-stop African esports."}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" /> {channel ? fmtViewers(channel.viewerCount) : "…"} watching
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Running 72h+
              </span>
              <span className="inline-flex items-center gap-1">
                <Radio className="h-3.5 w-3.5 text-sky-400" /> Simulcast on app + web
              </span>
            </div>
            <div className="mt-6 flex gap-3">
              <Link
                href="/stream/channel_main"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition-opacity hover:opacity-90"
              >
                Watch now
              </Link>
              <button
                type="button"
                onClick={() => toast.success("Following EVO TV Channel")}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-700 px-5 py-2.5 text-sm text-neutral-200 transition-colors hover:border-sky-400 hover:text-sky-300"
              >
                <Heart className="h-4 w-4" /> Follow
              </button>
            </div>
          </div>

          <div className="relative hidden overflow-hidden rounded-xl border border-neutral-800 md:block">
            <Image
              src="/evo-logo/evo-tv-hero.png"
              alt="EVO TV channel preview"
              width={640}
              height={360}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#05091a] via-transparent to-transparent" />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Today&apos;s schedule</h2>
          <span className="text-xs text-neutral-500">All times WAT</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
          <table className="w-full text-sm">
            <tbody>
              {now.map((row, i) => (
                <tr key={row.slot} className={i % 2 === 0 ? "bg-neutral-900/30" : ""}>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-400">{row.slot}</td>
                  <td className="px-4 py-3 text-neutral-100">{row.title}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400">
                      {row.tag}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
              <div key={i} className="h-40 animate-pulse rounded-xl bg-neutral-900" />
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
                  className="group overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 transition-colors hover:border-neutral-700"
                >
                  <div className="relative aspect-video bg-neutral-950">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-80" />
                    <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-400">
                      <span className="h-1 w-1 animate-pulse rounded-full bg-red-500" /> Live
                    </div>
                    <div className="absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] text-neutral-200">
                      {fmtViewers(s.viewerCount)}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-1 text-sm font-medium text-neutral-100 group-hover:text-sky-300">
                      {s.title}
                    </div>
                    <div className="text-xs text-neutral-500">{s.streamerName}</div>
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
              className="group overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 transition-colors hover:border-sky-500/40"
            >
              <div className="relative aspect-[9/16] bg-neutral-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-80" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                  <div className="line-clamp-2 text-[11px] font-medium text-neutral-100">{c.title}</div>
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
              className="group rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 transition-colors hover:border-sky-500/40"
            >
              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-500">
                <span className="rounded-md border border-sky-400/30 bg-sky-500/10 px-1.5 py-0.5 text-sky-300">
                  Tier {e.tier.toUpperCase()}
                </span>
                {new Date(e.startsAt).toLocaleDateString()}
              </div>
              <div className="line-clamp-2 text-sm font-semibold text-neutral-100 group-hover:text-sky-300">
                {e.title}
              </div>
              <div className="mt-1 text-xs text-neutral-500">{e.region}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10 flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-xs text-neutral-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
        <p>
          The EVO TV Channel runs 24/7 on localhost during dev. In production, this is the flagship
          broadcast feed — programmatic mix of simulcasts, shows, highlights, and paid placements.
          Free viewers see pre-roll ads; Premium subscribers get an ad-free feed with a higher bitrate ladder.
        </p>
      </section>
    </div>
  );
}
