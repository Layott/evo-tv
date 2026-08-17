"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users, Trophy } from "lucide-react";
import { listGames, listTeams } from "@/lib/client";
import type { Team } from "@/lib/types";

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function TeamCard({ team }: { team: Team }) {
  const winRate = team.wins + team.losses === 0 ? 0 : Math.round((team.wins / (team.wins + team.losses)) * 100);
  return (
    <Link
      href={`/team/${team.slug}`}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3 transition-colors hover:bg-card"
    >
      <img
        src={team.logoUrl}
        alt={team.name}
        className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{team.name}</p>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-sky-300">
            {team.tag}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {team.country} · {team.region}
        </p>
        <div className="mt-1 flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-amber-300">
            <Trophy className="h-3 w-3" /> #{team.ranking}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3 w-3" /> {formatFollowers(team.followers)}
          </span>
          <span className="text-sky-400">
            {team.wins}-{team.losses} · {winRate}%
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function TeamsIndexPage() {
  const games = useQuery({ queryKey: ["games"], queryFn: () => listGames() });
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => listTeams() });

  const grouped = new Map<string, Team[]>();
  for (const t of teams.data ?? []) {
    if (!grouped.has(t.gameId)) grouped.set(t.gameId, []);
    grouped.get(t.gameId)!.push(t);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          African esports organizations across every supported game.
        </p>
      </header>

      {teams.isPending || games.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-card" />
          ))}
        </div>
      ) : (teams.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
          No teams available yet.
        </div>
      ) : (
        <div className="space-y-10">
          {(games.data ?? []).map((g) => {
            const list = grouped.get(g.id) ?? [];
            if (list.length === 0) return null;
            const sorted = [...list].sort((a, b) => a.ranking - b.ranking);
            return (
              <section key={g.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold tracking-tight">{g.name}</h2>
                  <Link
                    href={`/categories/${g.slug}`}
                    className="text-xs font-medium text-sky-400 hover:text-sky-300"
                  >
                    See all
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {sorted.map((t) => (
                    <TeamCard key={t.id} team={t} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
