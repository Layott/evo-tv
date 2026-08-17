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
import {
  adminListStreams,
  adminListUsers,
  adminOverviewMetrics,
  adminViewsOverTime,
} from "@/lib/client";
import { MetricCard } from "./metric-card";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";
import { formatCompact, formatNgn, formatNumber, timeAgo } from "./utils";
import { UserAvatar } from "@/components/ui/user-avatar";

export function OverviewPage() {
  /**
   * Every number on this page used to be invented: the 30-day chart was random
   * noise on a rising baseline, signups were `40 + random * 40`, and the
   * subscriber count and MRR were a seeded constant. An operator reading this
   * dashboard would have been reading fiction. It all comes out of Postgres now.
   */
  const metricsQ = useQuery({
    queryKey: ["admin", "overview-metrics"],
    queryFn: () => adminOverviewMetrics(),
  });
  const seriesQ = useQuery({
    queryKey: ["admin", "views-30d"],
    queryFn: () => adminViewsOverTime(30),
  });
  const streamsQ = useQuery({
    queryKey: ["admin", "streams-all"],
    queryFn: () => adminListStreams({ limit: 50 }),
  });
  const usersQ = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => adminListUsers({ limit: 50 }),
  });

  const series = seriesQ.data ?? [];
  const liveStreams = (streamsQ.data?.streams ?? []).filter((s) => s.isLive);
  const liveCount = metricsQ.data?.liveStreams ?? liveStreams.length;
  const totalViewers = liveStreams.reduce((acc, s) => acc + s.viewerCount, 0);

  const signupsToday = metricsQ.data?.todaySignups ?? 0;
  const premiumSubs = metricsQ.data?.activePremiumSubs ?? 0;
  const mrr = metricsQ.data?.mrrNgn ?? 0;

  const recentSignups = React.useMemo(
    () =>
      [...(usersQ.data?.users ?? [])]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [usersQ.data],
  );

  /**
   * The alert list was three hardcoded strings, one of them naming
   * `stream_lagos_final`, a stream that no longer exists. There is no alerting
   * backend, so showing nothing is the honest state.
   */
  const alerts: Array<{ id: string; tone: "amber" | "red" | "emerald"; title: string; body: string }> = [];

  const topStreams = liveStreams.slice(0, 5);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Operational snapshot across streams, subscriptions and revenue."
      />

      {/* No `delta`: the four trend badges were hardcoded (+12.4% vs last hour,
          +6.3% vs yesterday, +3.1% rolling 7d, +4.8% vs last month) and rendered
          next to whatever the real figure happened to be, so a dashboard showing
          0 live streams and 0 revenue still claimed both were climbing. Nothing
          computes a period-over-period comparison yet, so the card omits it. */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Live streams" value={liveCount} icon={Radio} />
        <MetricCard title="Signups today" value={signupsToday} icon={UserPlus} />
        <MetricCard
          title="Active premium subs"
          value={formatNumber(premiumSubs)}
          icon={Users}
        />
        <MetricCard title="MRR" value={formatNgn(mrr)} icon={CircleDollarSign} />
      </section>

      <section className="rounded-xl border border-border bg-card/40 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Views (last 30 days)</h3>
            <p className="text-xs text-muted-foreground">
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
        <div className="rounded-xl border border-border bg-card/40 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="text-sm font-semibold text-foreground">Top streams right now</h3>
            <Link href="/admin/streams" className="text-xs text-sky-400 hover:text-sky-300">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {topStreams.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3 hover:bg-accent">
                <div className="h-10 w-16 overflow-hidden rounded bg-muted">
                  {}
                  <img src={s.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.streamerName}</div>
                </div>
                <StatusBadge tone="red" dot>
                  LIVE
                </StatusBadge>
                <div className="w-20 text-right text-sm tabular-nums text-foreground/80">
                  {formatCompact(s.viewerCount)}
                </div>
              </li>
            ))}
            {streamsQ.isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <li key={`sk-${i}`} className="flex items-center gap-3 p-3">
                    <div className="h-10 w-16 rounded bg-muted" />
                    <div className="flex-1">
                      <div className="h-3 w-3/4 rounded bg-muted" />
                      <div className="mt-1.5 h-2.5 w-1/3 rounded bg-muted" />
                    </div>
                  </li>
                ))
              : null}
          </ul>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card/40">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">Recent signups</h3>
              <Link href="/admin/users" className="text-xs text-sky-400 hover:text-sky-300">
                Users
              </Link>
            </div>
            <ul className="divide-y divide-border">
              {recentSignups.map((u) => (
                <li key={u.id} className="flex items-center gap-3 p-3">
                  <UserAvatar
                    src={u.avatarUrl}
                    name={u.displayName}
                    handle={u.handle}
                    seed={u.id}
                    decorative
                    className="h-8 w-8 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-foreground">@{u.handle}</div>
                    <div className="text-xs text-muted-foreground">{timeAgo(u.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card/40">
            <div className="flex items-center gap-2 border-b border-border p-4">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-foreground">Alerts</h3>
            </div>
            <ul className="divide-y divide-border">
              {alerts.map((a) => (
                <li key={a.id} className="p-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={a.tone} dot>
                      {a.tone === "red" ? "Action" : a.tone === "amber" ? "Warn" : "Info"}
                    </StatusBadge>
                    <span className="text-sm font-medium text-foreground">{a.title}</span>
                  </div>
                  <p className="mt-1 pl-[3.75rem] text-xs text-muted-foreground">{a.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/40 p-4">
        <div className="flex items-center gap-2 text-sm text-foreground/80">
          <Sparkles className="h-4 w-4 text-sky-400" />
          Quick actions:
          <Link href="/admin/streams" className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">
            New stream
          </Link>
          <Link href="/admin/polls" className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">
            New poll
          </Link>
          <Link href="/admin/ads" className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">
            New ad
          </Link>
          <Link href="/admin/content" className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">
            New event
          </Link>
        </div>
      </section>
    </div>
  );
}
