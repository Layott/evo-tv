"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { ApiAccessShell } from "@/components/api-access/api-access-shell";
import { ApiPaywallCard } from "@/components/api-access/paywall-card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatNumber, formatCompact } from "@/components/admin/utils";
import { getApiUsage, type ApiUsageBreakdown, type ApiUsageDay } from "@/lib/mock/api-keys";

export default function ApiUsagePage() {
  const { role, user } = useMockAuth();
  const isPremium = role === "premium" || role === "admin";
  const userId = user?.id ?? "user_premium";

  const [days, setDays] = React.useState<7 | 30 | 90>(30);
  const [usage, setUsage] = React.useState<{
    daily: ApiUsageDay[];
    breakdown: ApiUsageBreakdown[];
    quota: number;
    used: number;
  } | null>(null);

  React.useEffect(() => {
    if (!isPremium) return;
    setUsage(null);
    let cancelled = false;
    getApiUsage(userId, days).then((u) => {
      if (!cancelled) setUsage(u);
    });
    return () => {
      cancelled = true;
    };
  }, [days, isPremium, userId]);

  if (!isPremium) {
    return (
      <ApiAccessShell>
        <ApiPaywallCard />
      </ApiAccessShell>
    );
  }

  const pct = usage ? Math.min(100, Math.round((usage.used / usage.quota) * 100)) : 0;

  return (
    <ApiAccessShell>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500">Quota usage</div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-2xl font-semibold tabular-nums text-neutral-50">
              {usage ? formatNumber(usage.used) : "…"}
            </div>
            <div className="text-xs text-neutral-500">
              / {usage ? formatNumber(usage.quota) : "—"} req
            </div>
          </div>
          <div className="mt-3">
            <Progress
              value={pct}
              className="h-1.5 bg-neutral-800"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
              <span>{pct}% used</span>
              <span>{usage ? formatNumber(usage.quota - usage.used) : "—"} remaining</span>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500">Avg daily</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-50">
            {usage
              ? formatNumber(Math.round(usage.daily.reduce((acc, d) => acc + d.requests, 0) / Math.max(1, usage.daily.length)))
              : "…"}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Across the last {days} days.
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500">Status</div>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge tone="emerald" dot>
              Healthy
            </StatusBadge>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            All endpoints under 150ms p95.
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-neutral-50">Requests per day</h3>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v) as 7 | 30 | 90)}>
            <SelectTrigger className="w-32 border-neutral-800 bg-neutral-900 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="h-64">
          {usage ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={usage.daily} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#262626" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#525252"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  stroke="#525252"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompact(v as number)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#171717",
                    border: "1px solid #262626",
                    borderRadius: 8,
                    color: "#e5e5e5",
                  }}
                  formatter={(v) => [formatNumber(v as number), "Requests"]}
                />
                <Line
                  type="monotone"
                  dataKey="requests"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full animate-pulse rounded bg-neutral-900" />
          )}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/40">
        <div className="border-b border-neutral-800 p-4">
          <h3 className="text-sm font-semibold text-neutral-50">Per-endpoint breakdown</h3>
          <p className="text-xs text-neutral-500">Sorted by request volume</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-neutral-800">
                <TableHead className="text-xs uppercase tracking-wider text-neutral-400">Endpoint</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-neutral-400">Method</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-neutral-400">Requests</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-neutral-400">Error rate</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-neutral-400">Avg latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usage ? (
                [...usage.breakdown]
                  .sort((a, b) => b.requests - a.requests)
                  .map((row) => (
                    <TableRow key={row.endpoint} className="border-neutral-800">
                      <TableCell>
                        <code className="font-mono text-xs text-neutral-100">{row.endpoint}</code>
                      </TableCell>
                      <TableCell>
                        <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
                          {row.method}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-neutral-200">
                        {formatNumber(row.requests)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-neutral-300">
                        {(row.errorRate * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-neutral-300">
                        {row.avgLatencyMs}ms
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-neutral-800">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-800" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </ApiAccessShell>
  );
}
