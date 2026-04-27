"use client";

import * as React from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Coins, Trophy } from "lucide-react";
import {
  getCoinBalance,
  listPredictionsForEvent,
  listOpenPredictionEvents,
} from "@/lib/mock/predictions";
import { getEventById, listMatchesForEvent } from "@/lib/mock/events";
import { listTeams } from "@/lib/mock/teams";
import { listGames } from "@/lib/mock/games";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MatchPickCard } from "@/components/predictions/match-pick-card";
import { CoinPill } from "@/components/predictions/coin-pill";

export default function PredictionEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useMockAuth();
  const userId = user?.id ?? "user_current";
  const [refreshKey, setRefreshKey] = React.useState(0);

  const event = useQuery({
    queryKey: ["predictions", "event", eventId],
    queryFn: () => getEventById(eventId),
  });
  const summary = useQuery({
    queryKey: ["predictions", "events"],
    queryFn: () => listOpenPredictionEvents(),
  });
  const matches = useQuery({
    queryKey: ["predictions", "matches", eventId],
    queryFn: () => listMatchesForEvent(eventId),
  });
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => listTeams() });
  const games = useQuery({ queryKey: ["games"], queryFn: () => listGames() });
  const balance = useQuery({
    queryKey: ["predictions", "balance", userId, refreshKey],
    queryFn: () => getCoinBalance(userId),
  });
  const myPredictions = useQuery({
    queryKey: ["predictions", "my-event", eventId, userId, refreshKey],
    queryFn: () => listPredictionsForEvent(eventId, userId),
  });

  const ev = event.data;
  const gameName = (games.data ?? []).find((g) => g.id === ev?.gameId)?.shortName;
  const teamMap = new Map((teams.data ?? []).map((t) => [t.id, t]));
  const matchList = matches.data ?? [];
  const eventSummary = (summary.data ?? []).find((s) => s.eventId === eventId);

  if (event.isFetched && !ev) notFound();

  const onSubmitted = () => setRefreshKey((k) => k + 1);

  const totalStaked = (myPredictions.data ?? []).reduce((s, p) => s + p.coinsStaked, 0);
  const totalPotential = (myPredictions.data ?? []).reduce(
    (s, p) => s + (p.status === "lost" ? 0 : p.payoutCoins),
    0,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 text-neutral-400 hover:text-neutral-100">
        <Link href="/predictions">
          <ArrowLeft className="h-4 w-4" /> Back to predictions
        </Link>
      </Button>

      {event.isPending || !ev ? (
        <div className="space-y-3">
          <Skeleton className="h-44 w-full rounded-xl bg-neutral-900" />
          <Skeleton className="h-32 w-full rounded-xl bg-neutral-900" />
        </div>
      ) : (
        <>
          <header className="mb-6 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60">
            <div className="relative aspect-[3/1] w-full overflow-hidden">
              <img src={ev.bannerUrl} alt={ev.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
            </div>
            <div className="space-y-2 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-500">
                {ev.status === "live" ? (
                  <span className="flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> Live
                  </span>
                ) : (
                  <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-300">
                    Scheduled
                  </span>
                )}
                {gameName && <span className="text-sky-400">{gameName}</span>}
                <span className="flex items-center gap-1 text-neutral-400">
                  <Calendar className="h-3 w-3" />
                  {new Date(ev.startsAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <h1 className="text-xl font-bold text-neutral-50 sm:text-2xl">{ev.title}</h1>
              <p className="line-clamp-2 text-sm text-neutral-400">{ev.description}</p>
              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-neutral-400">
                <span className="flex items-center gap-1">
                  <Trophy className="h-3.5 w-3.5 text-amber-300" /> Prize pool:
                  <CoinPill coins={eventSummary?.prizePoolCoins ?? 5000} tone="amber" className="ml-1" />
                </span>
                <span className="flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5 text-amber-300" /> Your balance:
                  <CoinPill coins={balance.data?.coins ?? 0} tone="muted" className="ml-1" />
                </span>
              </div>
            </div>
          </header>

          {(myPredictions.data?.length ?? 0) > 0 && (
            <section className="mb-6 grid gap-3 sm:grid-cols-3">
              <MiniStat label="Picks placed" value={(myPredictions.data ?? []).length.toString()} />
              <MiniStat label="Coins staked" value={totalStaked.toLocaleString()} />
              <MiniStat label="Potential payout" value={totalPotential.toLocaleString()} tone="amber" />
            </section>
          )}

          <h2 className="mb-3 text-lg font-semibold text-neutral-100">Matches</h2>
          {matches.isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-44 w-full rounded-xl bg-neutral-900" />
              <Skeleton className="h-44 w-full rounded-xl bg-neutral-900" />
            </div>
          ) : matchList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-8 text-center">
              <p className="text-sm text-neutral-400">
                No matches scheduled yet. Picks will open once teams are confirmed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {matchList.map((match) => {
                const teamA = teamMap.get(match.teamAId) ?? null;
                const teamB = teamMap.get(match.teamBId) ?? null;
                const existing = (myPredictions.data ?? []).find((p) => p.matchId === match.id) ?? null;
                return (
                  <MatchPickCard
                    key={match.id}
                    match={match}
                    teamA={teamA}
                    teamB={teamB}
                    existing={existing}
                    coinBalance={balance.data?.coins ?? 0}
                    onSubmitted={onSubmitted}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <div
      className={`rounded-xl border bg-neutral-900/60 p-3 ${
        tone === "amber" ? "border-amber-500/20" : "border-neutral-800"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone === "amber" ? "text-amber-300" : "text-neutral-100"}`}>
        {value}
      </p>
    </div>
  );
}
