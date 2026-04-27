"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Copy, History as HistoryIcon, Loader2, Package } from "lucide-react";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { listMyRedemptions, type Redemption } from "@/lib/mock/rewards";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { relativeTime } from "@/components/profile/ngn";

const STATUS_BADGE: Record<Redemption["status"], { className: string; label: string }> = {
  pending: { className: "border-amber-500/40 bg-amber-500/10 text-amber-200", label: "Pending" },
  delivered: { className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", label: "Delivered" },
  expired: { className: "border-neutral-700 bg-neutral-900 text-neutral-400", label: "Expired" },
};

const KIND_LABEL: Record<Redemption["dropKind"], string> = {
  cosmetic: "In-game",
  "premium-trial": "Premium",
  "merch-voucher": "Voucher",
};

export default function RewardsHistoryPage() {
  const { user } = useMockAuth();
  const [items, setItems] = React.useState<Redemption[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await listMyRedemptions(user.id);
      if (!cancelled) {
        setItems(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const totalSpent = items.reduce((acc, r) => acc + r.cost, 0);

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code).catch(() => {});
    toast.success("Code copied");
  }

  function renderRows(list: Redemption[]) {
    if (list.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-10 text-center">
          <Package className="mx-auto size-10 text-neutral-600" />
          <p className="mt-3 text-sm font-semibold text-neutral-200">No redemptions yet.</p>
          <p className="mt-1 text-xs text-neutral-500">Spend EVO Coins in the drops store to see them here.</p>
          <Button asChild className="mt-4 bg-amber-500 text-amber-950 hover:bg-amber-400">
            <Link href="/rewards/store">Open store</Link>
          </Button>
        </div>
      );
    }
    return (
      <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40">
        {/* Desktop table */}
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Cost</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-b border-neutral-800/50 last:border-0 hover:bg-neutral-900/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="size-12 shrink-0 overflow-hidden rounded-md bg-neutral-800">
                      <Image src={r.imageUrl} alt={r.dropName} width={48} height={48} className="size-12 object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="line-clamp-1 text-sm font-medium text-neutral-100">{r.dropName}</div>
                      <div className="text-[11px] text-neutral-500">
                        {KIND_LABEL[r.dropKind]} · {r.partner}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-neutral-950 px-2 py-1 font-mono text-xs text-amber-200">{r.code}</code>
                    <button
                      onClick={() => copyCode(r.code)}
                      className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                      aria-label="Copy code"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums text-amber-300">{r.cost.toLocaleString()}</td>
                <td className="px-4 py-3 text-neutral-400">{relativeTime(r.redeemedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Badge variant="outline" className={STATUS_BADGE[r.status].className}>
                    {STATUS_BADGE[r.status].label}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Mobile cards */}
        <div className="divide-y divide-neutral-800 md:hidden">
          {list.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <div className="size-14 shrink-0 overflow-hidden rounded-md bg-neutral-800">
                  <Image src={r.imageUrl} alt={r.dropName} width={56} height={56} className="size-14 object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-semibold text-neutral-100">{r.dropName}</p>
                      <p className="text-[11px] text-neutral-500">
                        {KIND_LABEL[r.dropKind]} · {r.partner}
                      </p>
                    </div>
                    <Badge variant="outline" className={STATUS_BADGE[r.status].className}>
                      {STATUS_BADGE[r.status].label}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-neutral-500">
                    <span>{relativeTime(r.redeemedAt)}</span>
                    <span className="tabular-nums text-amber-300">{r.cost.toLocaleString()} coins</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5">
                <code className="flex-1 truncate font-mono text-xs text-amber-200">{r.code}</code>
                <button
                  onClick={() => copyCode(r.code)}
                  className="rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                  aria-label="Copy code"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  const pending = items.filter((i) => i.status === "pending");
  const delivered = items.filter((i) => i.status === "delivered");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="size-8 border-neutral-800">
            <Link href="/rewards">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-neutral-50">
              <HistoryIcon className="mr-2 inline size-5 text-sky-400" />
              Redemption history
            </h1>
            <p className="text-sm text-neutral-400">All your past drops, codes and statuses.</p>
          </div>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-right">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">Total spent</div>
          <div className="text-base font-bold text-amber-300 tabular-nums">{totalSpent.toLocaleString()} coins</div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl bg-neutral-900" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="bg-neutral-900/60">
            <TabsTrigger value="all">All ({items.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="delivered">Delivered ({delivered.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4">{renderRows(items)}</TabsContent>
          <TabsContent value="pending" className="mt-4">{renderRows(pending)}</TabsContent>
          <TabsContent value="delivered" className="mt-4">{renderRows(delivered)}</TabsContent>
        </Tabs>
      )}
    </div>
  );
}
