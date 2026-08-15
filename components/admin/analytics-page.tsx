"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock, PercentCircle, TrendingDown, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "./page-header";
import { MetricCard } from "./metric-card";
import { useQuery } from "@tanstack/react-query";
import {
  adminConversion,
  adminRetention,
  adminRevenueByMonth,
  adminTopVods,
  adminViewsOverTime,
} from "@/lib/client";
import { formatCompact, formatNgn, formatNumber } from "./utils";

const DATE_RANGES = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
];

export function AnalyticsPage() {
  const [range, setRange] = React.useState("30d");

  /**
   * Every chart on this page was generated, not measured: views were a rising
   * baseline plus noise, retention was a decaying formula, revenue was
   * 3.2M NGN climbing by 480k a month, and the ten "top titles" were invented
   * VOD names with random view counts. None of it came from the database, and
   * an operator would have read all of it as real.
   */
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;

  const viewsQ = useQuery({
    queryKey: ["admin", "views", days],
    queryFn: () => adminViewsOverTime(days),
  });
  const retentionQ = useQuery({
    queryKey: ["admin", "retention"],
    queryFn: () => adminRetention(8),
  });
  const revenueQ = useQuery({
    queryKey: ["admin", "revenue"],
    queryFn: () => adminRevenueByMonth(6),
  });
  const topVodsQ = useQuery({
    queryKey: ["admin", "top-vods"],
    queryFn: () => adminTopVods(10),
  });
  const conversionQ = useQuery({
    queryKey: ["admin", "conversion"],
    queryFn: () => adminConversion(),
  });

  const viewsSeries = viewsQ.data ?? [];
  const retention = retentionQ.data?.matrix ?? [];
  const revenueByMonth = (revenueQ.data ?? []).map((r) => ({
    month: r.month,
    revenue: r.ngn,
  }));
  const topTitles = (topVodsQ.data ?? []).map((v) => ({
    title: v.title,
    views: v.viewCount,
  }));
  const totalViews = viewsSeries.reduce((acc, p) => acc + p.views, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Audience, retention and revenue signals for the platform."
        actions={
          <Tabs value={range} onValueChange={setRange}>
            <TabsList className="bg-card">
              {DATE_RANGES.map((r) => (
                <TabsTrigger key={r.value} value={r.value}>
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* These four were hardcoded: 284,120 unique viewers, 32m 14s average
            watch time, 2.4% conversion and 3.1% churn, each with an invented
            month-over-month delta, on a platform with no recorded views at all.
            Views and conversion are measured; watch time and churn are not
            computed anywhere yet, so they say so. */}
        <MetricCard
          title="Views in range"
          value={formatNumber(totalViews)}
          icon={Users}
        />
        <MetricCard
          title="Avg watch time"
          value="-"
          hint="Not measured yet"
          icon={Clock}
        />
        <MetricCard
          title="Free to Premium"
          value={`${(conversionQ.data?.pct ?? 0).toFixed(1)}%`}
          hint={`${conversionQ.data?.convertedUsers ?? 0} of ${conversionQ.data?.totalUsers ?? 0}`}
          icon={PercentCircle}
        />
        <MetricCard
          title="Premium churn"
          value="-"
          hint="Not measured yet"
          icon={TrendingDown}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card/40 p-5">
          <h3 className="text-sm font-semibold text-foreground">Views over time</h3>
          <p className="text-xs text-muted-foreground">{DATE_RANGES.find((r) => r.value === range)?.label}</p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={viewsSeries}>
                <defs>
                  <linearGradient id="analyticsArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#262626" vertical={false} />
                <XAxis dataKey="day" stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
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
                />
                <Area type="monotone" dataKey="views" stroke="#10b981" strokeWidth={2} fill="url(#analyticsArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/40 p-5">
          <h3 className="text-sm font-semibold text-foreground">Revenue by month</h3>
          <p className="text-xs text-muted-foreground">Last 6 months, premium subs</p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByMonth}>
                <CartesianGrid stroke="#262626" vertical={false} />
                <XAxis dataKey="month" stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#525252"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompact(v as number)}
                />
                <Tooltip
                  cursor={{ fill: "#171717" }}
                  contentStyle={{
                    backgroundColor: "#171717",
                    border: "1px solid #262626",
                    borderRadius: 8,
                    color: "#e5e5e5",
                  }}
                  formatter={(v) => [formatNgn(v as number), "Revenue"]}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card/40 p-5">
          <h3 className="text-sm font-semibold text-foreground">Retention cohort</h3>
          <p className="text-xs text-muted-foreground">Week retention over 8 cohorts</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-center text-xs">
              <thead>
                <tr>
                  <th className="p-1 text-left text-muted-foreground">Cohort</th>
                  {Array.from({ length: 8 }, (_, i) => (
                    <th key={i} className="p-1 font-normal text-muted-foreground">
                      W{i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retention.map((row, r) => (
                  <tr key={r}>
                    <td className="p-1 text-left text-xs text-muted-foreground">W{r + 1}</td>
                    {row.map((v, c) => (
                      <td
                        key={c}
                        className="rounded p-1 font-mono tabular-nums"
                        style={
                          v == null
                            ? { backgroundColor: "transparent", color: "#3f3f46" }
                            : {
                                backgroundColor: `rgba(16,185,129,${(v / 100) * 0.7 + 0.05})`,
                                color: v > 55 ? "#052e1a" : "#a7f3d0",
                              }
                        }
                      >
                        {v == null ? "-" : `${v}%`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/40 p-5">
          <h3 className="text-sm font-semibold text-foreground">Top 10 VODs</h3>
          <p className="text-xs text-muted-foreground">By views in current range</p>
          <ul className="mt-4 space-y-2">
            {topTitles.map((t) => {
              const max = topTitles[0]?.views ?? 1;
              const pct = Math.round((t.views / max) * 100);
              return (
                <li key={t.title}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate text-foreground">{t.title}</span>
                    <span className="tabular-nums text-muted-foreground">{formatNumber(t.views)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
