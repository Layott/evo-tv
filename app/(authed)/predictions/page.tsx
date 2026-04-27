"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Coins, Crown, Trophy } from "lucide-react";
import { listOpenPredictionEvents, getCoinBalance, listMyPredictions } from "@/lib/mock/predictions";
import { listGames } from "@/lib/mock/games";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PredictionEventCard } from "@/components/predictions/event-card";
import { formatCoins } from "@/components/predictions/coin-pill";

function SkeletonCard() {
  return <Skeleton className="h-32 rounded-xl bg-neutral-900 sm:h-40" />;
}

export default function PredictionsIndexPage() {
  const { user, role } = useMockAuth();
  const userId = user?.id ?? "user_current";

  const games = useQuery({ queryKey: ["games"], queryFn: () => listGames() });
  const events = useQuery({
    queryKey: ["predictions", "events"],
    queryFn: () => listOpenPredictionEvents(),
  });
  const balance = useQuery({
    queryKey: ["predictions", "balance", userId],
    queryFn: () => getCoinBalance(userId),
  });
  const my = useQuery({
    queryKey: ["predictions", "my", userId],
    queryFn: () => listMyPredictions(userId),
  });

  const gameMap = new Map((games.data ?? []).map((g) => [g.id, g]));
  const list = events.data ?? [];
  const live = list.filter((e) => e.status === "live");
  const upcoming = list.filter((e) => e.status === "scheduled");

  const myPicks = my.data ?? [];
  const won = myPicks.filter((p) => p.status === "won").length;
  const open = myPicks.filter((p) => p.status === "open").length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Predictions</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Stake EVO Coins on match winners. Picks lock at game start.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="border-neutral-800 bg-neutral-900 hover:bg-neutral-800">
          <Link href="/predictions/leaderboard">
            <Crown className="h-4 w-4" /> Leaderboard
          </Link>
        </Button>
      </header>

      <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Coin balance"
          value={balance.isPending ? "—" : formatCoins(balance.data?.coins ?? 0)}
          icon={<Coins className="h-4 w-4 text-amber-300" />}
          loading={balance.isPending}
        />
        <StatCard
          label="Open picks"
          value={my.isPending ? "—" : open.toString()}
          loading={my.isPending}
          tone="sky"
        />
        <StatCard
          label="Wins"
          value={my.isPending ? "—" : won.toString()}
          icon={<Trophy className="h-4 w-4 text-emerald-300" />}
          loading={my.isPending}
        />
        <StatCard
          label="Total wagered"
          value={
            balance.isPending
              ? "—"
              : `${(balance.data?.lifetimeStakes ?? 0).toLocaleString()} coins`
          }
          loading={balance.isPending}
        />
      </section>

      {role === "guest" && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-200">
          Sign in to start placing picks. Guests get a free 1,000 coin balance to try the experience.
        </div>
      )}

      {events.isPending ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-10">
          {live.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-neutral-100">
                <span className="flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-red-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                  Live
                </span>
                Open right now
              </h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {live.map((ev) => (
                  <PredictionEventCard key={ev.eventId} event={ev} gameName={gameMap.get(ev.gameId)?.shortName} />
                ))}
              </div>
            </section>
          )}
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold tracking-tight text-neutral-100">Upcoming</h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {upcoming.map((ev) => (
                  <PredictionEventCard key={ev.eventId} event={ev} gameName={gameMap.get(ev.gameId)?.shortName} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  loading,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  loading?: boolean;
  tone?: "sky" | "amber";
}) {
  return (
    <div
      className={`rounded-xl border bg-neutral-900/60 p-4 ${
        tone === "sky"
          ? "border-sky-500/20"
          : tone === "amber"
            ? "border-amber-500/20"
            : "border-neutral-800"
      }`}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-neutral-500">
        <span>{label}</span>
        {icon}
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums text-neutral-100">{loading ? "—" : value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-10 text-center">
      <Trophy className="mx-auto h-10 w-10 text-neutral-600" />
      <p className="mt-3 text-sm font-semibold text-neutral-200">No open predictions right now.</p>
      <p className="mt-1 text-xs text-neutral-500">Check back when the next event goes live.</p>
      <Button asChild variant="outline" className="mt-4 border-neutral-800 bg-neutral-900 hover:bg-neutral-800">
        <Link href="/events">Browse events</Link>
      </Button>
    </div>
  );
}
