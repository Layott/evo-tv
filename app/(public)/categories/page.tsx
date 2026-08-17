"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Users } from "@/components/icons";
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
  return <div className="aspect-[4/5] rounded-xl bg-card" />;
}

export default function CategoriesPage() {
  const games = useQuery({ queryKey: ["games"], queryFn: () => listGames() });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
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
        <div className="rounded-xl border border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
          No games available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {games.data!.map((g) => (
            <Link
              key={g.id}
              href={`/categories/${g.slug}`}
              className="group relative overflow-hidden rounded-xl bg-card/60 hover:bg-card"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <img
                  src={g.coverUrl}
                  alt={g.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 space-y-2 p-4">
                  <span className="inline-flex rounded-md bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-100">
                    {categoryLabel(g.category)}
                  </span>
                  <h3 className="text-lg font-bold text-white">{g.name}</h3>
                  {/* The scrim below is a fixed black, so the type on it has to be
                      a fixed light too. `text-foreground` flipped to near-black
                      here the moment the light theme landed. */}
                  <p className="text-xs text-paper/80">{g.shortName}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="flex items-center gap-1 text-[11px] text-paper/80">
                      <Users className="h-3 w-3" />
                      {formatPlayers(g.activePlayers)} active
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-sky-100">
                      Enter
                      <ArrowRight className="h-3.5 w-3.5" />
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
