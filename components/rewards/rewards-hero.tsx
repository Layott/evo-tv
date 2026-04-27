"use client";

import { Coins, Sparkles, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { XpTierInfo } from "@/lib/mock/rewards";
import { TierBadge } from "./tier-badge";
import { tierColor } from "@/lib/mock/rewards";

interface RewardsHeroProps {
  info: XpTierInfo;
}

export function RewardsHero({ info }: RewardsHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 p-6 sm:p-8">
      <div className={`pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-gradient-to-br ${tierColor(info.tier)} opacity-20 blur-3xl`} />
      <div className={`pointer-events-none absolute -bottom-16 -left-16 size-56 rounded-full bg-gradient-to-tl ${tierColor(info.tier)} opacity-10 blur-3xl`} />

      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <TierBadge tier={info.tier} size="lg" />
            {info.nextTier && (
              <span className="text-xs uppercase tracking-wider text-neutral-500">
                Next: <span className="text-neutral-300">{info.nextTier}</span>
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-neutral-50 tabular-nums">{info.totalXp.toLocaleString()}</span>
            <span className="text-sm text-neutral-500">XP earned</span>
          </div>
          {info.nextTier ? (
            <p className="text-xs text-neutral-400">
              <TrendingUp className="mr-1 inline size-3.5 text-emerald-400" />
              {info.pointsToNextTier.toLocaleString()} XP to {info.nextTier}
            </p>
          ) : (
            <p className="text-xs text-neutral-400">
              <Sparkles className="mr-1 inline size-3.5 text-fuchsia-400" />
              Max tier reached. Keep stacking XP for season-end perks.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-3 text-right">
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300">EVO Coins</div>
          <div className="mt-1 flex items-center justify-end gap-1.5 text-amber-200">
            <Coins className="size-5" />
            <span className="text-2xl font-bold tabular-nums">{info.coinsBalance.toLocaleString()}</span>
          </div>
          <div className="mt-1 text-[11px] text-amber-300/70">redeemable balance</div>
        </div>
      </div>

      <div className="relative mt-6 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-neutral-500">
          <span>Tier progress</span>
          <span className="tabular-nums text-neutral-300">{info.progressPct}%</span>
        </div>
        <Progress value={info.progressPct} className="h-2 bg-neutral-800" />
      </div>
    </div>
  );
}
