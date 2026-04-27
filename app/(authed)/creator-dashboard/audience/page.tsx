"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Globe, Loader2, Smartphone, Users } from "lucide-react";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { getAudienceBreakdown, type AudienceStat } from "@/lib/mock/creators";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardShell } from "@/components/creators/dashboard-shell";

const PIE_COLORS = ["#0ea5e9", "#a855f7", "#f59e0b", "#10b981", "#f43f5e", "#737373"];

export default function CreatorAudiencePage() {
  const { user } = useMockAuth();
  const [stat, setStat] = React.useState<AudienceStat | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const s = await getAudienceBreakdown(user.id);
      if (!cancelled) {
        setStat(s);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <DashboardShell
      title="Audience"
      description="Where your viewers are tuning in from, who they are, and when they show up."
    >
      {loading || !stat ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl bg-neutral-900" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Top countries" icon={Globe} subtitle={`${stat.countries.reduce((s, c) => s + c.viewers, 0).toLocaleString()} unique viewers`}>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stat.countries} layout="vertical" margin={{ left: 8, right: 12 }}>
                    <CartesianGrid horizontal={false} stroke="#262626" />
                    <XAxis type="number" stroke="#737373" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      dataKey="label"
                      type="category"
                      stroke="#a3a3a3"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0a", border: "1px solid #262626", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [v.toLocaleString(), "Viewers"]}
                    />
                    <Bar dataKey="viewers" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Age distribution" icon={Users} subtitle="Across the last 30 days of viewers">
              <div className="grid h-72 grid-cols-[1fr_140px] items-center">
                <div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stat.ages}
                        dataKey="pct"
                        nameKey="bucket"
                        innerRadius={60}
                        outerRadius={92}
                        paddingAngle={2}
                        stroke="#0a0a0a"
                      >
                        {stat.ages.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#0a0a0a", border: "1px solid #262626", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number, _name, p) => [`${v}%`, p?.payload?.bucket]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-1.5 text-xs">
                  {stat.ages.map((a, i) => (
                    <li key={a.bucket} className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-sm"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-neutral-300">{a.bucket}</span>
                      <span className="ml-auto tabular-nums text-neutral-500">{a.pct}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>

          <Card title="Peak viewing hours" icon={Users} subtitle="Average concurrent viewers by hour of day (local timezone)">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stat.peakHours} margin={{ left: 0, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                  <XAxis dataKey="hour" stroke="#737373" fontSize={11} tickLine={false} axisLine={false} interval={2} />
                  <YAxis stroke="#737373" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#0a0a0a", border: "1px solid #262626", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [v.toLocaleString(), "Viewers"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="viewers"
                    stroke="#a855f7"
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: "#a855f7" }}
                    activeDot={{ r: 5, fill: "#fff", stroke: "#a855f7" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Devices" icon={Smartphone} subtitle="What your audience watches on">
            <ul className="space-y-3">
              {stat.devices.map((d, i) => (
                <li key={d.device}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-neutral-300">{d.device}</span>
                    <span className="tabular-nums text-neutral-500">{d.pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${d.pct}%`,
                        background: PIE_COLORS[i % PIE_COLORS.length],
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}

function Card({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
            <Icon className="size-4 text-sky-400" />
            {title}
          </h3>
          {subtitle ? <p className="text-[11px] text-neutral-500">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}
