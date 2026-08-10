/**
 * Pure time maths for the repeating weekly programme grid.
 *
 * Deliberately free of database and `server-only` imports so it can be unit
 * tested against fixed clock inputs. Everything that touches Postgres lives in
 * `lib/api/epg.ts` and calls into here.
 *
 * The whole module works in **minute-of-week**: `(dayOfWeek - 1) * 1440 +
 * startMinute`, a value in `[0, 10080)`. Sunday 23:00 rolling into Monday 00:00
 * is then plain modular arithmetic rather than a special case, which is where
 * hand-rolled schedule code usually breaks.
 */

export type EpgPillar = "esports" | "anime" | "lifestyle";

export const MINUTES_PER_DAY = 1440;
export const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7;

/**
 * The channel is programmed in Lagos time and always will be. The runbook
 * already records an hour-wide bug from crons running UTC while the droplet ran
 * Lagos; the same mistake here would put the entire channel an hour out, which
 * reads as "the schedule is wrong" rather than as a bug.
 */
export const CHANNEL_TZ = "Africa/Lagos";

export interface GridSlot {
  id: string;
  /** ISO-8601 weekday: 1 = Monday ... 7 = Sunday. */
  dayOfWeek: number;
  /** Minutes from local midnight, 0..1439. */
  startMinute: number;
  durationMin: number;
  title: string;
  pillar: EpgPillar;
  parentalRating: number | null;
  slotCode: string | null;
}

/** A dated row (scheduled stream, premiering episode, match) that can override the grid. */
export interface DatedEntry {
  id: string;
  title: string;
  subtitle: string;
  pillar: EpgPillar;
  /** ISO instant. */
  airsAt: string;
  durationMin: number;
  watchUrl: string;
  thumbnailUrl: string;
  isLive: boolean;
}

export interface ScheduleEntry {
  /** `grid` is the weekly rotation; `override` is a dated row that replaced it. */
  source: "grid" | "override";
  id: string;
  title: string;
  /** Second half of a compound `A \ B` slot title, or a dated row's own subtitle. */
  subtitle: string;
  pillar: EpgPillar;
  parentalRating: number | null;
  /** ISO instants. */
  startsAt: string;
  endsAt: string;
  /** `HH:MM` in the channel timezone, safe to render on the server. */
  startLabel: string;
  endLabel: string;
  durationMin: number;
  watchUrl: string | null;
  thumbnailUrl: string | null;
  isLive: boolean;
}

/* ── Timezone primitives ────────────────────────────────────────────────── */

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const PART_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: CHANNEL_TZ,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function partsInZone(at: Date): ZonedParts {
  const out: Record<string, number> = {};
  for (const p of PART_FORMATTER.formatToParts(at)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  // `hour12: false` still renders midnight as 24 in some ICU versions.
  const hour = out.hour === 24 ? 0 : out.hour;
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour,
    minute: out.minute,
    second: out.second,
  };
}

/** Minutes that the channel timezone is ahead of UTC at a given instant. */
function zoneOffsetMinutes(at: Date): number {
  const p = partsInZone(at);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Millisecond component is unchanged by the formatter, so drop it from both sides.
  return (asIfUtc - (at.getTime() - at.getUTCMilliseconds())) / 60_000;
}

/**
 * The UTC instant of a wall-clock time in the channel timezone.
 *
 * Two passes: the first offset is guessed from the naive instant, then
 * re-derived from the corrected one. Lagos has no DST so a single pass would
 * do, but a zone that does would otherwise be an hour out twice a year.
 */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  minuteOfDay = 0,
): Date {
  const naive = Date.UTC(year, month - 1, day, 0, minuteOfDay);
  let guess = new Date(naive - zoneOffsetMinutes(new Date(naive)) * 60_000);
  guess = new Date(naive - zoneOffsetMinutes(guess) * 60_000);
  return guess;
}

