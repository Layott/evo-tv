"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Users } from "lucide-react";
import { listGames } from "@/lib/client";

function formatPlayers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function categoryLabel(c: string): string {
  switch (c) {
    case "br":
      return "Battle Royale";
    case "fps":
      return "FPS";
    case "moba":
      return "MOBA";
    case "sports":
      return "Sports";
    case "fighting":
      return "Fighting";
    default:
      return c.toUpperCase();
  }
}

function SkeletonTile() {
  return <div className="aspect-[4/5] animate-pulse rounded-xl bg-neutral-900" />;
}

export default function CategoriesPage() {
  const games = useQuery({ queryKey: ["games"], queryFn: () => listGames() });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Browse by game. Dive into live streams, upcoming events, teams, and players.
        </p>
      </header>

      {games.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonTile key={i} />
          ))}
        </div>
      ) : (games.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-8 text-center text-sm text-neutral-500">
          No games available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {games.data!.map((g) => (
            <Link
              key={g.id}
              href={`/categories/${g.slug}`}
              className="group relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 transition-colors hover:border-neutral-700"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <img
                  src={g.coverUrl}
                  alt={g.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 space-y-2 p-4">
                  <span className="inline-flex rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                    {categoryLabel(g.category)}
                  </span>
                  <h3 className="text-lg font-bold text-white">{g.name}</h3>
                  <p className="text-xs text-neutral-300">{g.shortName}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="flex items-center gap-1 text-[11px] text-neutral-300">
                      <Users className="h-3 w-3" />
                      {formatPlayers(g.activePlayers)} active
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-sky-400">
                      Enter
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
