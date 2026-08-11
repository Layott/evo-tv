"use client";

import Link from "next/link";
import { MediaImage } from "@/components/ui/media-image";
import { Eye } from "lucide-react";
import type { Stream, Game } from "@/lib/types";

interface LiveNowProps {
  streams: Stream[];
  games: Game[];
  loading: boolean;
}

function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function LiveBadge() {
  return (
    <span className="flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-red-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
      Live
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="space-y-2">
      <div className="aspect-video animate-pulse rounded-xl bg-neutral-900" />
      <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-900" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-900" />
    </div>
  );
}

export function LiveNow({ streams, games, loading }: LiveNowProps) {
  const gameMap = new Map(games.map((g) => [g.id, g]));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Live Now</h2>
        <Link
          href="/discover"
          className="text-xs font-medium text-sky-400 hover:text-sky-300"
        >
          See all
        </Link>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : streams.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 text-center text-sm text-neutral-500">
          No streams live right now. Check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {streams.map((s) => {
            const game = s.gameId ? gameMap.get(s.gameId) : undefined;
            return (
              <Link
                key={s.id}
                href={`/stream/${s.id}`}
                className="group overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 transition-colors hover:border-neutral-700"
              >
                <div className="relative aspect-video overflow-hidden">
                  <MediaImage
                    src={s.thumbnailUrl}
                    alt={s.title}
                    seed={s.id}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute left-2 top-2">
                    <LiveBadge />
                  </div>
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] text-neutral-200">
                    <Eye className="h-3 w-3" /> {formatViewers(s.viewerCount)}
                  </div>
                </div>
                <div className="space-y-1 p-3">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-100">
                    {s.title}
                  </h3>
                  <p className="text-xs text-neutral-400">{s.streamerName}</p>
                  {game && (
                    <p className="text-[11px] text-sky-400">{game.shortName}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default LiveNow;
