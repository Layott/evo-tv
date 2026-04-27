"use client";

import * as React from "react";
import Link from "next/link";
import { Coins, Heart, Loader2, Lock } from "lucide-react";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import {
  getCoinBalance,
  listAllReceivedForCurrentCreator,
  listSentTips,
  topTippers,
  type Tip,
  type TopTipper,
} from "@/lib/mock/tips";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TipList } from "@/components/tips/tip-list";
import { TopTippers } from "@/components/tips/top-tippers";

export default function TipsPage() {
  const { user, role } = useMockAuth();
  const [sent, setSent] = React.useState<Tip[]>([]);
  const [received, setReceived] = React.useState<Tip[]>([]);
  const [tippers, setTippers] = React.useState<TopTipper[]>([]);
  const [balance, setBalance] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const canViewReceived = role === "admin" || role === "premium";

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [s, top, bal] = await Promise.all([
        listSentTips(user.id),
        topTippers(10),
        getCoinBalance(user.id),
      ]);
      if (cancelled) return;
      setSent(s);
      setTippers(top);
      setBalance(bal);
      if (canViewReceived) {
        const r = await listAllReceivedForCurrentCreator();
        if (!cancelled) setReceived(r);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, canViewReceived]);

  const totalSent = sent.reduce((sum, t) => sum + t.amountCoins, 0);
  const totalReceived = received.reduce((sum, t) => sum + t.amountCoins, 0);

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-50">
            <Heart className="mr-2 inline size-5 fill-pink-400 text-pink-400" />
            Tips & cheers
          </h1>
          <p className="text-sm text-neutral-400">Your tipping activity and the leaderboard.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500">Balance</div>
            <div className="flex items-center gap-1 text-amber-300">
              <Coins className="size-4" />
              <span className="text-base font-bold tabular-nums">{balance.toLocaleString()}</span>
            </div>
          </div>
          <Button asChild className="bg-amber-500 text-amber-950 hover:bg-amber-400">
            <Link href="/rewards">Earn coins</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Tabs defaultValue="sent">
            <TabsList className="bg-neutral-900/60">
              <TabsTrigger value="sent">Sent ({sent.length})</TabsTrigger>
              <TabsTrigger value="received" disabled={!canViewReceived}>
                Received {canViewReceived ? `(${received.length})` : ""}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sent" className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-sm">
                <span className="text-neutral-400">Total sent</span>
                <span className="font-bold text-amber-300 tabular-nums">{totalSent.toLocaleString()} EVO Coins</span>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-xl bg-neutral-900" />
                  ))}
                </div>
              ) : (
                <TipList tips={sent} perspective="sent" />
              )}
            </TabsContent>

            <TabsContent value="received" className="mt-4 space-y-3">
              {!canViewReceived ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
                  <Lock className="mx-auto size-8 text-amber-400" />
                  <p className="mt-2 text-sm font-semibold text-neutral-100">Creator-only view</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    Apply to the creator program (or upgrade to premium) to see tips fans send you.
                  </p>
                  <Button asChild className="mt-4 bg-amber-500 text-amber-950 hover:bg-amber-400">
                    <Link href="/creator-program">Apply now</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-sm">
                    <span className="text-neutral-400">Total received</span>
                    <span className="font-bold text-amber-300 tabular-nums">{totalReceived.toLocaleString()} EVO Coins</span>
                  </div>
                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 rounded-xl bg-neutral-900" />
                      ))}
                    </div>
                  ) : (
                    <TipList tips={received} perspective="received" />
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          {loading ? (
            <Skeleton className="h-96 rounded-2xl bg-neutral-900" />
          ) : (
            <TopTippers tippers={tippers} highlightHandle={user.handle} />
          )}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
            <h4 className="text-sm font-semibold text-neutral-100">How tipping works</h4>
            <ul className="mt-3 space-y-2 text-xs text-neutral-400">
              <li>· Tips use EVO Coins — the same balance you earn from quests &amp; watch-time.</li>
              <li>· Streamers get 70% of every tip (creator program members).</li>
              <li>· Messages appear live in chat with a coin badge.</li>
              <li>· No real money — coins are virtual currency only.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
