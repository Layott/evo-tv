"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Coins,
  Eye,
  Film,
  Heart,
  Loader2,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { getCreatorActivity, getCreatorMetrics, type CreatorMetrics } from "@/lib/mock/creators";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardShell } from "@/components/creators/dashboard-shell";
import { MetricCard } from "@/components/creators/metric-card";
import { relativeTime } from "@/components/profile/ngn";

const ACTIVITY_ICON: Record<string, React.ElementType> = {
  tip: Heart,
  follower: UserPlus,
  clip: Film,
  milestone: Zap,
};

const ACTIVITY_ACCENT: Record<string, string> = {
  tip: "text-pink-400",
  follower: "text-emerald-400",
  clip: "text-sky-400",
  milestone: "text-amber-400",
};

export default function CreatorDashboardOverviewPage() {
  const { user } = useMockAuth();
  const [metrics, setMetrics] = React.useState<CreatorMetrics | null>(null);
  const [activity, setActivity] = React.useState<
    Array<{ id: string; kind: string; label: string; at: string }>
  >([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [m, a] = await Promise.all([getCreatorMetrics(user.id), getCreatorActivity(user.id)]);
      if (cancelled) return;
      setMetrics(m);
      setActivity(a);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <DashboardShell
      title="Creator dashboard"
      description={metrics ? `This month — ${metrics.monthLabel}` : "Loading metrics..."}
      actions={
        <Button asChild className="bg-sky-600 hover:bg-sky-500">
          <Link href="/creator-dashboard/clips">
            <Film className="size-4" />
            Review clips
          </Link>
        </Button>
      }
    >
      {loading || !metrics ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl bg-neutral-900" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-2xl bg-neutral-900" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Hours streamed"
              value={`${metrics.hoursStreamed}h`}
              hint={`${metrics.monthLabel}`}
              icon={Clock}
              accent="sky"
              delta={12.4}
            />
            <MetricCard
              label="Avg concurrent"
              value={metrics.averageConcurrent.toLocaleString()}
              hint={`peak ${metrics.peakConcurrent.toLocaleString()}`}
              icon={Eye}
              accent="emerald"
              delta={8.1}
            />
            <MetricCard
              label="Tips received"
              value={`${metrics.totalTipsCoins.toLocaleString()}`}
              hint="EVO Coins this month"
              icon={Coins}
              accent="amber"
              delta={24.6}
            />
            <MetricCard
              label="Followers"
              value={`+${metrics.followerGrowth.toLocaleString()}`}
              hint={`${metrics.followerGrowthPct}% growth`}
              icon={UserPlus}
              accent="fuchsia"
              delta={metrics.followerGrowthPct}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-100">Recent activity</h3>
                <span className="text-[11px] uppercase tracking-wider text-neutral-500">live feed</span>
              </div>
              <ul className="mt-4 space-y-3">
                {activity.map((a) => {
                  const Icon = ACTIVITY_ICON[a.kind] ?? Zap;
                  return (
                    <li key={a.id} className="flex items-start gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-800">
                        <Icon className={"size-4 " + (ACTIVITY_ACCENT[a.kind] ?? "text-neutral-400")} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-neutral-100">{a.label}</p>
                        <p className="text-[11px] text-neutral-500">{relativeTime(a.at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="space-y-3">
              <QuickLink
                href="/creator-dashboard/earnings"
                title="Earnings"
                desc="Payouts, fees, monthly breakdown"
                icon={Coins}
                accent="text-amber-300 bg-amber-500/10 ring-amber-500/20"
              />
              <QuickLink
                href="/creator-dashboard/clips"
                title="Auto-clips queue"
                desc="Approve highlights from your last stream"
                icon={Film}
                accent="text-sky-300 bg-sky-500/10 ring-sky-500/20"
                badge={`${activity.filter((a) => a.kind === "clip").length} new`}
              />
              <QuickLink
                href="/creator-dashboard/audience"
                title="Audience demographics"
                desc="Who's watching, where, when"
                icon={Users}
                accent="text-fuchsia-300 bg-fuchsia-500/10 ring-fuchsia-500/20"
              />
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-emerald-300" />
                  <h4 className="text-sm font-semibold text-emerald-200">Tip of the week</h4>
                </div>
                <p className="mt-2 text-xs text-emerald-100/80">
                  Streamers who go live within 30 minutes of an EVO TV scheduled match see a 2.3× lift in average concurrent
                  viewers. Set up a recurring schedule to auto-promote.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function QuickLink({
  href,
  title,
  desc,
  icon: Icon,
  accent,
  badge,
}: {
  href: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  accent: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 transition hover:border-sky-500/40"
    >
      <div className={"flex size-10 items-center justify-center rounded-lg ring-1 " + accent}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-neutral-100">{title}</span>
          {badge ? (
            <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-neutral-500">{desc}</p>
      </div>
      <ArrowRight className="size-4 text-neutral-500" />
    </Link>
  );
}
