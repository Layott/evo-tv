"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { AdminAnalyticsRange } from "@/lib/client";
import { resolveRange } from "@/lib/analytics/range";

/**
 * Presets, a single day, or a window between two dates.
 *
 * Four fixed chips could not answer the question the channel actually asks,
 * which is how a particular night went. A premiere on the 12th was only ever
 * visible inside seven days of everything else.
 *
 * The dates are native date inputs on purpose. They are the one control every
 * phone already knows how to open, and the platform draws them itself.
 */

const PRESETS = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 28, label: "28 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RangePicker({
  value,
  onChange,
}: {
  value: AdminAnalyticsRange;
  onChange: (next: AdminAnalyticsRange) => void;
}) {
  const custom = "from" in value;
  const [open, setOpen] = React.useState(custom);
  const [from, setFrom] = React.useState(custom ? value.from : todayKey());
  const [to, setTo] = React.useState(
    custom ? (value.to ?? value.from) : todayKey(),
  );

  const resolved = resolveRange(value);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-card p-1.5">
        {PRESETS.map((preset) => {
          const active = !custom && value.days === preset.days;
          return (
            <button
              key={preset.days}
              type="button"
              onClick={() => {
                setOpen(false);
                onChange({ days: preset.days });
              }}
              className={
                active
                  ? "rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-md bg-transparent px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              }
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={
            custom
              ? "rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white"
              : "rounded-md bg-transparent px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          }
        >
          From a date to a date
        </button>
      </div>

      {open ? (
        <div className="flex flex-col gap-3 rounded-lg bg-card p-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="range-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="range-from"
              type="date"
              max={todayKey()}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="range-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="range-to"
              type="date"
              max={todayKey()}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              className="bg-sky-600 text-white hover:bg-sky-500"
              disabled={!from}
              onClick={() => onChange({ from, to: to || from })}
            >
              Show
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                // One day, which is the question a chip cannot express.
                setTo(from);
                onChange({ from, to: from });
              }}
              disabled={!from}
            >
              That day only
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Showing {resolved.label}
        {resolved.days > 1 ? ` · ${resolved.days} days` : ""}
      </p>
    </div>
  );
}
