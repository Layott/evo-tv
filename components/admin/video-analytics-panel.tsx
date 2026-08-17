"use client";

import * as React from "react";
import Image from "next/image";
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
import { Clock, Eye, Gauge, Heart, PlayCircle, Users } from "@/components/icons";

import { useQuery } from "@tanstack/react-query";
import { adminVideoAnalytics, adminVideoSummaries } from "@/lib/client";
import type { AdminVideoSummary } from "@/lib/client";
import { cn } from "@/lib/utils";
import { MetricCard } from "./metric-card";
import { formatCompact, formatNumber } from "./utils";

/**
 * Per-video analytics, in the shape a creator expects from YouTube Studio.
 *
 * Pick a title on the left, read its numbers on the right. The centrepiece is
 * the audience retention curve, which is the one chart that answers "why is
 * this video not working": a cliff in the first ten percent is a bad opening, a
 * slow bleed is a pacing problem, a bump is a moment worth cutting into a clip.
 *
 * Everything is measured from `video_view_buckets`, written by the player. A
 * title nobody has watched shows zeroes and says so.
 */

/** Chart colours, from the wordmark. Flat fills, no gradients, no glow. */
const MINT = "#46E3CE";
const AXIS = "#6f8f8f";

/** Filled surface, not a bordered box, matching the rest of the product. */
const TOOLTIP_STYLE = {
  backgroundColor: "#0d2b2e",
  border: "none",
  borderRadius: 10,
  color: "#eaf6f5",
  fontSize: 12,
} as const;

function formatDuration(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return "0s";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Watch time reads in hours once there is enough of it to matter. */
function formatWatchTime(totalSec: number): string {
  if (totalSec >= 3600) {
    return `${(totalSec / 3600).toFixed(1)}h`;
  }
  return formatDuration(totalSec);
}

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 28, label: "28 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
];

const REGION = new Intl.DisplayNames(["en"], { type: "region" });
function countryName(code: string): string {
  try {
    return REGION.of(code) ?? code;
  } catch {
    return code;
  }
}

const DEVICE_LABEL: Record<string, string> = {
  mobile: "Phone",
  tablet: "Tablet",
  desktop: "Computer",
  tv: "TV",
};

