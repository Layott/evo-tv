"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/admin/page-header";
import { ArrowLeft, ArrowRight } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * One month, and everything dated in it.
 *
 * A broadcast with a scheduled start, a video with a release date and an
 * episode with a premiere each lived on a different screen, so "what is
 * happening on Thursday" meant opening three pages and holding the answer in
 * your head. The weekly grid is deliberately not here: it repeats, and it would
 * bury the things that do not.
 */
interface CalendarEntry {
  id: string;
  kind: "broadcast" | "video" | "episode";
  title: string;
  at: string;
  durationMin: number | null;
  href: string;
  past: boolean;
  detail: string | null;
}

const KIND_LABEL: Record<CalendarEntry["kind"], string> = {
  broadcast: "Live",
  video: "Video",
  episode: "Episode",
};

/**
 * Colour carries meaning here and nothing else does the job: three kinds of
 * thing share one grid, and the alternative is three words repeated in every
 * cell until the cell is only words.
 */
const KIND_STYLE: Record<CalendarEntry["kind"], string> = {
  broadcast: "bg-red-500/15 text-red-200",
  video: "bg-sky-400/15 text-sky-200",
  episode: "bg-emerald-400/15 text-emerald-200",
};

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CalendarPage() {
  const [month, setMonth] = React.useState(() => startOfMonth(new Date()));

  const from = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
  const to = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
    23,
    59,
    59,
  ).toISOString();

  const query = useQuery({
    queryKey: ["admin", "calendar", from, to],
    queryFn: async (): Promise<CalendarEntry[]> => {
      const res = await fetch(
        `/api/admin/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(await res.text());
      const body = (await res.json()) as { entries: CalendarEntry[] };
      return body.entries;
    },
  });

  const byDay = React.useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of query.data ?? []) {
      const key = dayKey(new Date(entry.at));
      const list = map.get(key);
      if (list) list.push(entry);
      else map.set(key, [entry]);
    }
    return map;
  }, [query.data]);

  /*
   * Monday first, and the leading blanks come from the 1st's weekday. Lagos has
   * no DST, so this arithmetic cannot acquire the hour-shifting bug that the
   * schedule grid avoids by storing minutes.
   */
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const leading = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1),
    ),
  ];

  const todayKey = dayKey(new Date());
  const monthLabel = month.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Every broadcast, release and premiere with a date on it. The weekly grid lives on Schedule."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              aria-label="Previous month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-40 text-center text-sm font-medium text-foreground">
              {monthLabel}
            </span>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              onClick={() => setMonth(startOfMonth(new Date()))}
            >
              Today
            </Button>
          </div>
        }
      />

      {query.isError ? (
        <div className="rounded-xl bg-card p-6">
          <p className="text-sm text-muted-foreground">
            The calendar could not be loaded.
          </p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-3 text-sm text-sky-400 underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="mb-2 grid grid-cols-7 gap-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <span
                key={d}
                className="px-1 text-xs font-medium text-muted-foreground"
              >
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {cells.map((date, i) => {
              if (!date) {
                return <div key={`blank-${i}`} className="min-h-28" />;
              }
              const key = dayKey(date);
              const entries = byDay.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-28 rounded-xl p-2",
                    // Fill, not a line, and today is a step brighter rather
                    // than an outline.
                    isToday ? "bg-card" : "bg-card/40",
                  )}
                >
                  <span
                    className={cn(
                      "block text-xs tabular-nums",
                      isToday
                        ? "font-semibold text-sky-300"
                        : "text-muted-foreground",
                    )}
                  >
                    {date.getDate()}
                  </span>
                  <div className="mt-1 space-y-1">
                    {entries.map((entry) => (
                      <Link
                        key={entry.id}
                        href={entry.href}
                        title={`${KIND_LABEL[entry.kind]} · ${entry.title}${
                          entry.detail ? ` · ${entry.detail}` : ""
                        }`}
                        className={cn(
                          "block rounded-md px-1.5 py-1 text-[11px] leading-tight",
                          KIND_STYLE[entry.kind],
                          entry.past ? "opacity-50" : "",
                        )}
                      >
                        <span className="block tabular-nums opacity-80">
                          {timeLabel(entry.at)}
                        </span>
                        <span className="block truncate font-medium">
                          {entry.title}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {query.isPending ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : (query.data?.length ?? 0) === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nothing is dated in {monthLabel}. Broadcasts appear here once they
              have a scheduled start, videos once they have a release date, and
              episodes once they have a premiere.
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {(["broadcast", "video", "episode"] as const).map((kind) => (
              <span
                key={kind}
                className={cn("rounded-md px-2 py-1", KIND_STYLE[kind])}
              >
                {KIND_LABEL[kind]}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default CalendarPage;
