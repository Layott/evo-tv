"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CircleDollarSign,
  Radio,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { listLiveStreams } from "@/lib/mock/streams";
import { profiles } from "@/lib/mock/users";
import { MetricCard } from "./metric-card";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";
import { formatCompact, formatNgn, formatNumber, seededRandom, timeAgo } from "./utils";

function useSeries() {
  return React.useMemo(() => {
    const rng = seededRandom(42);
    const now = Date.now();
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now - (29 - i) * 86_400_000);
      const base = 120_000 + i * 4_800;
      const noise = rng() * 80_000;
      const views = Math.round(base + noise + (i % 7 === 6 ? 40_000 : 0));
      return {
        day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        views,
      };
    });
  }, []);
}

export function OverviewPage() {
  const series = useSeries();
  const streamsQ = useQuery({ queryKey: ["admin", "live-streams"], queryFn: () => listLiveStreams() });

  const liveCount = streamsQ.data?.length ?? 0;
  const totalViewers = (streamsQ.data ?? []).reduce((acc, s) => acc + s.viewerCount, 0);

  const rng = React.useMemo(() => seededRandom(7), []);
  const signupsToday = React.useMemo(() => Math.round(40 + rng() * 40), [rng]);
  const premiumSubs = React.useMemo(() => 1_820 + Math.round(rng() * 240), [rng]);
  const mrr = premiumSubs * 2_500;

  const recentSignups = React.useMemo(() => {
    return [...profiles]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, []);

  const alerts = [
    {
      id: "a1",
      tone: "amber" as const,
      title: "Stream key rotation reminder",
      body: "3 official streams have not rotated their key in 90+ days.",
    },
    {
      id: "a2",
      tone: "red" as const,
      title: "Chat spike on stream_lagos_final",
      body: "Chat activity is 4× baseline. 12 reports awaiting review.",
    },
    {
      id: "a3",
      tone: "emerald" as const,
      title: "Premium conversions up 8%",
      body: "Week-over-week conversion ticked up to 2.4%.",
    },
  ];

  const topStreams = (streamsQ.data ?? []).slice(0, 5);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Operational snapshot across streams, subscriptions and revenue."
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Live streams"
          value={liveCount}
          delta={12.4}
          deltaLabel="vs last hour"
          icon={Radio}
        />
        <MetricCard
          title="Signups today"
          value={signupsToday}
          delta={6.3}
          deltaLabel="vs yesterday"
          icon={UserPlus}
        />
        <MetricCard
          title="Active premium subs"
          value={formatNumber(premiumSubs)}
          delta={3.1}
          deltaLabel="rolling 7d"
          icon={Users}
        />
        <MetricCard
          title="MRR"
          value={formatNgn(mrr)}
          delta={4.8}
          deltaLabel="vs last month"
          icon={CircleDollarSign}
        />
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-100">Views (last 30 days)</h3>
            <p className="text-xs text-neutral-500">
              {formatNumber(totalViewers)} viewers watching right now across {liveCount} live streams
            </p>
          </div>
          <StatusBadge tone="emerald" dot>
            Live
          </StatusBadge>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="overviewArea" x1="0" y1="0" x2="0" y2="1">
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
                formatter={(v) => [formatNumber(v as number), "Views"]}
              />
              <Area
                type="monotone"
                dataKey="views"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#overviewArea)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-neutral-800 p-4">
            <h3 className="text-sm font-semibold text-neutral-100">Top streams right now</h3>
            <Link href="/admin/streams" className="text-xs text-sky-400 hover:text-sky-300">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-neutral-800">
            {topStreams.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3 hover:bg-neutral-900">
                <div className="h-10 w-16 overflow-hidden rounded bg-neutral-800">
                  {}
                  <img src={s.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-neutral-100">{s.title}</div>
                  <div className="text-xs text-neutral-500">{s.streamerName}</div>
                </div>
                <StatusBadge tone="red" dot>
                  LIVE
                </StatusBadge>
                <div className="w-20 text-right text-sm tabular-nums text-neutral-300">
                  {formatCompact(s.viewerCount)}
                </div>
              </li>
            ))}
            {streamsQ.isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <li key={`sk-${i}`} className="flex items-center gap-3 p-3">
                    <div className="h-10 w-16 animate-pulse rounded bg-neutral-800" />
                    <div className="flex-1">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-800" />
                      <div className="mt-1.5 h-2.5 w-1/3 animate-pulse rounded bg-neutral-800" />
                    </div>
                  </li>
                ))
              : null}
          </ul>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40">
            <div className="flex items-center justify-between border-b border-neutral-800 p-4">
              <h3 className="text-sm font-semibold text-neutral-100">Recent signups</h3>
              <Link href="/admin/users" className="text-xs text-sky-400 hover:text-sky-300">
                Users
              </Link>
            </div>
            <ul className="divide-y divide-neutral-800">
              {recentSignups.map((u) => (
                <li key={u.id} className="flex items-center gap-3 p-3">
                  <div className="h-8 w-8 overflow-hidden rounded-full bg-neutral-800">
                    {}
                    <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-neutral-100">@{u.handle}</div>
                    <div className="text-xs text-neutral-500">{timeAgo(u.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40">
            <div className="flex items-center gap-2 border-b border-neutral-800 p-4">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-neutral-100">Alerts</h3>
            </div>
            <ul className="divide-y divide-neutral-800">
              {alerts.map((a) => (
                <li key={a.id} className="p-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={a.tone} dot>
                      {a.tone === "red" ? "Action" : a.tone === "amber" ? "Warn" : "Info"}
                    </StatusBadge>
                    <span className="text-sm font-medium text-neutral-100">{a.title}</span>
                  </div>
                  <p className="mt-1 pl-[3.75rem] text-xs text-neutral-400">{a.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="flex items-center gap-2 text-sm text-neutral-300">
          <Sparkles className="h-4 w-4 text-sky-400" />
          Quick actions:
          <Link href="/admin/streams" className="rounded-md border border-neutral-800 px-2 py-1 text-xs hover:bg-neutral-900">
            New stream
          </Link>
          <Link href="/admin/polls" className="rounded-md border border-neutral-800 px-2 py-1 text-xs hover:bg-neutral-900">
            New poll
          </Link>
          <Link href="/admin/ads" className="rounded-md border border-neutral-800 px-2 py-1 text-xs hover:bg-neutral-900">
            New ad
          </Link>
          <Link href="/admin/content" className="rounded-md border border-neutral-800 px-2 py-1 text-xs hover:bg-neutral-900">
            New event
          </Link>
        </div>
      </section>
    </div>
  );
}
