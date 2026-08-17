"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PercentCircle, Users, Wallet } from "@/components/icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "./page-header";
import { MetricCard } from "./metric-card";
import { VideoAnalyticsPanel } from "./video-analytics-panel";
import { useQuery } from "@tanstack/react-query";
import {
  adminConversion,
  adminRetention,
  adminRevenueByMonth,
} from "@/lib/client";
import { formatCompact, formatNgn, formatNumber } from "./utils";

/**
 * Two questions, two tabs.
 *
 * "How is this video doing" is the one asked daily, so it opens first and gets
 * the whole page. It is per-title and modelled on YouTube Studio, because that
 * is the vocabulary the people making the programmes already have.
 *
 * "How is the business doing" is the second tab: signups converting, money
 * coming in, cohorts sticking. Nothing on either tab is generated. The charts
 * here used to be: views were a rising baseline plus noise, revenue was 3.2M
 * NGN climbing by 480k a month, and the ten "top titles" were invented names
 * with random view counts, all of it indistinguishable from a real reading.
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

export function AnalyticsPage() {
  const retentionQ = useQuery({
    queryKey: ["admin", "retention"],
    queryFn: () => adminRetention(8),
  });
  const revenueQ = useQuery({
    queryKey: ["admin", "revenue"],
    queryFn: () => adminRevenueByMonth(6),
  });
  const conversionQ = useQuery({
    queryKey: ["admin", "conversion"],
    queryFn: () => adminConversion(),
  });

  const retention = retentionQ.data?.matrix ?? [];
  const revenueByMonth = (revenueQ.data ?? []).map((r) => ({
    month: r.month,
    revenue: r.ngn,
  }));
  const mrr = revenueByMonth.at(-1)?.revenue ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="How each video performed, and how the platform is doing."
      />

      <Tabs defaultValue="videos">
        <TabsList className="mb-6 bg-card">
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="platform">Platform</TabsTrigger>
        </TabsList>

        <TabsContent value="videos">
          <VideoAnalyticsPanel />
        </TabsContent>

        <TabsContent value="platform">
          <div className="space-y-6">
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard
                title="Free to Premium"
                value={`${(conversionQ.data?.pct ?? 0).toFixed(1)}%`}
                hint={`${formatNumber(conversionQ.data?.convertedUsers ?? 0)} of ${formatNumber(conversionQ.data?.totalUsers ?? 0)} accounts`}
                icon={PercentCircle}
              />
              <MetricCard
                title="Subscription revenue"
                value={formatNgn(mrr)}
                hint="Most recent month"
                icon={Wallet}
              />
              <MetricCard
                title="Accounts"
                value={formatNumber(conversionQ.data?.totalUsers ?? 0)}
                icon={Users}
              />
            </section>

            <section className="rounded-xl bg-card/50 p-5">
              <h3 className="text-sm font-semibold text-foreground">
                Revenue by month
              </h3>
              <p className="text-xs text-muted-foreground">
                Last 6 months, premium subscriptions
              </p>
              {revenueByMonth.every((r) => r.revenue === 0) ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  No subscription revenue recorded yet.
                </p>
              ) : (
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByMonth}>
                      <CartesianGrid stroke="#123b3d" vertical={false} />
                      <XAxis
                        dataKey="month"
                        stroke={AXIS}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke={AXIS}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => formatCompact(v as number)}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(70,227,206,0.10)" }}
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(v) => [formatNgn(v as number), "Revenue"]}
                      />
                      <Bar
                        dataKey="revenue"
                        fill={MINT}
                        radius={[3, 3, 0, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="rounded-xl bg-card/50 p-5">
              <h3 className="text-sm font-semibold text-foreground">
                Retention cohort
              </h3>
              <p className="text-xs text-muted-foreground">
                Of everyone who signed up in a week, how many came back in the
                weeks after
              </p>
              {retention.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Not enough signup history yet to build cohorts.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-center text-xs">
                    <thead>
                      <tr>
                        <th className="p-1 text-left font-normal text-muted-foreground">
                          Cohort
                        </th>
                        {Array.from({ length: 8 }, (_, i) => (
                          <th
                            key={i}
                            className="p-1 font-normal text-muted-foreground"
                          >
                            W{i}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {retention.map((row, r) => (
                        <tr key={r}>
                          <td className="p-1 text-left text-muted-foreground">
                            W{r + 1}
                          </td>
                          {row.map((v, c) => (
                            <td
                              key={c}
                              className="rounded p-1 font-mono tabular-nums"
                              style={
                                v == null
                                  ? { color: "#3f5f5f" }
                                  : {
                                      backgroundColor: `rgba(70,227,206,${(v / 100) * 0.7 + 0.05})`,
                                      color: v > 55 ? "#052e2a" : "#c8f4ec",
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
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
