"use client";

import { ArrowDownRight, ArrowUpRight } from "@/components/icons";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  hint?: string;
}

export function MetricCard({ title, value, delta, deltaLabel, icon: Icon, hint }: MetricCardProps) {
  const isPositive = typeof delta === "number" ? delta >= 0 : true;
  const showDelta = typeof delta === "number";

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium r text-muted-foreground">{title}</div>
        {Icon ? (
          <div className="rounded-md bg-muted/50 p-1.5 text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
          </div>
        ) : null}
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground tabular-nums">{value}</div>
      <div className="mt-1 flex items-center gap-1.5 text-xs">
        {showDelta ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              isPositive ? "text-sky-400" : "text-red-400",
            )}
          >
            {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta!).toFixed(1)}%
          </span>
        ) : null}
        {/* The label only means something next to the number it qualifies. On
            its own it rendered as a bare "vs yesterday" under a figure with
            nothing to compare it to. */}
        {deltaLabel && showDelta ? (
          <span className="text-muted-foreground">{deltaLabel}</span>
        ) : null}
        {hint && !(deltaLabel && showDelta) ? (
          <span className="text-muted-foreground">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}
