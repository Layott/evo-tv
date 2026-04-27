"use client";

import { Coins, Crown, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TopTipper } from "@/lib/mock/tips";

interface TopTippersProps {
  tippers: TopTipper[];
  highlightHandle?: string;
}

const RANK_BG = [
  "from-amber-400 to-amber-600 text-amber-950",
  "from-neutral-200 to-neutral-400 text-neutral-900",
  "from-amber-700 to-amber-900 text-amber-100",
];

export function TopTippers({ tippers, highlightHandle }: TopTippersProps) {
  if (tippers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-8 text-center">
        <Trophy className="mx-auto size-8 text-neutral-600" />
        <p className="mt-2 text-sm font-semibold text-neutral-300">No tippers in the last 30 days yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Crown className="size-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-neutral-100">Top tippers · last 30 days</h3>
        </div>
        <span className="text-[11px] uppercase tracking-wider text-neutral-500">Top {tippers.length}</span>
      </div>
      <ul className="divide-y divide-neutral-800/60">
        {tippers.map((t, i) => {
          const isCurrent = highlightHandle && t.handle === highlightHandle;
          return (
            <li
              key={t.handle}
              className={
                "flex items-center gap-3 px-4 py-3 " + (isCurrent ? "bg-amber-500/5" : "")
              }
            >
              <div
                className={
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums " +
                  (i < 3
                    ? `bg-gradient-to-br ${RANK_BG[i]}`
                    : "bg-neutral-800 text-neutral-300")
                }
              >
                {i + 1}
              </div>
              <Avatar className="size-9 ring-1 ring-neutral-700">
                <AvatarImage src={t.avatarUrl} alt={t.handle} />
                <AvatarFallback>{t.handle.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-100">@{t.handle}</p>
                <p className="text-[11px] text-neutral-500">{t.tipCount} tips</p>
              </div>
              <div className="flex items-center gap-1 text-amber-300">
                <Coins className="size-3.5" />
                <span className="text-sm font-bold tabular-nums">{t.totalCoins.toLocaleString()}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