/** Calendar date in the channel timezone, as `YYYY-MM-DD`. */
export function zonedDateKey(at: Date): string {
  const p = partsInZone(at);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** ISO-8601 weekday (1 = Monday ... 7 = Sunday) in the channel timezone. */
export function zonedDayOfWeek(at: Date): number {
  const p = partsInZone(at);
  // Build a UTC date from the *local* calendar fields, so getUTCDay() reports
  // the local weekday rather than the UTC one.
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

/** Position within the programme week, in `[0, 10080)`. */
export function zonedMinuteOfWeek(at: Date): number {
  const p = partsInZone(at);
  return (zonedDayOfWeek(at) - 1) * MINUTES_PER_DAY + p.hour * 60 + p.minute;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** `HH:MM` for a minute-of-day, wrapping so 1440 renders as `00:00`. */
export function minuteLabel(minuteOfDay: number): string {
  const m = ((minuteOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/* ── Grid maths ─────────────────────────────────────────────────────────── */

export function slotMinuteOfWeek(slot: GridSlot): number {
  return (slot.dayOfWeek - 1) * MINUTES_PER_DAY + slot.startMinute;
}

export function sortGrid(slots: GridSlot[]): GridSlot[] {
  return [...slots].sort((a, b) => slotMinuteOfWeek(a) - slotMinuteOfWeek(b));
}

/**
 * The slot covering a given minute-of-week, or null if the grid is empty.
 *
 * Walks backwards from the last slot that starts at or before `mow`. A minute
 * before the first slot of the week belongs to the final slot, which wraps
 * across Sunday midnight — that is the case a naive `find` gets wrong.
 */
export function slotIndexAt(sorted: GridSlot[], mow: number): number | null {
  if (sorted.length === 0) return null;
  const m = ((mow % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;

  let candidate = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (slotMinuteOfWeek(sorted[i]!) <= m) candidate = i;
    else break;
  }

  if (candidate === -1) {
    // Before the week's first slot: the wrapping tail slot owns this minute,
    // but only if it actually reaches round to it.
    const last = sorted[sorted.length - 1]!;
    const end = slotMinuteOfWeek(last) + last.durationMin;
    return end > MINUTES_PER_WEEK && end - MINUTES_PER_WEEK > m
      ? sorted.length - 1
      : null;
  }

  const slot = sorted[candidate]!;
  return slotMinuteOfWeek(slot) + slot.durationMin > m ? candidate : null;
}

/** The grid slot on air at `now`, ignoring dated overrides. */
export function gridSlotAt(slots: GridSlot[], now: Date): GridSlot | null {
  const sorted = sortGrid(slots);
  const idx = slotIndexAt(sorted, zonedMinuteOfWeek(now));
  return idx === null ? null : sorted[idx]!;
}

/** The grid slot after the one on air, wrapping Sunday into Monday. */
export function gridSlotAfter(slots: GridSlot[], now: Date): GridSlot | null {
  const sorted = sortGrid(slots);
  if (sorted.length === 0) return null;
  const mow = zonedMinuteOfWeek(now);
  const idx = slotIndexAt(sorted, mow);

  if (idx !== null) return sorted[(idx + 1) % sorted.length]!;

  // Inside a gap: the next slot is the first one starting after now, else the
  // week's first slot.
  const next = sorted.find((s) => slotMinuteOfWeek(s) > mow);
  return next ?? sorted[0]!;
}

/* ── Materialising the grid onto real dates ─────────────────────────────── */

/** `FIST OF FURY 25 \ VGA SHOW` → `["FIST OF FURY 25", "VGA SHOW"]`. */
export function splitTitle(raw: string): [string, string] {
  const idx = raw.indexOf("\\");
  if (idx === -1) return [raw.trim(), ""];
  return [raw.slice(0, idx).trim(), raw.slice(idx + 1).trim()];
}

/**
 * Collapse consecutive slots carrying the same programme into one block.
 *
 * The source grid is hour-ruled, so a two-hour show is two rows with identical
 * titles. Rendered literally that looks like a duplication bug — "NoBoneZ,
 * NoBoneZ, MPRO, MPRO" down the listings — and the on-air bug ends up saying a
 * show is up next when it is simply still on. Broadcast EPGs merge these.
 */
export function mergeAdjacent(entries: ScheduleEntry[]): ScheduleEntry[] {
  const out: ScheduleEntry[] = [];
  for (const entry of entries) {
    const prev = out[out.length - 1];
    const continues =
      prev &&
      prev.source === entry.source &&
      prev.title === entry.title &&
      prev.subtitle === entry.subtitle &&
      prev.pillar === entry.pillar &&
      prev.endsAt === entry.startsAt;

    if (!continues) {
      out.push({ ...entry });
      continue;
    }

    prev.endsAt = entry.endsAt;
    prev.endLabel = entry.endLabel;
    prev.durationMin += entry.durationMin;
    prev.isLive = prev.isLive || entry.isLive;
    // The merged block keeps the stricter rating of its parts.
    if (entry.parentalRating !== null) {
      prev.parentalRating =
        prev.parentalRating === null
          ? entry.parentalRating
          : Math.max(prev.parentalRating, entry.parentalRating);
    }
  }
  return out;
}

/**
 * Turn the weekday grid into dated entries for one calendar day in the channel
 * timezone. `dateKey` is `YYYY-MM-DD` as the *channel* reads it, not UTC.
 *
 * Consecutive slots carrying the same programme are merged into one block.
 */
export function materializeDay(
  slots: GridSlot[],
  dateKey: string,
  now: Date,
): ScheduleEntry[] {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const dow = zonedDayOfWeek(zonedToUtc(y, m, d, 12 * 60));

  const entries = sortGrid(slots.filter((s) => s.dayOfWeek === dow)).map((slot) => {
    const startsAt = zonedToUtc(y, m, d, slot.startMinute);
    const endsAt = new Date(startsAt.getTime() + slot.durationMin * 60_000);
    const [title, subtitle] = splitTitle(slot.title);
    return {
      source: "grid" as const,
      id: slot.id,
      title,
      subtitle,
      pillar: slot.pillar,
      parentalRating: slot.parentalRating,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      startLabel: minuteLabel(slot.startMinute),
      endLabel: minuteLabel(slot.startMinute + slot.durationMin),
      durationMin: slot.durationMin,
      watchUrl: null,
      thumbnailUrl: null,
      isLive: startsAt <= now && now < endsAt,
    };
  });

  return mergeAdjacent(entries);
}

/**
 * Overlay dated rows on a day's grid. A dated row replaces every grid entry
 * whose window it overlaps, which is what makes a scheduled stream win over the
 * rotation without anything having to be deleted or regenerated.
 */
export function applyOverrides(
  gridEntries: ScheduleEntry[],
  dated: DatedEntry[],
  now: Date,
): ScheduleEntry[] {
  if (dated.length === 0) return gridEntries;

  const overrides: ScheduleEntry[] = dated.map((row) => {
    const startsAt = new Date(row.airsAt);
    const endsAt = new Date(startsAt.getTime() + row.durationMin * 60_000);
    return {
      source: "override" as const,
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      pillar: row.pillar,
      parentalRating: null,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      startLabel: minuteLabel(zonedMinuteOfWeek(startsAt) % MINUTES_PER_DAY),
      endLabel: minuteLabel(zonedMinuteOfWeek(endsAt) % MINUTES_PER_DAY),
      durationMin: row.durationMin,
      watchUrl: row.watchUrl,
      thumbnailUrl: row.thumbnailUrl || null,
      isLive: row.isLive || (startsAt <= now && now < endsAt),
    };
  });

  const survives = (entry: ScheduleEntry) =>
    !overrides.some(
      (o) => o.startsAt < entry.endsAt && entry.startsAt < o.endsAt,
    );

  return [...gridEntries.filter(survives), ...overrides].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  );
}

/** The entry on air at `now` within an already-merged day. */
export function entryOnAir(entries: ScheduleEntry[], now: Date): ScheduleEntry | null {
  const iso = now.toISOString();
  return entries.find((e) => e.startsAt <= iso && iso < e.endsAt) ?? null;
}
