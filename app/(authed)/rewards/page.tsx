"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Calendar, Gift, History, Loader2, Sparkles } from "lucide-react";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import {
  getXpAndTier,
  listDailyQuests,
  listDrops,
  redeemDrop,
  type DailyQuest,
  type Drop,
  type XpTierInfo,
} from "@/lib/mock/rewards";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { RewardsHero } from "@/components/rewards/rewards-hero";
import { DailyQuests } from "@/components/rewards/daily-quests";
import { DropCard } from "@/components/rewards/drop-card";

export default function RewardsLandingPage() {
  const { user } = useMockAuth();
  const [info, setInfo] = React.useState<XpTierInfo | null>(null);
  const [quests, setQuests] = React.useState<DailyQuest[]>([]);
  const [drops, setDrops] = React.useState<Drop[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pendingDrop, setPendingDrop] = React.useState<Drop | null>(null);
  const [redeeming, setRedeeming] = React.useState(false);
  const [successCode, setSuccessCode] = React.useState<{ code: string; drop: Drop } | null>(null);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [tierInfo, q, d] = await Promise.all([
        getXpAndTier(user.id),
        listDailyQuests(user.id),
        listDrops(),
      ]);
      if (cancelled) return;
      setInfo(tierInfo);
      setQuests(q);
      setDrops(d);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleQuestsChange = (next: DailyQuest[]) => setQuests(next);
  const handleCoinsChange = (delta: number) => {
    setInfo((prev) => (prev ? { ...prev, coinsBalance: prev.coinsBalance + delta } : prev));
  };
  const handleXpChange = (delta: number) => {
    setInfo((prev) => (prev ? { ...prev, totalXp: prev.totalXp + delta } : prev));
  };

  async function performRedeem() {
    if (!user || !pendingDrop) return;
    setRedeeming(true);
    const result = await redeemDrop(pendingDrop.id, user.id);
    if (!result.success || !result.redemption) {
      toast.error(result.reason ?? "Redemption failed");
      setRedeeming(false);
      return;
    }
    const redeemed = pendingDrop;
    setDrops((prev) => prev.map((d) => (d.id === redeemed.id ? { ...d, stock: Math.max(0, d.stock - 1) } : d)));
    setInfo((prev) => (prev ? { ...prev, coinsBalance: prev.coinsBalance - redeemed.cost } : prev));
    setSuccessCode({ code: result.redemption.code, drop: redeemed });
    setPendingDrop(null);
    setRedeeming(false);
    toast.success("Redeemed!", { description: redeemed.name });
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  const todayDrops = drops.slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-neutral-50">Rewards</h1>
          <p className="text-sm text-neutral-400">Watch, complete quests, level up — redeem for game drops + perks.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="border-neutral-800">
            <Link href="/rewards/store">
              <Gift className="size-4" /> Drops store
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-neutral-800">
            <Link href="/rewards/history">
              <History className="size-4" /> History
            </Link>
          </Button>
        </div>
      </div>

      {loading || !info ? (
        <div className="space-y-6">
          <Skeleton className="h-44 w-full rounded-2xl bg-neutral-900" />
          <Skeleton className="h-32 w-full rounded-2xl bg-neutral-900" />
          <Skeleton className="h-64 w-full rounded-2xl bg-neutral-900" />
        </div>
      ) : (
        <div className="space-y-8">
          <RewardsHero info={info} />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-neutral-100">
                <Calendar className="mr-2 inline size-4 text-sky-400" />
                Today&apos;s drops
              </h2>
              <Button asChild variant="ghost" size="sm" className="text-neutral-400 hover:text-neutral-100">
                <Link href="/rewards/store">
                  See all drops
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {todayDrops.map((drop) => (
                <DropCard
                  key={drop.id}
                  drop={drop}
                  balance={info.coinsBalance}
                  onRedeem={(d) => setPendingDrop(d)}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-neutral-100">
                <Sparkles className="mr-2 inline size-4 text-amber-400" />
                Daily quests
              </h2>
              <Badge variant="outline" className="border-neutral-700 text-neutral-400">
                Resets in 24h
              </Badge>
            </div>
            <DailyQuests
              quests={quests}
              userId={user.id}
              onQuestsChange={handleQuestsChange}
              onCoinsChange={handleCoinsChange}
              onXpChange={handleXpChange}
            />
          </section>
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog open={!!pendingDrop} onOpenChange={(o) => !o && setPendingDrop(null)}>
        <DialogContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Redeem {pendingDrop?.name}?</DialogTitle>
            <DialogDescription className="text-neutral-400">
              {pendingDrop?.cost.toLocaleString()} EVO Coins will be deducted from your balance. Redemptions cannot be reversed.
            </DialogDescription>
          </DialogHeader>
          {pendingDrop ? (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
              <div className="text-xs text-neutral-500">Balance after redemption</div>
              <div className="mt-1 text-lg font-bold text-amber-300 tabular-nums">
                {(((info?.coinsBalance ?? 0) - pendingDrop.cost) >= 0
                  ? ((info?.coinsBalance ?? 0) - pendingDrop.cost)
                  : 0
                ).toLocaleString()}{" "}
                <span className="text-xs font-normal text-neutral-500">EVO Coins</span>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="border-neutral-700" onClick={() => setPendingDrop(null)}>
              Cancel
            </Button>
            <Button onClick={performRedeem} disabled={redeeming} className="bg-amber-500 text-amber-950 hover:bg-amber-400">
              {redeeming ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              Confirm redeem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Code reveal */}
      <Dialog open={!!successCode} onOpenChange={(o) => !o && setSuccessCode(null)}>
        <DialogContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Redemption successful</DialogTitle>
            <DialogDescription className="text-neutral-400">
              {successCode?.drop.name} — copy the code below. You can also find it any time in your history.
            </DialogDescription>
          </DialogHeader>
          {successCode ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-center">
                <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300">Redemption code</div>
                <div className="mt-2 font-mono text-lg font-bold text-amber-100">{successCode.code}</div>
              </div>
              <div className="text-xs text-neutral-500">
                Apply this code in your {successCode.drop.partner} account or check the history page for redemption status.
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button asChild variant="outline" className="border-neutral-700">
              <Link href="/rewards/history">View history</Link>
            </Button>
            <Button
              onClick={() => {
                if (successCode) {
                  navigator.clipboard?.writeText(successCode.code).catch(() => {});
                  toast.success("Code copied");
                }
                setSuccessCode(null);
              }}
              className="bg-sky-600 hover:bg-sky-500"
            >
              Copy code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
