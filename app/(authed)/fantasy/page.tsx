"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Sparkles, Trophy } from "lucide-react";
import { listLeagues } from "@/lib/mock/fantasy";
import { listGames } from "@/lib/mock/games";
import { eventBanner } from "@/lib/mock/_media";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeagueCard } from "@/components/fantasy/league-card";

export default function FantasyIndexPage() {
  const { user } = useMockAuth();
  const userId = user?.id ?? "user_current";

  const all = useQuery({ queryKey: ["fantasy", "all"], queryFn: () => listLeagues() });
  const games = useQuery({ queryKey: ["games"], queryFn: () => listGames() });
  const gameMap = new Map((games.data ?? []).map((g) => [g.id, g]));

  const list = all.data ?? [];
  const mine = list.filter((l) => l.members.includes(userId));
  const discover = list.filter((l) => !l.members.includes(userId));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-neutral-50">
            <Trophy className="h-6 w-6 text-amber-300" /> Fantasy Esports
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Build a 5-player roster under the salary cap. Climb leaderboards. Win EVO Coins.
          </p>
        </div>
        <Button asChild className="bg-sky-600 text-white hover:bg-sky-500">
          <Link href="/fantasy/leagues/new">
            <Plus className="h-4 w-4" /> Create league
          </Link>
        </Button>
      </header>

      <Tabs defaultValue={mine.length > 0 ? "mine" : "discover"}>
        <TabsList className="bg-neutral-900/60">
          <TabsTrigger value="mine">My Leagues ({mine.length})</TabsTrigger>
          <TabsTrigger value="discover">Discover ({discover.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-4">
          {all.isPending ? (
            <SkeletonGrid />
          ) : mine.length === 0 ? (
            <EmptyState
              title="You aren't in any leagues yet."
              description="Join one from the Discover tab or create your own."
              cta={
                <Button asChild className="bg-sky-600 text-white hover:bg-sky-500">
                  <Link href="/fantasy/leagues/new">
                    <Plus className="h-4 w-4" /> Create league
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((league) => (
                <LeagueCard
                  key={league.id}
                  league={league}
                  gameName={gameMap.get(league.gameId)?.shortName}
                  bannerUrl={eventBanner(league.bannerSeed)}
                  isMember
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="discover" className="mt-4">
          {all.isPending ? (
            <SkeletonGrid />
          ) : discover.length === 0 ? (
            <EmptyState
              title="No leagues to discover right now."
              description="Be the first — spin up a league and invite your friends."
              cta={
                <Button asChild className="bg-sky-600 text-white hover:bg-sky-500">
                  <Link href="/fantasy/leagues/new">
                    <Plus className="h-4 w-4" /> Create league
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {discover.map((league) => (
                <LeagueCard
                  key={league.id}
                  league={league}
                  gameName={gameMap.get(league.gameId)?.shortName}
                  bannerUrl={eventBanner(league.bannerSeed)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-56 rounded-xl bg-neutral-900" />
      ))}
    </div>
  );
}

function EmptyState({
  title,
  description,
  cta,
}: {
  title: string;
  description: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-10 text-center">
      <Sparkles className="mx-auto h-10 w-10 text-neutral-600" />
      <p className="mt-3 text-sm font-semibold text-neutral-200">{title}</p>
      <p className="mt-1 text-xs text-neutral-500">{description}</p>
      <div className="mt-4">{cta}</div>
    </div>
  );
}