export function VideoAnalyticsPanel() {
  const [days, setDays] = React.useState(28);
  const [selected, setSelected] = React.useState<{
    type: "vod" | "episode";
    id: string;
  } | null>(null);

  const listQ = useQuery({
    queryKey: ["admin", "video-summaries", days],
    queryFn: () => adminVideoSummaries(days),
  });

  const videos = listQ.data ?? [];

  // Open on the best-performing title rather than an empty right-hand side.
  React.useEffect(() => {
    if (!selected && videos.length > 0) {
      setSelected({ type: videos[0].type, id: videos[0].id });
    }
  }, [videos, selected]);

  const detailQ = useQuery({
    queryKey: ["admin", "video-analytics", selected?.type, selected?.id, days],
    queryFn: () =>
      selected ? adminVideoAnalytics(selected.type, selected.id, days) : null,
    enabled: Boolean(selected),
  });

  const d = detailQ.data ?? null;

  const retentionData = React.useMemo(() => {
    if (!d) return [];
    return d.retention.map((pct, i) => ({
      percent: i,
      pct,
      atSec: Math.round((i / 100) * d.video.durationSec),
    }));
  }, [d]);

  const totalViews = videos.reduce((a, v) => a + v.views, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Video performance
          </h2>
          <p className="text-xs text-muted-foreground">
            {videos.length} title{videos.length === 1 ? "" : "s"} in the
            catalogue · {formatNumber(totalViews)} view
            {totalViews === 1 ? "" : "s"} in range
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-card p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setDays(r.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                days === r.value
                  ? "bg-sky-500/25 text-sky-100"
                  : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <VideoList
          videos={videos}
          loading={listQ.isLoading}
          selected={selected}
          onSelect={setSelected}
        />

        <div className="min-w-0 space-y-6">
          {detailQ.isLoading ? (
            <div className="rounded-xl bg-card/50 p-10 text-center text-sm text-muted-foreground">
              Loading
            </div>
          ) : !d ? (
            <div className="rounded-xl bg-card/50 p-10 text-center text-sm text-muted-foreground">
              {videos.length === 0
                ? "No videos in the catalogue yet."
                : "Pick a title to see how it performed."}
            </div>
          ) : (
            <>
              <VideoHeader video={d.video} />

              <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard title="Views" value={formatNumber(d.views)} icon={Eye} />
                <MetricCard
                  title="Watch time"
                  value={formatWatchTime(d.watchTimeSec)}
                  icon={Clock}
                />
                <MetricCard
                  title="Avg view duration"
                  value={formatDuration(d.avgViewDurationSec)}
                  hint={
                    d.video.durationSec > 0
                      ? `of ${formatDuration(d.video.durationSec)}`
                      : undefined
                  }
                  icon={PlayCircle}
                />
                <MetricCard
                  title="Avg percentage viewed"
                  value={`${d.avgPercentViewed}%`}
                  icon={Gauge}
                />
                <MetricCard
                  title="Watched to the end"
                  value={`${d.completionRate}%`}
                  hint="Reached 95% or more"
                  icon={Gauge}
                />
                <MetricCard
                  title="Signed-in viewers"
                  value={formatNumber(d.uniqueViewers)}
                  hint={`${formatNumber(d.signedOutViews)} signed out`}
                  icon={Users}
                />
                <MetricCard title="Likes" value={formatNumber(d.likes)} icon={Heart} />
              </section>

              <RetentionChart
                data={retentionData}
                views={d.views}
                durationSec={d.video.durationSec}
              />

              <section className="grid gap-6 lg:grid-cols-2">
                <ViewsChart data={d.viewsByDay} views={d.views} />
                <div className="space-y-6">
                  <BreakdownList
                    title="Where they watched from"
                    empty="No country recorded yet. Cloudflare supplies this on the live site."
                    rows={d.topCountries.map((c) => ({
                      label: countryName(c.country),
                      value: c.views,
                    }))}
                  />
                  <BreakdownList
                    title="What they watched on"
                    empty="No device recorded yet."
                    rows={d.devices.map((x) => ({
                      label: DEVICE_LABEL[x.device] ?? x.device,
                      value: x.views,
                    }))}
                  />
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function VideoList({
  videos,
  loading,
  selected,
  onSelect,
}: {
  videos: AdminVideoSummary[];
  loading: boolean;
  selected: { type: string; id: string } | null;
  onSelect: (v: { type: "vod" | "episode"; id: string }) => void;
}) {
  const [q, setQ] = React.useState("");
  const filtered = q.trim()
    ? videos.filter((v) => v.title.toLowerCase().includes(q.toLowerCase()))
    : videos;

  return (
    <div className="rounded-xl bg-card/50 p-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find a title"
        className="mb-3 w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted/40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="px-2 py-8 text-center text-sm text-muted-foreground">
          {videos.length === 0
            ? "Nothing published yet."
            : "No title matches that."}
        </p>
      ) : (
        <ul className="max-h-[34rem] space-y-1 overflow-y-auto">
          {filtered.map((v) => {
            const active = selected?.type === v.type && selected?.id === v.id;
            return (
              <li key={`${v.type}:${v.id}`}>
                <button
                  type="button"
                  onClick={() => onSelect({ type: v.type, id: v.id })}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors",
                    active ? "bg-sky-500/25" : "hover:bg-muted/50",
                  )}
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
                    <div
                      className={cn(
                        "truncate text-xs font-medium",
                        active ? "text-sky-50" : "text-foreground",
                      )}
                    >
                      {v.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatNumber(v.views)} view{v.views === 1 ? "" : "s"}
                      {v.views > 0 ? ` · ${v.avgPercentViewed}% viewed` : ""}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function VideoHeader({
  video,
}: {
  video: {
    title: string;
    thumbnailUrl: string;
    durationSec: number;
    publishedAt: string | null;
    type: string;
  };
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-card/50 p-4">
      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-background">
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            alt=""
            fill
            sizes="112px"
            className="object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-foreground">
          {video.title}
        </h3>
        <p className="text-xs text-muted-foreground">
          {video.type === "vod" ? "Recording" : "Episode"}
          {video.durationSec > 0 ? ` · ${formatDuration(video.durationSec)}` : ""}
          {video.publishedAt
            ? ` · published ${new Date(video.publishedAt).toLocaleDateString()}`
            : ""}
        </p>
      </div>
    </div>
  );
}

function RetentionChart({
  data,
  views,
  durationSec,
}: {
  data: { percent: number; pct: number; atSec: number }[];
  views: number;
  durationSec: number;
}) {
  return (
    <section className="rounded-xl bg-card/50 p-5">
      <h3 className="text-sm font-semibold text-foreground">Audience retention</h3>
      <p className="text-xs text-muted-foreground">
        How many of the people who started are still watching at each point
      </p>

      {views === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nobody has watched this yet, so there is no curve to draw.
        </p>
      ) : (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#123b3d" vertical={false} />
              <XAxis
                dataKey="percent"
                stroke={AXIS}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) =>
                  durationSec > 0
                    ? formatDuration(Math.round(((v as number) / 100) * durationSec))
                    : `${v}%`
                }
              />
              <YAxis
                stroke={AXIS}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(v) =>
                  durationSec > 0
                    ? `At ${formatDuration(Math.round(((v as number) / 100) * durationSec))}`
                    : `${v}% in`
                }
                formatter={(v) => [`${v}% still watching`, ""]}
              />
              {/* Flat translucent fill. A gradient wash here is the generated
                  dashboard look the product is moving away from. */}
              <Area
                type="monotone"
                dataKey="pct"
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
  );
}

function ViewsChart({
  data,
  views,
}: {
  data: { date: string; views: number }[];
  views: number;
}) {
  return (
    <section className="rounded-xl bg-card/50 p-5">
      <h3 className="text-sm font-semibold text-foreground">Views per day</h3>
      <p className="text-xs text-muted-foreground">Counted once per playback</p>
      {views === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No views recorded in this range.
        </p>
      ) : (
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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
                cursor={{ fill: "rgba(70,227,206,0.10)" }}
                contentStyle={TOOLTIP_STYLE}
                formatter={(v) => [formatNumber(v as number), "Views"]}
              />
              <Bar dataKey="views" fill={MINT} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function BreakdownList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { label: string; value: number }[];
  empty: string;
}) {
  const max = rows[0]?.value ?? 1;
  return (
    <section className="rounded-xl bg-card/50 p-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="truncate text-foreground">{r.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(r.value)}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{ width: `${Math.round((r.value / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
