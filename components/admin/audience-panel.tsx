"use client";

import * as React from "react";
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

import { Eye, Clock, Users } from "@/components/icons";
import { apiGet } from "@/lib/client";
import { MetricCard } from "./metric-card";
import { formatNumber } from "./utils";

/**
 * Who watched the channel.
 *
 * The Platform tab could answer how the business was doing and nothing about
 * the thing the business does. On a platform whose catalogue is empty and whose
 * channel is live around the clock, that made the whole page read as broken:
 * the owner opened it during a broadcast and every number was a zero.
 *
 * Every figure here is counted from the beats the players already send, one per
 * viewer per minute. Nothing is modelled, and where the data does not say
 * something the panel says so rather than guessing.
 */

interface AudienceDay {
  date: string;
  views: number;
  minutes: number;
}

interface AudienceSlice {
  label: string;
  minutes: number;
}

interface AudienceReport {
  byDay: AudienceDay[];
  peakConcurrent: number;
  peakAt: string | null;
  totalViews: number;
  totalMinutes: number;
  byCountry: AudienceSlice[];
  byDevice: AudienceSlice[];
  byRung: AudienceSlice[];
}

const MINT = "#46E3CE";
const AXIS = "#6f8f8f";

const TOOLTIP_STYLE = {
  backgroundColor: "#0d2b2e",
  border: "none",
  borderRadius: 10,
  color: "#eaf6f5",
  fontSize: 12,
} as const;

/** "3h 27m", "48m", "0m". Hours matter to a broadcaster; seconds do not. */
function formatMinutes(total: number): string {
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function dayLabel(date: string): string {
  return date.slice(5);
}

/**
 * Why a slice can say "Unknown".
 *
 * Country and device were added to the beat in August, so every row written
 * before that carries neither. It is history rather than a hole, and it leaves
 * the window on its own as the days roll past; saying so is cheaper than
 * somebody wondering whether the capture is broken.
 */
const UNRECORDED_NOTE =
  "Unknown is beats written before this was captured. It ages out of the window on its own.";

export function AudiencePanel({ days = 30 }: { days?: number }) {
  const audienceQ = useQuery({
    queryKey: ["admin", "audience", days],
    queryFn: () => apiGet<AudienceReport>("/api/admin/analytics/audience", { days }),
    staleTime: 60_000,
  });

  const report = audienceQ.data ?? null;
  const chart = (report?.byDay ?? []).map((d) => ({
    date: dayLabel(d.date),
    views: d.views,
  }));
  const nothingYet =
    report !== null && report.totalViews === 0 && report.totalMinutes === 0;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          title="People, last 30 days"
          value={formatNumber(report?.totalViews ?? 0)}
          hint="Counted once per person per broadcast per day"
          icon={Eye}
        />
        <MetricCard
          title="Watch time"
          value={formatMinutes(report?.totalMinutes ?? 0)}
          hint="Minutes with a live player open"
          icon={Clock}
        />
        <MetricCard
          title="Most at once"
          value={formatNumber(report?.peakConcurrent ?? 0)}
          hint={
            report?.peakAt
              ? `Busiest minute: ${report.peakAt.replace("T", " ")} UTC`
              : "No minute has had two viewers yet"
          }
          icon={Users}
        />
      </section>

      <section className="rounded-xl bg-card/50 p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground">
            People watching, by day
          </h3>
          <p className="text-xs text-muted-foreground">
            One per person per broadcast. Somebody who tunes in four times in an
            evening is one.
          </p>
        </div>
        {audienceQ.isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Reading…</p>
        ) : nothingYet ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Nobody has watched a broadcast in this window. The player reports
            these as people watch.
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="audienceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={MINT} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={MINT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#12383a" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke={AXIS}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  stroke={AXIS}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke={MINT}
                  strokeWidth={2}
                  fill="url(#audienceFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Breakdown
          title="Where they watched"
          empty="No country recorded yet."
          rows={report?.byCountry ?? []}
          total={report?.totalMinutes ?? 0}
          note={UNRECORDED_NOTE}
        />
        <Breakdown
          title="On what"
          empty="No device recorded yet."
          rows={report?.byDevice ?? []}
          total={report?.totalMinutes ?? 0}
          note={UNRECORDED_NOTE}
        />
        <Breakdown
          title="At which quality"
          empty="No quality reported yet."
          rows={report?.byRung ?? []}
          total={report?.totalMinutes ?? 0}
          note="The app plays without reporting a rung, so its share sits under Not reported."
        />
      </section>
    </div>
  );
}

/**
 * A share, as a filled bar rather than a pie.
 *
 * Three slices of one total, read left to right, and the bar is the number: a
 * pie would need a legend and a legend is a second thing to read.
 */
function Breakdown({
  title,
  rows,
  total,
  empty,
  note,
}: {
  title: string;
  rows: AudienceSlice[];
  total: number;
  empty: string;
  note?: string;
}) {
  return (
    <div className="rounded-xl bg-card/50 p-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.slice(0, 6).map((row) => {
            const pct = total > 0 ? Math.round((row.minutes / total) * 100) : 0;
            return (
              <li key={row.label}>
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-foreground">{row.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatMinutes(row.minutes)} · {pct}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: MINT }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {note ? (
        <p className="mt-3 text-[11px] text-muted-foreground">{note}</p>
      ) : null}
    </div>
  );
}
