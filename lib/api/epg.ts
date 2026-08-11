import "server-only";

import { listScheduleBetween, type EpgRow } from "@/lib/api/schedule";
import { getGridSlots } from "@/lib/epg/slots";
import {
  applyOverrides,
  entryOnAir,
  materializeDay,
  zonedDateKey,
  zonedToUtc,
  type DatedEntry,
  type EpgPillar,
  type GridSlot,
  type ScheduleEntry,
} from "@/lib/epg/grid";

export interface DaySchedule {
  /** `YYYY-MM-DD` as the channel timezone reads it. */
  dateKey: string;
  /** ISO-8601 weekday, 1 = Monday. */
  dayOfWeek: number;
  entries: ScheduleEntry[];
}

export { getGridSlots };

function toDatedEntry(row: EpgRow): DatedEntry {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    pillar: row.pillar,
    airsAt: row.airsAt,
    durationMin: row.durationMin,
    watchUrl: row.watchUrl,
    thumbnailUrl: row.thumbnailUrl,
    isLive: row.state === "live",
  };
}

/**
 * `days` consecutive days of programming starting at `from`, in channel-local
 * time, with dated rows overlaid on the repeating grid.
 *
 * The dated rows are fetched once for the whole window rather than per day -
 * four queries for a week instead of twenty-eight.
 */
export async function getSchedule(
  from: Date = new Date(),
  days = 7,
  pillar?: EpgPillar | "all",
): Promise<DaySchedule[]> {
  const now = new Date();
  const startKey = zonedDateKey(from);
  const [y, m, d] = startKey.split("-").map(Number) as [number, number, number];

  const dateKeys: string[] = [];
  for (let i = 0; i < days; i++) {
    // Step by whole days through UTC noon, so the calendar date is unambiguous
    // whatever the zone offset, then read the local date back off it.
    dateKeys.push(
      zonedDateKey(new Date(Date.UTC(y, m - 1, d + i, 12, 0, 0))),
    );
  }

  const windowStart = zonedToUtc(y, m, d, 0);
  const windowEnd = new Date(windowStart.getTime() + days * 86_400_000);

  const [grid, dated] = await Promise.all([
    getGridSlots(),
    listScheduleBetween(
      windowStart.toISOString(),
      windowEnd.toISOString(),
      pillar,
    ),
  ]);

  // `listScheduleBetween` now folds the grid in as a fourth source for API
  // consumers. This function materialises the grid itself, so those rows are
  // dropped here - keeping them would duplicate every slot.
  const overrides = dated.filter((r) => r.kind !== "grid").map(toDatedEntry);

  return dateKeys.map((dateKey) => {
    const entries = applyOverrides(
      materializeDay(grid, dateKey, now).filter(
        (e) => !pillar || pillar === "all" || e.pillar === pillar,
      ),
      overrides.filter(
        (o) => o.airsAt >= dayStartIso(dateKey) && o.airsAt < dayEndIso(dateKey),
      ),
      now,
    );
    return {
      dateKey,
      dayOfWeek: dayOfWeekOf(dateKey),
      entries,
    };
  });
}

/**
 * What is on right now and what follows it.
 *
 * Reads two days so the last slot of the day can hand over to the first slot of
 * the next one - the 23:00 handover is the case that would otherwise return
 * nothing for `next`.
 */
export async function getNowAndNext(
  at: Date = new Date(),
  pillar?: EpgPillar | "all",
): Promise<{ now: ScheduleEntry | null; next: ScheduleEntry | null }> {
  const days = await getSchedule(at, 2, pillar);
  const entries = days.flatMap((d) => d.entries);
  const current = entryOnAir(entries, at);
  const iso = at.toISOString();
  const next = entries.find((e) =>
    current ? e.startsAt >= current.endsAt : e.startsAt > iso,
  );
  return { now: current, next: next ?? null };
}

/* ── Local date helpers ─────────────────────────────────────────────────── */

function partsOf(dateKey: string): [number, number, number] {
  return dateKey.split("-").map(Number) as [number, number, number];
}

function dayStartIso(dateKey: string): string {
  const [y, m, d] = partsOf(dateKey);
  return zonedToUtc(y, m, d, 0).toISOString();
}

function dayEndIso(dateKey: string): string {
  const [y, m, d] = partsOf(dateKey);
  return new Date(zonedToUtc(y, m, d, 0).getTime() + 86_400_000).toISOString();
}

function dayOfWeekOf(dateKey: string): number {
  const [y, m, d] = partsOf(dateKey);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 7 : dow;
}
