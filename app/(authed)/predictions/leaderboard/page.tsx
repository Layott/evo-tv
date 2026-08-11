"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Crown, Medal, Trophy } from "lucide-react";
import { listLeaderboard } from "@/lib/mock/predictions";
import { useAuth } from "@/components/providers";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CoinPill } from "@/components/predictions/coin-pill";

export default function PredictionsLeaderboardPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "user_current";
  const board = useQuery({
    queryKey: ["predictions", "leaderboard"],
    queryFn: () => listLeaderboard(50),
  });

  const list = board.data ?? [];
  const me = list.find((e) => e.userId === userId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 text-neutral-400 hover:text-neutral-100">
        <Link href="/predictions">
          <ArrowLeft className="h-4 w-4" /> Back to predictions
        </Link>
      </Button>

      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-neutral-50">
          <Crown className="h-6 w-6 text-amber-300" /> Predictions Leaderboard
        </h1>
        <p className="mt-1 text-sm text-neutral-400">Top predictors by total EVO Coin balance.</p>
      </header>

      {me ? (
        <div className="mb-4 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
          <p className="text-[10px] uppercase tracking-wider text-sky-300">Your standing</p>
          <div className="mt-2 flex items-center gap-3">
            <RankBadge rank={me.rank} />
            <Avatar className="h-9 w-9 border border-sky-500/40">
              <AvatarImage src={me.avatarUrl} alt={me.handle} />
              <AvatarFallback>{me.handle.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-100">@{me.handle}</p>
              <p className="text-xs text-neutral-400">{me.totalWins} wins</p>
            </div>
            <CoinPill coins={me.totalCoins} tone="amber" />
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
        <div className="grid grid-cols-[40px_1fr_80px_120px] items-center border-b border-neutral-800 bg-neutral-900/60 px-4 py-2 text-[10px] uppercase tracking-wider text-neutral-500 sm:grid-cols-[60px_1fr_100px_140px]">
          <span>Rank</span>
          <span>User</span>
          <span className="text-right">Wins</span>
          <span className="text-right">Coins</span>
        </div>
        {board.isPending ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="border-b border-neutral-800/60 px-4 py-3">
              <Skeleton className="h-9 w-full bg-neutral-900" />
            </div>
          ))
        ) : list.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-neutral-500">No leaderboard yet.</div>
        ) : (
          list.map((entry) => {
            const isMe = entry.userId === userId;
            return (
              <div
                key={entry.userId}
                className={`grid grid-cols-[40px_1fr_80px_120px] items-center border-b border-neutral-800/60 px-4 py-2.5 text-sm last:border-b-0 sm:grid-cols-[60px_1fr_100px_140px] ${
                  isMe ? "bg-sky-500/5" : "hover:bg-neutral-900/40"
                }`}
              >
                <RankBadge rank={entry.rank} />
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={entry.avatarUrl} alt={entry.handle} />
                    <AvatarFallback>{entry.handle.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-medium ${isMe ? "text-sky-300" : "text-neutral-100"}`}>
                      @{entry.handle}
                      {isMe && <span className="ml-1 text-[10px] uppercase text-sky-400">you</span>}
                    </p>
                  </div>
                </div>
                <span className="text-right tabular-nums text-neutral-300">{entry.totalWins}</span>
                <div className="flex justify-end">
                  <CoinPill coins={entry.totalCoins} tone={entry.rank <= 3 ? "amber" : "muted"} />
                </div>
              </div>
            );
          })
        )}
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
