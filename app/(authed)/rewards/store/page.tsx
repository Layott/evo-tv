"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Coins, Filter, Loader2, Search, Sparkles } from "lucide-react";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import {
  getXpAndTier,
  listDrops,
  redeemDrop,
  type Drop,
  type DropKind,
  type XpTierInfo,
} from "@/lib/mock/rewards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DropCard } from "@/components/rewards/drop-card";
import { TierBadge } from "@/components/rewards/tier-badge";

const KIND_TABS: Array<{ value: "all" | DropKind; label: string }> = [
  { value: "all", label: "All drops" },
  { value: "cosmetic", label: "In-game" },
  { value: "premium-trial", label: "Premium" },
  { value: "merch-voucher", label: "Vouchers" },
];

export default function RewardsStorePage() {
  const { user } = useMockAuth();
  const [info, setInfo] = React.useState<XpTierInfo | null>(null);
  const [drops, setDrops] = React.useState<Drop[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [kind, setKind] = React.useState<"all" | DropKind>("all");
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const [sort, setSort] = React.useState<"featured" | "low" | "high" | "new">("featured");
  const [pendingDrop, setPendingDrop] = React.useState<Drop | null>(null);
  const [redeeming, setRedeeming] = React.useState(false);
  const [successCode, setSuccessCode] = React.useState<{ code: string; drop: Drop } | null>(null);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [tierInfo, d] = await Promise.all([getXpAndTier(user.id), listDrops()]);
      if (cancelled) return;
      setInfo(tierInfo);
      setDrops(d);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    drops.forEach((d) => set.add(d.category));
    return Array.from(set).sort();
  }, [drops]);

  const filtered = React.useMemo(() => {
    let list = drops.slice();
    if (kind !== "all") list = list.filter((d) => d.kind === kind);
    if (category !== "all") list = list.filter((d) => d.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) => d.name.toLowerCase().includes(q) || d.partner.toLowerCase().includes(q),
      );
    }
    if (sort === "low") list.sort((a, b) => a.cost - b.cost);
    else if (sort === "high") list.sort((a, b) => b.cost - a.cost);
    else if (sort === "new") list.sort((a, b) => (b.expiresAt ?? "").localeCompare(a.expiresAt ?? ""));
    return list;
  }, [drops, kind, category, search, sort]);

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="size-8 border-neutral-800">
            <Link href="/rewards">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-neutral-50">Drops store</h1>
            <p className="text-sm text-neutral-400">Spend EVO Coins on in-game items, premium trials and merch.</p>
          </div>
        </div>
        {info ? (
          <div className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2">
            <TierBadge tier={info.tier} size="sm" />
            <div className="flex items-center gap-1 text-amber-300">
              <Coins className="size-4" />
              <span className="text-base font-bold tabular-nums">{info.coinsBalance.toLocaleString()}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <Tabs value={kind} onValueChange={(v) => setKind(v as "all" | DropKind)}>
          <TabsList className="bg-neutral-900/60">
            {KIND_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-neutral-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search drops or partners"
              className="border-neutral-800 bg-neutral-900 pl-8 text-sm"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-44 border-neutral-800 bg-neutral-900">
              <Filter className="mr-1 size-3.5 text-neutral-500" />
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="w-40 border-neutral-800 bg-neutral-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="low">Cost: low to high</SelectItem>
              <SelectItem value="high">Cost: high to low</SelectItem>
              <SelectItem value="new">Newest first</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-neutral-500">{filtered.length} drops</div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl bg-neutral-900" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-10 text-center">
            <Sparkles className="mx-auto size-10 text-neutral-600" />
            <p className="mt-3 text-sm font-semibold text-neutral-200">No drops match these filters.</p>
            <p className="mt-1 text-xs text-neutral-500">Try clearing the search or pick a different category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((drop) => (
              <DropCard
                key={drop.id}
                drop={drop}
                balance={info?.coinsBalance ?? 0}
                onRedeem={(d) => setPendingDrop(d)}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!pendingDrop} onOpenChange={(o) => !o && setPendingDrop(null)}>
        <DialogContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Redeem {pendingDrop?.name}?</DialogTitle>
            <DialogDescription className="text-neutral-400">
              {pendingDrop?.cost.toLocaleString()} EVO Coins will be deducted from your balance.
            </DialogDescription>
          </DialogHeader>
          {pendingDrop ? (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Cost</span>
                <span className="tabular-nums text-amber-300">{pendingDrop.cost.toLocaleString()} coins</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-neutral-500">Balance after</span>
                <span className="tabular-nums text-neutral-200">
                  {Math.max(0, (info?.coinsBalance ?? 0) - pendingDrop.cost).toLocaleString()} coins
                </span>
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

      <Dialog open={!!successCode} onOpenChange={(o) => !o && setSuccessCode(null)}>
        <DialogContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Redemption successful</DialogTitle>
            <DialogDescription className="text-neutral-400">{successCode?.drop.name}</DialogDescription>
          </DialogHeader>
          {successCode ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-center">
              <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300">Code</div>
              <div className="mt-2 font-mono text-lg font-bold text-amber-100">{successCode.code}</div>
            </div>
          ) : null}
          <DialogFooter>
            <Button asChild variant="outline" className="border-neutral-700">
              <Link href="/rewards/history">History</Link>
            </Button>
            <Button
              onClick={() => {
                if (successCode) {
                  navigator.clipboard?.writeText(successCode.code).catch(() => {});
                  toast.success("Copied");
                }
                setSuccessCode(null);
              }}
              className="bg-sky-600 hover:bg-sky-500"
            >
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
