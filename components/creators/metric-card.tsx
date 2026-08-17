"use client";

import { ArrowDownRight, ArrowUpRight } from "@/components/icons";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
  delta?: number; // percentage
  icon?: React.ElementType;
  accent?: "sky" | "amber" | "emerald" | "rose";
}

const ACCENT: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  sky: "text-sky-400 bg-sky-500/25",
  amber: "text-amber-300 bg-amber-500/25",
  emerald: "text-emerald-300 bg-emerald-500/25",
  rose: "text-rose-300 bg-rose-500/25",
};

export function MetricCard({ label, value, hint, delta, icon: Icon, accent = "sky" }: MetricCardProps) {
  const positive = delta !== undefined && delta >= 0;
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex items-start justify-between">
        <div className="text-[10px] r text-muted-foreground">{label}</div>
        {Icon ? (
          <div className={cn("flex size-7 items-center justify-center rounded-lg", ACCENT[accent])}>
            <Icon className="size-4" />
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground tabular-nums">{value}</span>
        {delta !== undefined ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
              positive ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300",
            )}
          >
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : null}
      </div>
      {hint ? <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
