"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
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
  CircleDollarSign,
  Clock,
  Eye,
  Radio,
  UserPlus,
  Users,
} from "lucide-react";

import {
  adminListStreams,
  adminListUsers,
  adminOverviewPage,
  adminVideoSummaries,
} from "@/lib/client";
import { MetricCard } from "./metric-card";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";
import { formatCompact, formatNgn, formatNumber, timeAgo } from "./utils";
import { UserAvatar } from "@/components/ui/user-avatar";

/**
 * The morning screen: what is happening now, what moved, what needs doing.
 *
 * Two things were wrong with it beyond the numbers. The headline chart plotted
 * `day` while the endpoint returns `date`, so the x-axis was blank on every
 * load. And the "Alerts" panel was an empty array behind a heading, so it drew
 * a titled box containing nothing, for ever. Alerts are computed now and the
 * panel only appears when something is actually wrong.
 *
 * Everything here is measured. Nothing carries a period-over-period badge it
 * cannot compute: views compare today with yesterday because that comparison is
 * real, and the rest carry a plain figure rather than an invented trend.
 */

const MINT = "#46E3CE";
const AXIS = "#6f8f8f";

const TOOLTIP_STYLE = {
  backgroundColor: "#0d2b2e",
  border: "none",
  borderRadius: 10,
  color: "#eaf6f5",
  fontSize: 12,
} as const;

function formatWatch(totalSec: number): string {
  if (totalSec >= 3600) return `${(totalSec / 3600).toFixed(1)}h`;
  if (totalSec >= 60) return `${Math.round(totalSec / 60)}m`;
  return `${Math.round(totalSec)}s`;
}

