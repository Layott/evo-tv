"use client";

import * as React from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Crown,
  Plus,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  getLeagueById,
  getLineup,
  joinLeague,
  listActivityForLeague,
  listLeagueLeaderboard,
  scoringLabel,
} from "@/lib/mock/fantasy";
import { listGames } from "@/lib/mock/games";
import { eventBanner } from "@/lib/mock/_media";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCoins } from "@/components/predictions/coin-pill";

export default function FantasyLeaguePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useMockAuth();
  const userId = user?.id ?? "user_current";
  const [refreshKey, setRefreshKey] = React.useState(0);

  const league = useQuery({
    queryKey: ["fantasy", "league", id, refreshKey],
    queryFn: () => getLeagueById(id),
  });
  const games = useQuery({ queryKey: ["games"], queryFn: () => listGames() });
  const standings = useQuery({
    queryKey: ["fantasy", "standings", id, refreshKey],
    queryFn: () => listLeagueLeaderboard(id),
  });
  const activity = useQuery({
    queryKey: ["fantasy", "activity", id, refreshKey],
    queryFn: () => listActivityForLeague(id, 8),
  });
  const myLineup = useQuery({
    queryKey: ["fantasy", "lineup", id, userId, refreshKey],
    queryFn: () => getLineup(id, userId),
  });

  if (league.isFetched && !league.data) notFound();

  const lg = league.data;
  const gameName = (games.data ?? []).find((g) => g.id === lg?.gameId)?.shortName;
  const isMember = lg?.members.includes(userId) ?? false;

  async function onJoin() {
    const res = await joinLeague(id, userId);
    if (res.ok) {
      toast.success("Joined the league!");
      setRefreshKey((k) => k + 1);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 text-neutral-400 hover:text-neutral-100">
        <Link href="/fantasy">
          <ArrowLeft className="h-4 w-4" /> Back to leagues
        </Link>
      </Button>

      {league.isPending || !lg ? (
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-xl bg-neutral-900" />
          <Skeleton className="h-44 w-full rounded-xl bg-neutral-900" />
        </div>
      ) : (
        <>
          <header className="mb-6 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60">
            <div className="relative aspect-[3/1] w-full overflow-hidden">
              <img src={eventBanner(lg.bannerSeed)} alt={lg.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
            </div>
            <div className="space-y-2 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-500">
                <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-300">
                  {lg.status}
                </span>
                {gameName && <span className="text-sky-400">{gameName}</span>}
                <span className="text-neutral-400">{scoringLabel(lg.scoringSystem)}</span>
              </div>
              <h1 className="text-xl font-bold text-neutral-50 sm:text-2xl">{lg.name}</h1>
              {lg.description && <p className="text-sm text-neutral-400">{lg.description}</p>}
              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-neutral-300">
                <Stat icon={<Users className="h-3.5 w-3.5" />} label="Members" value={`${lg.members.length} / ${lg.maxMembers}`} />
                <Stat
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Ends"
                  value={new Date(lg.endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                />
                <Stat
                  icon={<Trophy className="h-3.5 w-3.5 text-amber-300" />}
                  label="Prize pool"
                  value={formatCoins(lg.prizePool)}
                />
                <Stat icon={<Sparkles className="h-3.5 w-3.5" />} label="Entry fee" value={formatCoins(lg.entryFee)} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 bg-neutral-900/60 px-4 py-3 text-xs text-neutral-400">
              {isMember ? (
                <span className="flex items-center gap-1 text-emerald-300">
                  <ShieldCheck className="h-4 w-4" /> You&apos;re in this league.
                </span>
              ) : (
                <span>Join the league to submit a lineup.</span>
              )}
              <div className="flex gap-2">
                {!isMember && (
                  <Button onClick={onJoin} size="sm" className="bg-sky-600 text-white hover:bg-sky-500">
                    <UserPlus className="h-4 w-4" /> Join league ({lg.entryFee} coins)
                  </Button>
                )}
                {isMember && (
                  <Button asChild size="sm" className="bg-sky-600 text-white hover:bg-sky-500">
                    <Link href={`/fantasy/leagues/${id}/lineup`}>
                      <Plus className="h-4 w-4" />
                      {myLineup.data ? "Edit lineup" : "Build lineup"}
                    </Link>
                  </Button>
                )}
                <Button asChild variant="outline" size="sm" className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800">
                  <Link href={`/fantasy/leagues/${id}/leaderboard`}>
                    <Crown className="h-4 w-4" /> Leaderboard
                  </Link>
                </Button>
              </div>
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="lg:col-span-2 space-y-3">
              <h2 className="text-lg font-semibold text-neutral-100">Standings</h2>
              <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
                {standings.isPending ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="border-b border-neutral-800/60 px-4 py-3">
                      <Skeleton className="h-9 w-full bg-neutral-900" />
                    </div>
                  ))
                ) : (
                  (standings.data ?? []).slice(0, 10).map((entry) => {
                    const isMe = entry.userId === userId;
                    return (
                      <div
                        key={`${entry.userId}_${entry.rank}`}
                        className={`grid grid-cols-[40px_1fr_120px] items-center border-b border-neutral-800/60 px-4 py-2.5 last:border-b-0 ${
                          isMe ? "bg-sky-500/10" : "hover:bg-neutral-900/40"
                        }`}
                      >
                        <span className="text-sm font-medium text-neutral-400 tabular-nums">#{entry.rank}</span>
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={entry.avatarUrl} alt={entry.handle} />
                            <AvatarFallback>{entry.handle.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className={`truncate text-sm ${isMe ? "text-sky-300 font-semibold" : "text-neutral-200"}`}>
                            @{entry.handle}{isMe && <span className="ml-1 text-[10px] uppercase text-sky-400">you</span>}
                          </span>
                        </div>
                        <span className="text-right text-sm font-semibold tabular-nums text-amber-300">
                          {entry.totalPoints.toLocaleString()} pts
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="text-right">
                <Button asChild variant="ghost" size="sm" className="text-sky-400 hover:text-sky-300">
                  <Link href={`/fantasy/leagues/${id}/leaderboard`}>See full leaderboard →</Link>
                </Button>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-neutral-100">Recent activity</h2>
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40">
                {activity.isPending ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="border-b border-neutral-800/60 p-3">
                      <Skeleton className="h-4 w-3/4 bg-neutral-900" />
                    </div>
                  ))
                ) : (activity.data ?? []).length === 0 ? (
                  <div className="p-4 text-center text-xs text-neutral-500">No activity yet.</div>
                ) : (
                  (activity.data ?? []).map((a) => (
                    <div key={a.id} className="flex items-start gap-3 border-b border-neutral-800/60 p-3 last:border-b-0">
                      <ActivityIcon kind={a.kind} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-neutral-200">{a.message}</p>
                        <p className="text-[10px] text-neutral-500">
                          {new Date(a.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {icon}
      <span className="text-neutral-500">{label}:</span>
      <span className="font-semibold text-neutral-200">{value}</span>
    </div>
  );
}

function ActivityIcon({ kind }: { kind: "join" | "lineup" | "score" }) {
  if (kind === "join")
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
        <UserPlus className="h-3.5 w-3.5" />
      </span>
    );
  if (kind === "lineup")
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-300">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
    );
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">
      <Trophy className="h-3.5 w-3.5" />
    </span>
  );
}
