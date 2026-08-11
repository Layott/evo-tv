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

/**
 * The week, set as printed TV listings rather than as a table.
 *
 * Rows have no boxes and no per-category colour chip. Separation comes from a
 * dotted leader and from type scale, which is how a schedule is set on paper —
 * and the previous version's bordered two-column grid with a coloured dot per
 * row was the most dashboard-looking block on the page.
 */
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
    <section
      id="week"
      className="relative mx-auto max-w-[92rem] px-5 py-20 sm:px-10 sm:py-28"
    >
      <div className="reveal flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <h2 className="landing-display text-[clamp(2.4rem,7vw,5rem)]">The week</h2>
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-[var(--paper-faint)]">
          West Africa Time
        </span>
      </div>

      <p className="mt-4 max-w-[52ch] text-[0.98rem] text-[var(--paper-dim)]">
        The grid repeats weekly. A scheduled stream replaces the slots it covers.
      </p>

      {/* Day selector. Type, not pills — scrolls rather than wraps on a phone so
          the row height never changes as the week is stepped through. */}
      <div className="-mx-5 mt-10 overflow-x-auto px-5 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max items-end gap-7 sm:gap-10">
          {days.map((d, i) => {
            const active = i === dayIndex;
            return (
              <button
                key={d.dateKey}
                type="button"
                onClick={() => setDayIndex(i)}
                aria-pressed={active}
                className="group shrink-0 text-left"
              >
                <span
                  className={[
                    "landing-display block text-[1.55rem] transition-colors sm:text-[1.9rem]",
                    active
                      ? "text-[var(--brand)]"
                      : "text-[var(--paper-faint)] group-hover:text-[var(--paper)]",
                  ].join(" ")}
                >
                  {i === 0 ? "Today" : DAY_NAMES[d.dayOfWeek - 1]}
                </span>
                <span className="mt-1 block font-mono text-[0.68rem] tabular-nums text-[var(--paper-faint)]">
                  {d.dateKey.slice(8)}.{d.dateKey.slice(5, 7)}
                </span>
                {/* Scales in from the left rather than cutting on/off. */}
                <span
                  aria-hidden
                  className={[
                    "day-underline mt-2 block h-[3px]",
                    active
                      ? "scale-x-100 bg-[var(--brand)]"
                      : "scale-x-0 bg-[var(--paper-faint)] group-hover:scale-x-100",
                  ].join(" ")}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Pillar filter, as text. No chips, no dots. */}
      <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-3">
        <FilterLink
          label="Everything"
          active={pillar === "all"}
          onClick={() => setPillar("all")}
        />
        {PILLAR_ORDER.map((p) => (
          <FilterLink
            key={p}
            label={PILLARS[p].label}
            active={pillar === p}
            onClick={() => setPillar(p)}
          />
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="mt-14 font-mono text-[0.9rem] uppercase tracking-[0.2em] text-[var(--paper-faint)]">
          Nothing on this day in that pillar
        </p>
      ) : (
        // Two columns on desktop, split in half rather than using a grid: a grid
        // fills row by row, so a day would read 00:00, 01:00 across and then
        // jump back left. Two lists keep each column chronological, and they
        // stack into one continuous running order on a phone.
        // Keyed on day + pillar so React remounts the rows on every click and
        // the row animation replays, rather than firing only on first paint.
        <div
          key={`${day.dateKey}_${pillar}`}
          className="mt-10 grid gap-x-16 sm:grid-cols-2"
        >
          {[
            entries.slice(0, Math.ceil(entries.length / 2)),
            entries.slice(Math.ceil(entries.length / 2)),
          ].map((column, i) =>
            column.length === 0 ? null : (
              <ul key={i}>
                {column.map((entry, j) => (
                  <SlotRow
                    key={`${entry.source}_${entry.id}`}
                    entry={entry}
                    now={now}
                    // Both columns stagger together, so the two halves of the
                    // day arrive as one wave rather than one after the other.
                    delayMs={j * 26}
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

function FilterLink({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "text-[0.8rem] uppercase tracking-[0.18em] underline-offset-[7px] transition-colors",
        active
          ? "text-[var(--paper)] underline decoration-[var(--brand)] decoration-2"
          : "text-[var(--paper-faint)] hover:text-[var(--paper-dim)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function SlotRow({
  entry,
  now,
  delayMs,
}: {
  entry: ScheduleEntry;
  now: string;
  delayMs: number;
}) {
  const live = entry.startsAt <= now && now < entry.endsAt;
  const past = entry.endsAt <= now;
  const art = artForTitle(entry.title);

  return (
    <li
      style={{ animationDelay: `${delayMs}ms` }}
      className={[
        "listing-row flex items-baseline gap-4 py-3.5 sm:gap-5",
        past ? "opacity-45" : "",
      ].join(" ")}
    >
      <span
        className={[
          "w-[3.2rem] shrink-0 font-mono text-[0.78rem] tabular-nums",
          live ? "text-[var(--brand)]" : "text-[var(--paper-faint)]",
        ].join(" ")}
      >
        {entry.startLabel}
      </span>

      {/* Artwork only where the design team has delivered it. Most of the 25
          grid titles have no poster, and a generic placeholder would read as a
          broken asset — so the type simply carries the row instead. */}
      {art ? (
        <Image
          src={art.posterSmall}
          alt=""
          width={26}
          height={33}
          placeholder="blur"
          blurDataURL={art.blurDataURL}
          className="h-[33px] w-[26px] shrink-0 self-center object-cover"
        />
      ) : null}

      {/* Titles wrap rather than truncate. Several grid titles are long
          ("MPRO LEAGUE FREEFIRE PLAYINS GROUP B") and clipping them mid-word in
          a two-column layout loses the programme name entirely. */}
      <span className="min-w-0 flex-1">
        <span
          className={[
            "landing-display block text-balance text-[1.12rem] sm:text-[1.28rem]",
            live ? "text-[var(--brand)]" : "text-[var(--paper)]",
          ].join(" ")}
        >
          {entry.title}
        </span>
        {entry.subtitle ? (
          <span className="mt-0.5 block text-[0.82rem] text-[var(--paper-faint)]">
            {entry.subtitle}
          </span>
        ) : null}
      </span>

      <span aria-hidden className="listing-leader hidden h-px w-10 shrink-0 lg:block" />

      <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.18em] text-[var(--paper-faint)]">
        {live ? (
          <span className="text-[var(--brand)]">On air</span>
        ) : entry.source === "override" ? (
          <span className="text-[var(--paper-dim)]">Special</span>
        ) : (
          PILLARS[entry.pillar].label
        )}
      </span>
    </li>
  );
}