export function OverviewPage() {
  const overviewQ = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => adminOverviewPage(),
  });
  const streamsQ = useQuery({
    queryKey: ["admin", "streams-all"],
    queryFn: () => adminListStreams({ limit: 50 }),
  });
  const usersQ = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => adminListUsers({ limit: 50 }),
  });
  const topVideosQ = useQuery({
    queryKey: ["admin", "video-summaries", 7],
    queryFn: () => adminVideoSummaries(7),
  });

  const o = overviewQ.data ?? null;
  const liveStreams = (streamsQ.data?.streams ?? []).filter((s) => s.isLive);

  const recentSignups = React.useMemo(
    () =>
      [...(usersQ.data?.users ?? [])]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 5),
    [usersQ.data],
  );

  const topVideos = (topVideosQ.data ?? []).filter((v) => v.views > 0).slice(0, 5);

  // Only a real comparison, and only once yesterday had something to compare to.
  const viewsDelta =
    o && o.viewsYesterday > 0
      ? ((o.viewsToday - o.viewsYesterday) / o.viewsYesterday) * 100
      : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="What is happening now, what moved, and what needs doing."
      />

      {o && o.attention.length > 0 ? (
        <section className="space-y-2">
          {o.attention.map((a) => (
            <Link
              key={a.id}
              href={a.href}
              className="flex items-center gap-3 rounded-xl bg-card/50 p-4 transition-colors hover:bg-card"
            >
              <StatusBadge tone={a.tone}>
                {a.tone === "red" ? "Action" : "Check"}
              </StatusBadge>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{a.title}</div>
                <p className="text-xs text-muted-foreground">{a.body}</p>
              </div>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          title="Live now"
          value={o?.liveStreams ?? 0}
          hint={
            (o?.liveStreams ?? 0) > 0
              ? `${formatNumber(o?.liveViewers ?? 0)} watching`
              : "Nothing on air"
          }
          icon={Radio}
        />
        <MetricCard
          title="Views today"
          value={formatNumber(o?.viewsToday ?? 0)}
          delta={viewsDelta}
          deltaLabel="vs yesterday"
          hint={`${formatNumber(o?.viewsYesterday ?? 0)} yesterday`}
          icon={Eye}
        />
        <MetricCard
          title="Watch time 7d"
          value={formatWatch(o?.watchTimeSec7d ?? 0)}
          icon={Clock}
        />
        <MetricCard
          title="Signups today"
          value={formatNumber(o?.signupsToday ?? 0)}
          hint={`${formatNumber(o?.signups7d ?? 0)} this week`}
          icon={UserPlus}
        />
        <MetricCard
          title="Premium subs"
          value={formatNumber(o?.activePremiumSubs ?? 0)}
          hint={`${formatNgn(o?.mrrNgn ?? 0)} a month`}
          icon={Users}
        />
        <MetricCard
          title="Shop this month"
          value={formatNgn(o?.revenueThisMonthNgn ?? 0)}
          icon={CircleDollarSign}
        />
      </section>

      <section className="rounded-xl bg-card/50 p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground">
            Views, last 30 days
          </h3>
          <p className="text-xs text-muted-foreground">
            One per playback, across recordings and episodes
          </p>
        </div>
        {o && o.viewsByDay.every((p) => p.views === 0) ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No views recorded yet. The player reports these as people watch.
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={o?.viewsByDay ?? []}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="#123b3d" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke={AXIS}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => String(v).slice(5)}
                  minTickGap={24}
                />
                <YAxis
                  stroke={AXIS}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tickFormatter={(v) => formatCompact(v as number)}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v) => [formatNumber(v as number), "Views"]}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke={MINT}
                  strokeWidth={2}
                  fill={MINT}
                  fillOpacity={0.18}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="overflow-hidden rounded-xl bg-card/50 lg:col-span-2">
          <div className="flex items-center justify-between p-4">
            <h3 className="text-sm font-semibold text-foreground">
              {liveStreams.length > 0 ? "On air now" : "Most watched this week"}
            </h3>
            <Link
              href={liveStreams.length > 0 ? "/admin/streams" : "/admin/analytics"}
              className="text-xs text-sky-400 hover:text-sky-300"
            >
              {liveStreams.length > 0 ? "All streams" : "All analytics"}
            </Link>
          </div>

          {liveStreams.length > 0 ? (
            <ul>
              {liveStreams.slice(0, 5).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded bg-background">
                    {s.thumbnailUrl ? (
                      <Image
                        src={s.thumbnailUrl}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {s.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.streamerName}
                    </div>
                  </div>
                  <StatusBadge tone="red" dot>
                    LIVE
                  </StatusBadge>
                  <div className="w-20 text-right text-sm tabular-nums text-foreground/80">
                    {formatCompact(s.viewerCount)}
                  </div>
                </li>
              ))}
            </ul>
          ) : topVideos.length > 0 ? (
            <ul>
              {topVideos.map((v) => (
                <li
                  key={`${v.type}:${v.id}`}
                  className="flex items-center gap-3 p-3"
                >
                  <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded bg-background">
                    {v.thumbnailUrl ? (
                      <Image
                        src={v.thumbnailUrl}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {v.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {v.avgPercentViewed}% viewed on average
                    </div>
                  </div>
                  <div className="w-20 text-right text-sm tabular-nums text-foreground/80">
                    {formatNumber(v.views)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 pb-6 text-sm text-muted-foreground">
              Nothing is on air and nothing has been watched this week.
            </p>
          )}
        </div>

        <div className="overflow-hidden rounded-xl bg-card/50">
          <div className="flex items-center justify-between p-4">
            <h3 className="text-sm font-semibold text-foreground">
              Newest accounts
            </h3>
            <Link
              href="/admin/users"
              className="text-xs text-sky-400 hover:text-sky-300"
            >
              Users
            </Link>
          </div>
          {recentSignups.length === 0 ? (
            <p className="px-4 pb-6 text-sm text-muted-foreground">
              Nobody has signed up yet.
            </p>
          ) : (
            <ul>
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
                    <div className="truncate text-sm text-foreground">
                      {u.displayName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {timeAgo(u.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
