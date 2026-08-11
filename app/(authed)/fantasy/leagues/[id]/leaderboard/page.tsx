"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpDown, Crown, Medal, Trophy } from "lucide-react";
import { getLeagueById, listLeagueLeaderboard } from "@/lib/mock/fantasy";
import { useAuth } from "@/components/providers";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type SortKey = "rank" | "points" | "handle";

export default function FantasyLeaderboardPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? "user_current";
  const [sort, setSort] = React.useState<SortKey>("rank");
  const [dir, setDir] = React.useState<"asc" | "desc">("asc");

  const league = useQuery({
    queryKey: ["fantasy", "league", id],
    queryFn: () => getLeagueById(id),
  });
  const board = useQuery({
    queryKey: ["fantasy", "leaderboard", id],
    queryFn: () => listLeagueLeaderboard(id),
  });

  const list = React.useMemo(() => {
    const data = (board.data ?? []).slice();
    const mul = dir === "asc" ? 1 : -1;
    if (sort === "rank") data.sort((a, b) => mul * (a.rank - b.rank));
    if (sort === "points") data.sort((a, b) => mul * (b.totalPoints - a.totalPoints));
    if (sort === "handle") data.sort((a, b) => mul * a.handle.localeCompare(b.handle));
    return data;
  }, [board.data, sort, dir]);

  function toggleSort(key: SortKey) {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir(key === "rank" ? "asc" : "desc");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 text-neutral-400 hover:text-neutral-100">
        <Link href={`/fantasy/leagues/${id}`}>
          <ArrowLeft className="h-4 w-4" /> Back to league
        </Link>
      </Button>

      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-neutral-50">
          <Crown className="h-6 w-6 text-amber-300" /> Leaderboard
        </h1>
        <p className="mt-1 text-sm text-neutral-400">{league.data?.name ?? "Fantasy league"}</p>
      </header>

      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
        <div className="grid grid-cols-[60px_1fr_140px] items-center border-b border-neutral-800 bg-neutral-900/60 px-4 py-2 text-[10px] uppercase tracking-wider text-neutral-500">
          <button type="button" onClick={() => toggleSort("rank")} className="flex items-center gap-1 text-left hover:text-neutral-300">
            Rank <ArrowUpDown className="h-3 w-3" />
          </button>
          <button type="button" onClick={() => toggleSort("handle")} className="flex items-center gap-1 text-left hover:text-neutral-300">
            Player <ArrowUpDown className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => toggleSort("points")}
            className="flex items-center justify-end gap-1 text-right hover:text-neutral-300"
          >
            Points <ArrowUpDown className="h-3 w-3" />
          </button>
        </div>

        {board.isPending
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="border-b border-neutral-800/60 px-4 py-3">
                <Skeleton className="h-9 w-full bg-neutral-900" />
              </div>
            ))
          : list.length === 0
            ? <div className="px-4 py-10 text-center text-sm text-neutral-500">No standings yet.</div>
            : list.map((entry) => {
                const isMe = entry.userId === userId;
                return (
                  <div
                    key={`${entry.userId}_${entry.rank}`}
                    className={`grid grid-cols-[60px_1fr_140px] items-center border-b border-neutral-800/60 px-4 py-2.5 last:border-b-0 ${
                      isMe ? "bg-sky-500/10" : "hover:bg-neutral-900/40"
                    }`}
                  >
                    <RankBadge rank={entry.rank} />
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={entry.avatarUrl} alt={entry.handle} />
                        <AvatarFallback>{entry.handle.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <p className={`truncate text-sm ${isMe ? "text-sky-300 font-semibold" : "text-neutral-200"}`}>
                        @{entry.handle}{isMe && <span className="ml-1 text-[10px] uppercase text-sky-400">you</span>}
                      </p>
                    </div>
                    <span className={`text-right text-sm font-bold tabular-nums ${entry.rank <= 3 ? "text-amber-300" : "text-neutral-100"}`}>
                      {entry.totalPoints.toLocaleString()} pts
                    </span>
                  </div>
                );
              })}
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-xs font-bold text-amber-300">
        <Crown className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-500/40 bg-neutral-500/10 text-xs font-bold text-neutral-200">
        <Medal className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-orange-700/40 bg-orange-700/10 text-xs font-bold text-orange-300">
        <Trophy className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900/60 text-xs font-medium text-neutral-400">
      {rank}
    </span>
  );
}
