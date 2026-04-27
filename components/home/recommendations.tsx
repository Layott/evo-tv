"use client";

import Link from "next/link";
import { Sparkles, Clock } from "lucide-react";
import type { Vod, Game } from "@/lib/types";

interface RecommendationsProps {
  vods: Vod[];
  games: Game[];
  loading: boolean;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function SkeletonCard() {
  return (
    <div className="space-y-2">
      <div className="aspect-video animate-pulse rounded-xl bg-neutral-900" />
      <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-900" />
    </div>
  );
}

export function Recommendations({ vods, games, loading }: RecommendationsProps) {
  const gameMap = new Map(games.map((g) => [g.id, g]));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Sparkles className="h-4 w-4 text-sky-400" />
          Recommended for you
        </h2>
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
      ) : vods.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 text-center text-sm text-neutral-500">
          We'll tailor recommendations as you watch more.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {vods.map((v) => {
            const game = gameMap.get(v.gameId);
            return (
              <Link
                key={v.id}
                href={`/vod/${v.id}`}
                className="group overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 transition-colors hover:border-neutral-700"
              >
                <div className="relative aspect-video overflow-hidden">
                  <img
                    src={v.thumbnailUrl}
                    alt={v.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] text-neutral-200">
                    <Clock className="h-3 w-3" /> {formatDuration(v.durationSec)}
                  </div>
                </div>
                <div className="space-y-1 p-3">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                    {v.title}
                  </h3>
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

export default Recommendations;
