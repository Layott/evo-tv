"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Coins, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { listPayouts, type CreatorPayout, type PayoutStatus } from "@/lib/mock/creators";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DashboardShell } from "@/components/creators/dashboard-shell";
import { MetricCard } from "@/components/creators/metric-card";
import { toast } from "sonner";

const STATUS_BADGE: Record<PayoutStatus, { className: string; label: string }> = {
  paid: { className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", label: "Paid" },
  processing: { className: "border-sky-500/40 bg-sky-500/10 text-sky-300", label: "Processing" },
  scheduled: { className: "border-amber-500/40 bg-amber-500/10 text-amber-300", label: "Scheduled" },
  held: { className: "border-rose-500/40 bg-rose-500/10 text-rose-300", label: "Held" },
};

export default function CreatorEarningsPage() {
  const { user } = useMockAuth();
  const [payouts, setPayouts] = React.useState<CreatorPayout[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const list = await listPayouts(user.id);
      if (!cancelled) {
        setPayouts(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const totalNet = payouts.reduce((s, p) => s + p.netCoins, 0);
  const totalGross = payouts.reduce((s, p) => s + p.grossCoins, 0);
  const totalFee = payouts.reduce((s, p) => s + p.platformFeeCoins, 0);
  const lastPaid = payouts.find((p) => p.status === "paid");
  const pending = payouts.filter((p) => p.status !== "paid").reduce((s, p) => s + p.netCoins, 0);

  const chartData = payouts.map((p) => ({
    month: p.monthLabel.split(" ")[0],
    net: p.netCoins,
    fee: p.platformFeeCoins,
  }));

  return (
    <DashboardShell
      title="Earnings"
      description="Monthly payouts, fees, and totals — all in EVO Coins."
      actions={
        <Button variant="outline" className="border-neutral-700" onClick={() => toast.message("CSV export will be available after launch.")}>
          <Download className="size-4" />
          Export CSV
        </Button>
      }
    >
      {loading || !user ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl bg-neutral-900" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-2xl bg-neutral-900" />
          <Skeleton className="h-96 rounded-2xl bg-neutral-900" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Lifetime net"
              value={totalNet.toLocaleString()}
              hint="EVO Coins delivered"
              icon={Coins}
              accent="emerald"
            />
            <MetricCard
              label="Lifetime gross"
              value={totalGross.toLocaleString()}
              hint="before platform fee"
              icon={Coins}
              accent="amber"
            />
            <MetricCard
              label="Pending"
              value={pending.toLocaleString()}
              hint="processing or scheduled"
              icon={FileSpreadsheet}
              accent="sky"
            />
            <MetricCard
              label="Last payout"
              value={lastPaid ? lastPaid.monthLabel : "—"}
              hint={lastPaid ? `${lastPaid.netCoins.toLocaleString()} coins` : "No payouts yet"}
              icon={Coins}
              accent="fuchsia"
            />
          </div>

          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-100">Net vs platform fee · 12 months</h3>
                <p className="text-[11px] text-neutral-500">
                  Total platform fee paid: {totalFee.toLocaleString()} coins
                </p>
              </div>
            </div>
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                  <XAxis dataKey="month" stroke="#737373" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#737373" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{
                      background: "#0a0a0a",
                      border: "1px solid #262626",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number, name: string) => [v.toLocaleString(), name === "net" ? "Net" : "Platform fee"]}
                  />
                  <Bar dataKey="net" stackId="a" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="fee" stackId="a" fill="#404040" radius={[0, 0, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40">
            <div className="border-b border-neutral-800 px-4 py-3">
              <h3 className="text-sm font-semibold text-neutral-100">Payout history</h3>
            </div>
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-3 font-medium">Month</th>
                  <th className="px-4 py-3 font-medium text-right">Gross</th>
                  <th className="px-4 py-3 font-medium text-right">Platform fee</th>
                  <th className="px-4 py-3 font-medium text-right">Net</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {payouts
                  .slice()
                  .reverse()
                  .map((p) => (
                    <tr key={p.id} className="border-b border-neutral-800/60 last:border-0 hover:bg-neutral-900/60">
                      <td className="px-4 py-3 font-medium text-neutral-100">{p.monthLabel}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-300">{p.grossCoins.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-500">-{p.platformFeeCoins.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-300">
                        {p.netCoins.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs uppercase tracking-wider text-neutral-400">
                        {p.payoutMethod.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="outline" className={STATUS_BADGE[p.status].className}>
                          {STATUS_BADGE[p.status].label}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="divide-y divide-neutral-800 md:hidden">
              {payouts
                .slice()
                .reverse()
                .map((p) => (
                  <div key={p.id} className="flex flex-col gap-2 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-neutral-100">{p.monthLabel}</span>
                      <Badge variant="outline" className={STATUS_BADGE[p.status].className}>
                        {STATUS_BADGE[p.status].label}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Gross</span>
                      <span className="tabular-nums text-neutral-300">{p.grossCoins.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Fee</span>
                      <span className="tabular-nums text-neutral-500">-{p.platformFeeCoins.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-300">Net</span>
                      <span className="tabular-nums font-bold text-emerald-300">{p.netCoins.toLocaleString()}</span>
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                      via {p.payoutMethod.replace(/_/g, " ")}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
