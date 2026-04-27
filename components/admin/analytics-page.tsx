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
import { formatCompact, formatNgn, formatNumber, seededRandom } from "./utils";

const DATE_RANGES = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
];

export function AnalyticsPage() {
  const [range, setRange] = React.useState("30d");

  const viewsSeries = React.useMemo(() => {
    const rng = seededRandom(51);
    const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
    const now = Date.now();
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now - (days - 1 - i) * 86_400_000);
      const base = 100_000 + i * (days > 30 ? 1200 : 4000);
      const views = Math.round(base + rng() * 80_000);
      return {
        day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        views,
      };
    });
  }, [range]);

  const retention = React.useMemo(() => {
    const rng = seededRandom(7);
    return Array.from({ length: 8 }, (_, r) =>
      Array.from({ length: 8 }, (_, c) => {
        if (c > 7 - r) return null;
        const base = Math.max(12, 100 - c * 13 - r * 2);
        return Math.min(100, Math.round(base + rng() * 6));
      }),
    );
  }, []);

  const revenueByMonth = React.useMemo(() => {
    const rng = seededRandom(19);
    const labels = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
    return labels.map((m, i) => ({
      month: m,
      revenue: Math.round(3_200_000 + i * 480_000 + rng() * 600_000),
    }));
  }, []);

  const topTitles = React.useMemo(() => {
    const titles = [
      "EVO Finals — Highlights",
      "PUBGM Casablanca Day 1",
      "Evo Talk Ep 12",
      "CoD Mobile Cairo",
      "Free Fire Lagos Semis",
      "EA FC Continental",
      "Retrospective: Alpha",
      "Scrim Night: Titan",
      "Accra Showdown Recap",
      "Bracket Reveal — EVO Cup",
    ];
    const rng = seededRandom(5);
    return titles
      .map((t) => ({ title: t, views: Math.round(12_000 + rng() * 240_000) }))
      .sort((a, b) => b.views - a.views);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Audience, retention and revenue signals for the platform."
        actions={
          <Tabs value={range} onValueChange={setRange}>
            <TabsList className="bg-neutral-900">
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
        <MetricCard title="Unique viewers" value={formatNumber(284_120)} delta={11.2} deltaLabel="MoM" icon={Users} />
        <MetricCard title="Avg watch time" value="32m 14s" delta={4.5} deltaLabel="vs last month" icon={Clock} />
        <MetricCard title="Free → Premium" value="2.4%" delta={0.3} deltaLabel="conversion" icon={PercentCircle} />
        <MetricCard title="Premium churn" value="3.1%" delta={-0.6} deltaLabel="vs last month" icon={TrendingDown} />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
          <h3 className="text-sm font-semibold text-neutral-100">Views over time</h3>
          <p className="text-xs text-neutral-500">{DATE_RANGES.find((r) => r.value === range)?.label}</p>
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

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
          <h3 className="text-sm font-semibold text-neutral-100">Revenue by month</h3>
          <p className="text-xs text-neutral-500">Last 6 months, premium subs</p>
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
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
          <h3 className="text-sm font-semibold text-neutral-100">Retention cohort</h3>
          <p className="text-xs text-neutral-500">Week retention over 8 cohorts</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-center text-xs">
              <thead>
                <tr>
                  <th className="p-1 text-left text-neutral-500">Cohort</th>
                  {Array.from({ length: 8 }, (_, i) => (
                    <th key={i} className="p-1 font-normal text-neutral-500">
                      W{i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retention.map((row, r) => (
                  <tr key={r}>
                    <td className="p-1 text-left text-xs text-neutral-400">W{r + 1}</td>
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
                        {v == null ? "—" : `${v}%`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
          <h3 className="text-sm font-semibold text-neutral-100">Top 10 VODs</h3>
          <p className="text-xs text-neutral-500">By views in current range</p>
          <ul className="mt-4 space-y-2">
            {topTitles.map((t) => {
              const max = topTitles[0]?.views ?? 1;
              const pct = Math.round((t.views / max) * 100);
              return (
                <li key={t.title}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate text-neutral-200">{t.title}</span>
                    <span className="tabular-nums text-neutral-400">{formatNumber(t.views)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
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
