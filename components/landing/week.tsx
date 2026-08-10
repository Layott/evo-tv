"use client";

import * as React from "react";
import Image from "next/image";
import { artForTitle } from "@/lib/epg/artwork";
import type { EpgPillar, ScheduleEntry } from "@/lib/epg/grid";
import { PILLARS, PILLAR_ORDER } from "./pillar";

export interface WeekDay {
  dateKey: string;
  dayOfWeek: number;
  entries: ScheduleEntry[];
}

interface Props {
  days: WeekDay[];
  /** Server's clock at render, so the first paint matches the markup. */
  nowIso: string;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Week({ days, nowIso }: Props) {
  const [dayIndex, setDayIndex] = React.useState(0);
  const [pillar, setPillar] = React.useState<EpgPillar | "all">("all");
  const [now, setNow] = React.useState(nowIso);

  // The server-rendered page revalidates on a timer; this keeps the live row
  // correct in between without refetching anything.
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date().toISOString()), 30_000);
    return () => clearInterval(id);
  }, []);

  const day = days[dayIndex] ?? days[0];
  const entries = React.useMemo(() => {
    if (!day) return [];
    return pillar === "all"
      ? day.entries
      : day.entries.filter((e) => e.pillar === pillar);
  }, [day, pillar]);

  if (!day) return null;

  return (
    <section id="week" className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
        The week
      </h2>
      <p className="mt-2 text-sm text-neutral-500">
        All times West Africa Time. The grid repeats weekly; scheduled streams
        replace it.
      </p>

      {/* Day selector. Scrolls rather than wraps on a phone, so the row height
          never changes as the week is stepped through. */}
      <div className="-mx-5 mt-7 overflow-x-auto px-5 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2 sm:w-full">
          {days.map((d, i) => {
            const active = i === dayIndex;
            return (
              <button
                key={d.dateKey}
                type="button"
                onClick={() => setDayIndex(i)}
                aria-pressed={active}
                className={[
                  "flex min-w-[4.5rem] flex-1 flex-col items-center rounded-xl border px-3 py-2.5 transition-colors",
                  active
                    ? "border-white/25 bg-white/10 text-white"
                    : "border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20 hover:text-neutral-200",
                ].join(" ")}
              >
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {i === 0 ? "Today" : DAY_NAMES[d.dayOfWeek - 1]}
                </span>
                <span className="mt-0.5 font-mono text-[11px] tabular-nums text-neutral-500">
                  {d.dateKey.slice(8)}/{d.dateKey.slice(5, 7)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pillar filter. */}
      <div className="mt-4 flex flex-wrap gap-2">
        <FilterChip
          label="Everything"
          active={pillar === "all"}
          onClick={() => setPillar("all")}
        />
        {PILLAR_ORDER.map((p) => (
          <FilterChip
            key={p}
            label={PILLARS[p].label}
            accent={PILLARS[p].accent}
            active={pillar === p}
            onClick={() => setPillar(p)}
          />
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-8 text-center text-sm text-neutral-500">
          Nothing on this day in that pillar.
        </p>
      ) : (
        // Split in half rather than using a two-column grid: a grid fills row by
        // row, so a day would read 00:00, 01:00 across and then jump back left.
        // Two lists keep each column chronological top to bottom, and they stack
        // into one continuous running order on a phone.
        <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">
          {[
            entries.slice(0, Math.ceil(entries.length / 2)),
            entries.slice(Math.ceil(entries.length / 2)),
          ].map((column, i) =>
            column.length === 0 ? null : (
              <ul key={i} className="grid gap-px bg-white/10">
                {column.map((entry) => (
                  <SlotRow
                    key={`${entry.source}_${entry.id}`}
                    entry={entry}
                    now={now}
                  />
                ))}
              </ul>
            ),
          )}
        </div>
      )}
    </section>
  );
}

function FilterChip({
  label,
  accent,
  active,
  onClick,
}: {
  label: string;
  accent?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-white/30 bg-white/10 text-white"
          : "border-white/10 text-neutral-400 hover:border-white/20 hover:text-neutral-200",
      ].join(" ")}
    >
      {accent ? (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: accent }}
        />
      ) : null}
      {label}
    </button>
  );
}

function SlotRow({ entry, now }: { entry: ScheduleEntry; now: string }) {
  const pillar = PILLARS[entry.pillar];
  const live = entry.startsAt <= now && now < entry.endsAt;
  const past = entry.endsAt <= now;
  const art = artForTitle(entry.title);

  return (
    <li
      className={[
        "flex items-center gap-3.5 bg-[#05091a] px-4 py-3.5 transition-colors sm:px-5",
        past ? "opacity-55" : "",
        live ? "bg-white/[0.06]" : "",
      ].join(" ")}
    >
      <span className="w-11 shrink-0 font-mono text-xs tabular-nums text-neutral-500">
        {entry.startLabel}
      </span>

      {/* Artwork when the design team has delivered it; a pillar-coloured rule
          when they have not. Most of the 25 grid titles have no poster yet, and
          a generic placeholder image would read as a broken asset. */}
      {art ? (
        <Image
          src={art.posterSmall}
          alt=""
          width={32}
          height={40}
          placeholder="blur"
          blurDataURL={art.blurDataURL}
          className="h-10 w-8 shrink-0 rounded object-cover ring-1 ring-white/10"
        />
      ) : (
        <span
          aria-hidden
          className="h-10 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: pillar.accent, opacity: live ? 1 : 0.45 }}
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{entry.title}</p>
        <p className="truncate text-xs text-neutral-500">
          {entry.subtitle ? `${entry.subtitle} · ` : ""}
          {pillar.label}
          {entry.parentalRating ? ` · ${entry.parentalRating}+` : ""}
        </p>
      </div>

      {live ? (
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: pillar.tint, color: pillar.accent }}
        >
          Live
        </span>
      ) : null}
      {entry.source === "override" && !live ? (
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-300">
          Special
        </span>
      ) : null}
    </li>
  );
}
