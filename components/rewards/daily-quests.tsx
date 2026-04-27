"use client";

import * as React from "react";
import { Coins, CheckCircle2, Loader2, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { DailyQuest } from "@/lib/mock/rewards";
import { claimQuest } from "@/lib/mock/rewards";

interface DailyQuestsProps {
  quests: DailyQuest[];
  userId: string;
  onQuestsChange: (quests: DailyQuest[]) => void;
  onCoinsChange: (coins: number) => void;
  onXpChange: (xp: number) => void;
}

export function DailyQuests({ quests, userId, onQuestsChange, onCoinsChange, onXpChange }: DailyQuestsProps) {
  const [pending, setPending] = React.useState<string | null>(null);

  async function handleClaim(quest: DailyQuest) {
    if (pending) return;
    setPending(quest.id);
    const result = await claimQuest(quest.id, userId);
    if (!result.success) {
      toast.error(result.reason ?? "Could not claim quest");
      setPending(null);
      return;
    }
    const next = quests.map((q) => (q.id === quest.id ? { ...q, claimed: true } : q));
    onQuestsChange(next);
    onCoinsChange(result.rewardCoins);
    onXpChange(result.rewardXp);
    toast.success(`+${result.rewardCoins} coins · +${result.rewardXp} XP`, {
      description: quest.label,
    });
    setPending(null);
  }

  const sorted = React.useMemo(() => {
    return [...quests].sort((a, b) => {
      const aReady = a.progress >= a.target && !a.claimed ? 0 : 1;
      const bReady = b.progress >= b.target && !b.claimed ? 0 : 1;
      if (aReady !== bReady) return aReady - bReady;
      const aProg = a.target ? a.progress / a.target : 0;
      const bProg = b.target ? b.progress / b.target : 0;
      return bProg - aProg;
    });
  }, [quests]);

  return (
    <ul className="space-y-3">
      {sorted.map((q) => {
        const ready = q.progress >= q.target && !q.claimed;
        const claimed = q.claimed;
        const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.target)) * 100));
        return (
          <li
            key={q.id}
            className={
              "rounded-xl border p-4 transition " +
              (claimed
                ? "border-emerald-500/20 bg-emerald-500/5"
                : ready
                  ? "border-sky-500/40 bg-sky-500/5 shadow-lg shadow-sky-500/10"
                  : "border-neutral-800 bg-neutral-900/40")
            }
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Target className="size-4 text-sky-400" />
                  <h3 className="text-sm font-semibold text-neutral-100">{q.label}</h3>
                  {claimed ? <Badge className="bg-emerald-500 text-emerald-950">Claimed</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-neutral-400">{q.description}</p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 text-amber-300">
                    <Coins className="size-3.5" />
                    <span className="text-sm font-bold tabular-nums">+{q.rewardCoins}</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500">+{q.rewardXp} XP</div>
                </div>
                <Button
                  size="sm"
                  variant={claimed ? "outline" : ready ? "default" : "outline"}
                  disabled={claimed || !ready || pending === q.id}
                  onClick={() => handleClaim(q)}
                  className={
                    claimed
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10"
                      : ready
                        ? "bg-sky-600 text-white hover:bg-sky-500"
                        : "border-neutral-800"
                  }
                >
                  {pending === q.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : claimed ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : ready ? (
                    <Sparkles className="size-3.5" />
                  ) : null}
                  {claimed ? "Claimed" : ready ? "Claim" : "In progress"}
                </Button>
              </div>
            </div>

            <div className="mt-3 space-y-1">
              <Progress value={pct} className="h-1.5 bg-neutral-800" />
              <div className="flex items-center justify-between text-[11px] text-neutral-500">
                <span>
                  {q.progress.toLocaleString()} / {q.target.toLocaleString()} {q.unit}
                </span>
                <span className="tabular-nums">{pct}%</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
