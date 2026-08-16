"use client";

import * as React from "react";
import Link from "next/link";

import { LocalTime } from "@/components/ui/local-time";
import { useQuery } from "@tanstack/react-query";
import {
  listScheduleForDay,
  type EpgPillar,
  type EpgRow,
} from "@/lib/client";

/**
 * The programme guide.
 *
 * One of the three things the MVP has to do: sign in, watch what is on, and see
 * what is coming. It reads `/api/schedule`, which merges dated rows (episodes,
 * scheduled streams, anything live right now) over the repeating weekly grid in
 * `epg_slots`, so this page has something to show from the moment the grid is
 * imported and gets more specific as an operator schedules real programmes.
 *
 * Set as listings rather than as a table: a time, a title, a leader, and one
 * marker for what is on now. No per-row cards, no category chips, no coloured
 * dots. Same reasoning as the landing week grid.
 */

const TZ = "Africa/Lagos";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PILLARS: Array<{ id: EpgPillar | "all"; label: string }> = [
  { id: "all", label: "Everything" },
  { id: "esports", label: "Esports" },
  { id: "anime", label: "Anime" },
  { id: "lifestyle", label: "Lifestyle" },
];

/** YYYY-MM-DD for an instant as the channel's own clock sees it. */
function dateKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts;
}

/** Weekday index (0 = Sunday) of a YYYY-MM-DD calendar date. */
function dayOfWeekOf(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function clockLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function endsAt(row: EpgRow): string {
  return new Date(
    new Date(row.airsAt).getTime() + row.durationMin * 60_000,
  ).toISOString();
}

function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export default function SchedulePage() {
  const [offset, setOffset] = React.useState(0);
  const [pillar, setPillar] = React.useState<EpgPillar | "all">("all");
  const [now, setNow] = React.useState<string | null>(null);

  // `now` starts null and is filled after mount. Reading the clock during
  // render would make the server markup and the first client paint disagree
  // about which row is on air, which React reports as a hydration mismatch.
  React.useEffect(() => {
    setNow(new Date().toISOString());
    const id = setInterval(() => setNow(new Date().toISOString()), 30_000);
    return () => clearInterval(id);
  }, []);

  const days = React.useMemo(() => {
    const base = Date.now();
    return Array.from({ length: 7 }, (_, i) => {
      const key = dateKey(new Date(base + i * 86_400_000));
      // Weekday comes from the channel-local date, not from the viewer's clock.
      // `getDay()` on the raw instant reads the browser's zone, so at 21:00 in
      // New York it would label Lagos's tomorrow with today's weekday name and
      // print it next to tomorrow's date.
      return { key, dow: dayOfWeekOf(key), offset: i };
    });
  }, []);

  const day = days[offset] ?? days[0];

  const { data: rows = [], isPending, isError, refetch } = useQuery({
    queryKey: ["schedule", day.key, pillar],
    queryFn: () => listScheduleForDay(day.key, pillar),
  });

  const onAirId = React.useMemo(() => {
    if (!now) return null;
    return rows.find((r) => r.airsAt <= now && now < endsAt(r))?.id ?? null;
  }, [rows, now]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Schedule
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All times West Africa Time.
        </p>
      </header>

      {/* Day strip. Scrolls rather than wraps so the row height never changes
          as the week is stepped through on a phone. */}
      <div className="-mx-4 mt-6 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max items-end gap-6 sm:gap-8">
          {days.map((d) => {
            const active = d.offset === offset;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setOffset(d.offset)}
                aria-pressed={active}
                // The label lives in nested spans split across two lines, so
                // the button reads as an unnamed control without this.
                aria-label={`${d.offset === 0 ? "Today" : DAY_NAMES[d.dow]}, ${d.key}`}
                className="group shrink-0 text-left"
              >
                <span
                  className={[
                    "block text-lg font-semibold transition-colors sm:text-xl",
                    active
                      ? "text-sky-400"
                      : "text-muted-foreground group-hover:text-foreground",
                  ].join(" ")}
                >
                  {d.offset === 0 ? "Today" : DAY_NAMES[d.dow]}
                </span>
                <span className="mt-0.5 block font-mono text-[0.68rem] tabular-nums text-muted-foreground">
                  {d.key.slice(8)}.{d.key.slice(5, 7)}
                </span>
                <span
                  aria-hidden
                  className={[
                    "mt-2 block h-[3px] origin-left transition-transform duration-200",
                    active
                      ? "scale-x-100 bg-sky-400"
                      : "scale-x-0 bg-muted-foreground group-hover:scale-x-100",
                  ].join(" ")}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Pillar filter as text. No chips. */}
      <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2">
        {PILLARS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPillar(p.id)}
            aria-pressed={pillar === p.id}
            className={[
              "text-[0.95rem] underline-offset-[6px] transition-colors",
              pillar === p.id
                ? "text-foreground underline decoration-sky-400 decoration-2"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {isPending ? (
          <ul className="space-y-4">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="flex items-baseline gap-4">
                <span className="h-4 w-12 shrink-0 animate-pulse rounded bg-muted" />
                <span className="h-4 flex-1 animate-pulse rounded bg-card" />
              </li>
            ))}
          </ul>
        ) : isError ? (
          <div className="py-10">
            <p className="text-sm text-muted-foreground">
              The schedule could not be loaded.
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 text-sm text-sky-400 underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-muted-foreground">
            {pillar === "all"
              ? "Nothing scheduled for this day yet."
              : "Nothing on this day in that pillar."}
          </p>
        ) : (
          <ul>
            {rows.map((row) => (
              <SlotRow key={row.id} row={row} onAir={row.id === onAirId} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SlotRow({ row, onAir }: { row: EpgRow; onAir: boolean }) {
  const body = (
    <div
      className={[
        "flex items-baseline gap-4 border-b border-border py-3.5 transition-colors sm:gap-6",
        onAir ? "text-foreground" : "text-foreground/80",
        row.watchUrl ? "group-hover:border-input" : "",
      ].join(" ")}
    >
      <span
        className={[
          "w-12 shrink-0 font-mono text-sm tabular-nums",
          onAir ? "text-sky-400" : "text-muted-foreground",
        ].join(" ")}
      >
        <LocalTime iso={row.airsAt} showChannelTime />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className={[
              "font-semibold",
              row.watchUrl ? "group-hover:text-sky-400" : "",
            ].join(" ")}
          >
            {row.title}
          </span>
          {onAir ? (
            <span className="rounded-sm bg-red-600 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white">
              On now
            </span>
          ) : null}
        </span>
        {row.subtitle ? (
          <span className="mt-0.5 block truncate text-sm text-muted-foreground">
            {row.subtitle}
          </span>
        ) : null}
      </span>

      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        {durationLabel(row.durationMin)}
      </span>
    </div>
  );

  // A grid row is the rotation rather than a page, so it carries no link. Only
  // dated rows (an episode, a scheduled stream, a match) go anywhere.
  return row.watchUrl ? (
    <li>
      <Link href={row.watchUrl} className="group block">
        {body}
      </Link>
    </li>
  ) : (
    <li>{body}</li>
  );
}
