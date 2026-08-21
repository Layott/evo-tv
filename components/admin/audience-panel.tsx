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
import { apiGet, type AdminAnalyticsRange } from "@/lib/client";
import { MetricCard } from "./metric-card";
import { RangePicker } from "./range-picker";
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

interface AudiencePerson {
  userId: string;
  name: string | null;
  handle: string | null;
  email: string | null;
  minutes: number;
  days: number;
  lastSeen: string;
  country: string | null;
  device: string | null;
  platform: string | null;
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
  byPlatform: AudienceSlice[];
  byModel: AudienceSlice[];
  byOs: AudienceSlice[];
  byAppVersion: AudienceSlice[];
  people: AudiencePerson[];
  anonymousMinutes: number;
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
  /*
   * The window is the operator's, not mine.
   *
   * Thirty days was fixed, so "how did the premiere on the 12th go" could only
   * be asked by squinting at a month of everything else. Same control as the
   * Videos tab, and the endpoint already spoke both grammars.
   */
  const [range, setRange] = React.useState<AdminAnalyticsRange>({ days });

  const audienceQ = useQuery({
    queryKey: ["admin", "audience", range],
    queryFn: () =>
      apiGet<AudienceReport>("/api/admin/analytics/audience", range as never),
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">The audience</h3>
          <p className="text-xs text-muted-foreground">
            Counted from the beats real players send, over the window you pick.
          </p>
        </div>
        <RangePicker value={range} onChange={setRange} />
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          title="People"
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
          title="App or website"
          empty="Nothing has reported which it is yet."
          rows={report?.byPlatform ?? []}
          total={report?.totalMinutes ?? 0}
          note={UNRECORDED_NOTE}
        />
        <Breakdown
          title="Where they watched"
          empty="No country recorded yet."
          rows={report?.byCountry ?? []}
          total={report?.totalMinutes ?? 0}
          note={UNRECORDED_NOTE}
        />
        <Breakdown
          title="Phone, tablet or desktop"
          empty="No device recorded yet."
          rows={report?.byDevice ?? []}
          total={report?.totalMinutes ?? 0}
          note={UNRECORDED_NOTE}
        />
        <Breakdown
          title="Which handset or browser"
          empty="No model reported yet."
          rows={report?.byModel ?? []}
          total={report?.totalMinutes ?? 0}
          note="The app names the handset; a browser is named by what it admits to in its user agent."
        />
        <Breakdown
          title="Operating system"
          empty="No system reported yet."
          rows={report?.byOs ?? []}
          total={report?.totalMinutes ?? 0}
          note={UNRECORDED_NOTE}
        />
        <Breakdown
          title="Which app build"
          empty="No build reported yet."
          rows={report?.byAppVersion ?? []}
          total={report?.totalMinutes ?? 0}
          note="Website viewers have no build, and neither does an app older than the one that started reporting."
        />
        <Breakdown
          title="At which quality"
          empty="No quality reported yet."
          rows={report?.byRung ?? []}
          total={report?.totalMinutes ?? 0}
          note="The website reports the rung its player chose. The app's native player does not expose one, so its share sits under Not reported until expo-video can say."
        />
      </section>

      <section className="rounded-xl bg-card/50 p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Who watched
            </h3>
            <p className="text-xs text-muted-foreground">
              Signed-in accounts, most-watched first. Anonymous viewers are a
              hashed connection and a number of minutes, so they are counted
              below rather than listed as people.
            </p>
          </div>
          {report && report.anonymousMinutes > 0 ? (
            <span className="text-xs text-muted-foreground">
              {formatMinutes(report.anonymousMinutes)} watched signed out
            </span>
          ) : null}
        </div>

        {audienceQ.isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Reading…</p>
        ) : (report?.people.length ?? 0) === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nobody signed in has watched in this window.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-4 font-normal">Who</th>
                  <th className="py-1 pr-4 font-normal">Watched</th>
                  <th className="py-1 pr-4 font-normal">Days</th>
                  <th className="py-1 pr-4 font-normal">On</th>
                  <th className="py-1 pr-4 font-normal">From</th>
                  <th className="py-1 font-normal">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {(report?.people ?? []).map((person) => (
                  <tr key={person.userId}>
                    <td className="py-1.5 pr-4">
                      <span className="block text-foreground">
                        {person.name ?? person.handle ?? "Deleted account"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {person.handle ? `@${person.handle}` : (person.email ?? "")}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4 tabular-nums text-foreground">
                      {formatMinutes(person.minutes)}
                    </td>
                    <td className="py-1.5 pr-4 tabular-nums text-muted-foreground">
                      {person.days}
                    </td>
                    <td className="py-1.5 pr-4 text-muted-foreground">
                      {person.platform === "android"
                        ? "Android app"
                        : person.platform === "ios"
                          ? "iOS app"
                          : person.platform === "web"
                            ? "Website"
                            : (person.device ?? "Not reported")}
                    </td>
                    <td className="py-1.5 pr-4 text-muted-foreground">
                      {person.country ?? "Not recorded"}
                    </td>
                    <td className="py-1.5 text-muted-foreground">
                      {new Date(person.lastSeen).toLocaleString(undefined, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
