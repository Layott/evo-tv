"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Crown, Medal, Trophy } from "lucide-react";
import { listLeagueLeaderboardForEvent } from "@/lib/mock/pickem";
import { getEventById } from "@/lib/mock/events";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function PickemLeaderboardPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useMockAuth();
  const userId = user?.id ?? "user_current";

  const board = useQuery({
    queryKey: ["pickem", "leaderboard", eventId],
    queryFn: () => listLeagueLeaderboardForEvent(eventId),
  });
  const event = useQuery({
    queryKey: ["pickem", "event", eventId],
    queryFn: () => getEventById(eventId),
  });

  const list = board.data ?? [];
  // Find ties by score so we can highlight them
  const groupCounts = new Map<number, number>();
  for (const e of list) {
    groupCounts.set(e.score, (groupCounts.get(e.score) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 text-neutral-400 hover:text-neutral-100">
        <Link href={`/pickem/${eventId}`}>
          <ArrowLeft className="h-4 w-4" /> Back to bracket
        </Link>
      </Button>

      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-neutral-50">
          <Crown className="h-6 w-6 text-amber-300" /> Bracket Leaderboard
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          {event.data?.title ?? "Event"} · 10 points per correct pick
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
        <div className="grid grid-cols-[40px_1fr_80px_80px] items-center border-b border-neutral-800 bg-neutral-900/60 px-4 py-2 text-[10px] uppercase tracking-wider text-neutral-500 sm:grid-cols-[60px_1fr_120px_120px]">
          <span>Rank</span>
          <span>Player</span>
          <span className="text-right">Correct</span>
          <span className="text-right">Score</span>
        </div>
        {board.isPending
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="border-b border-neutral-800/60 px-4 py-3">
                <Skeleton className="h-9 w-full bg-neutral-900" />
              </div>
            ))
          : list.length === 0
            ? <div className="px-4 py-10 text-center text-sm text-neutral-500">No entries yet.</div>
            : list.map((entry) => {
                const isMe = entry.userId === userId;
                const isTied = (groupCounts.get(entry.score) ?? 0) > 1;
                return (
                  <div
                    key={`${entry.userId}_${entry.rank}`}
                    className={`grid grid-cols-[40px_1fr_80px_80px] items-center border-b border-neutral-800/60 px-4 py-2.5 last:border-b-0 sm:grid-cols-[60px_1fr_120px_120px] ${
                      isMe ? "bg-sky-500/10" : "hover:bg-neutral-900/40"
                    }`}
                  >
                    <RankBadge rank={entry.rank} />
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={entry.avatarUrl} alt={entry.handle} />
                        <AvatarFallback>{entry.handle.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`truncate text-sm font-medium ${isMe ? "text-sky-300" : "text-neutral-100"}`}>
                            @{entry.handle}
                          </p>
                          {isMe && <span className="text-[10px] uppercase text-sky-400">you</span>}
                          {isTied && (
                            <span className="rounded-full border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-[9px] uppercase text-neutral-400">
                              Tied
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-500">
                          {entry.correctPicks} of {entry.totalPicks} correct
                        </p>
                      </div>
                    </div>
                    <span className="text-right text-sm tabular-nums text-neutral-300">
                      {entry.correctPicks}
                    </span>
                    <span className={`text-right text-sm font-semibold tabular-nums ${entry.rank <= 3 ? "text-amber-300" : "text-neutral-100"}`}>
                      {entry.score}
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
