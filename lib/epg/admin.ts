/**
 * Editing maths for the weekly grid.
 *
 * Split out of `grid.ts` because both sides of the CMS need it: the route
 * handler validates a write with these, and the `/admin/schedule` client
 * component warns about the same collisions before the write is sent. Pure and
 * free of `server-only` for exactly that reason.
 *
 * Everything is integer minutes. A slot is never converted to a Date here: the
 * channel is programmed in Lagos wall-clock time, and the moment this module
 * starts building Dates it acquires a timezone bug that only shows up as "the
 * schedule is an hour out".
 */

import { MINUTES_PER_DAY, MINUTES_PER_WEEK, minuteLabel } from "./grid";

/** Indexed by `dayOfWeek - 1`, so ISO Monday = 1 lands on "Monday". */
export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const DAY_SHORT_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek - 1] ?? `Day ${dayOfWeek}`;
}

/** The smallest slot an operator can programme. Nothing shorter is a programme. */
export const MIN_DURATION_MIN = 5;

/** Enough for a full day of continuous coverage, which is the honest ceiling. */
export const MAX_DURATION_MIN = MINUTES_PER_DAY;

/** The subset of an `epg_slots` row that collision checks care about. */
export interface SlotSpan {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  durationMin: number;
  title: string;
}

/**
 * `18:00` -> 1080. Returns null for anything that is not a 24-hour time, so a
 * caller can disable Save rather than write a silently wrong slot.
 *
 * `<input type="time">` always hands back `HH:MM` regardless of what the
 * browser displays, so the 12-hour case never reaches here, but a typed value
 * from a curl or a paste can.
 */
export function parseHhMm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function slotMinuteOfWeek(slot: {
  dayOfWeek: number;
  startMinute: number;
}): number {
  return (slot.dayOfWeek - 1) * MINUTES_PER_DAY + slot.startMinute;
}

/**
 * A slot as one or two half-open intervals in minute-of-week.
 *
 * Two when it runs past Sunday midnight: the tail belongs to the start of the
 * same repeating week, not to an eighth day. Ignoring that wrap is how a
 * Sunday 23:00 slot silently double-books Monday 00:00.
 */
function intervalsOf(slot: SlotSpan): Array<[number, number]> {
  const start = slotMinuteOfWeek(slot);
  const end = start + slot.durationMin;
  if (end <= MINUTES_PER_WEEK) return [[start, end]];
  return [
    [start, MINUTES_PER_WEEK],
    [0, end - MINUTES_PER_WEEK],
  ];
}

function intervalsIntersect(a: SlotSpan, b: SlotSpan): boolean {
  for (const [aStart, aEnd] of intervalsOf(a)) {
    for (const [bStart, bEnd] of intervalsOf(b)) {
      if (aStart < bEnd && bStart < aEnd) return true;
    }
  }
  return false;
}

/**
 * Every existing slot whose airtime the candidate would tread on.
 *
 * A slot with the same id is skipped, so an edit does not report itself. Note
 * this is a warning, never a block: back-to-back programming is normal and the
 * only thing the database refuses is two slots starting on the same minute.
 */
export function overlappingSlots(candidate: SlotSpan, existing: SlotSpan[]): SlotSpan[] {
  return existing.filter(
    (slot) => slot.id !== candidate.id && intervalsIntersect(candidate, slot),
  );
}

/** `Monday 18:00 to 19:00 MPRO LEAGUE`, for a warning an operator can act on. */
export function describeSlot(slot: SlotSpan): string {
  const end = minuteLabel(slot.startMinute + slot.durationMin);
  return `${dayName(slot.dayOfWeek)} ${minuteLabel(slot.startMinute)} to ${end} ${slot.title}`;
}

/** Human-readable warnings for a pending write, in operator language. */
export function overlapWarnings(candidate: SlotSpan, existing: SlotSpan[]): string[] {
  return overlappingSlots(candidate, existing).map(
    (slot) => `Overlaps ${describeSlot(slot)}`,
  );
}
