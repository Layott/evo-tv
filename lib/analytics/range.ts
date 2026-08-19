/**
 * A window of days, resolved once, for every analytics reader.
 *
 * The screens offered four fixed presets and nothing else, so "how did the
 * premiere do on the night" could not be asked at all: the shortest answer
 * available was the last seven days with the premiere buried inside it.
 *
 * Pure and free of `server-only` on purpose. The route resolves a window to
 * query with it, and the screen resolves the same input to print what it is
 * looking at, so the two cannot disagree about which days are on screen.
 */

/** What a caller asks for: a preset number of days, or explicit dates. */
export interface RangeInput {
  /** Preset window, counting back from today. Ignored when `from` is given. */
  days?: number;
  /** First day on screen, `YYYY-MM-DD`, UTC. */
  from?: string;
  /** Last day on screen, inclusive, `YYYY-MM-DD`, UTC. Defaults to `from`. */
  to?: string;
}

export interface ResolvedRange {
  /** Inclusive start, ISO. */
  since: string;
  /** Exclusive end, ISO. A row dated exactly here belongs to the next window. */
  until: string;
  /** Days covered, inclusive of both ends. */
  days: number;
  /** First day key, `YYYY-MM-DD`. */
  fromDay: string;
  /** Last day key, inclusive, `YYYY-MM-DD`. */
  toDay: string;
  /** What the screen prints, so the header cannot drift from the query. */
  label: string;
}

export const MAX_RANGE_DAYS = 366;

const DAY_MS = 86_400_000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A day key is a real date, not merely digits in the right places. */
export function isDayKey(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_PATTERN.test(value)) return false;
  const t = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === value;
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function startOfDay(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "19 Aug 2026", which is how the rest of the dashboard writes a date. */
function readable(day: string): string {
  const [y, m, d] = day.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

/**
 * Everything is UTC, matching the day keys the buckets are grouped into.
 *
 * Snapping to local midnight shifts the whole series by the server's offset: in
 * Lagos every key landed a day early, today never appeared in the range, and
 * the chart totalled zero next to a headline reading 24. That was fixed once
 * for the preset path and the same rule applies here.
 */
export function resolveRange(input: RangeInput, now = Date.now()): ResolvedRange {
  const todayKey = dayKey(now);

  if (input.from && isDayKey(input.from)) {
    const toRaw = input.to && isDayKey(input.to) ? input.to : input.from;
    // A range dragged backwards is a slip, not an empty result.
    const [fromDay, toDay] =
      startOfDay(toRaw) < startOfDay(input.from)
        ? [toRaw, input.from]
        : [input.from, toRaw];

    const spanDays =
      Math.round((startOfDay(toDay) - startOfDay(fromDay)) / DAY_MS) + 1;
    const days = Math.min(MAX_RANGE_DAYS, spanDays);
    const endDay = days === spanDays ? toDay : dayKey(startOfDay(fromDay) + (days - 1) * DAY_MS);

    return {
      since: `${fromDay}T00:00:00.000Z`,
      until: new Date(startOfDay(endDay) + DAY_MS).toISOString(),
      days,
      fromDay,
      toDay: endDay,
      label:
        fromDay === endDay
          ? readable(fromDay)
          : `${readable(fromDay)} to ${readable(endDay)}`,
    };
  }

  const days = Math.max(
    1,
    Math.min(MAX_RANGE_DAYS, Math.trunc(input.days ?? 28)),
  );
  const endOfToday = startOfDay(todayKey) + DAY_MS;
  const fromDay = dayKey(startOfDay(todayKey) - (days - 1) * DAY_MS);

  return {
    since: `${fromDay}T00:00:00.000Z`,
    until: new Date(endOfToday).toISOString(),
    days,
    fromDay,
    toDay: todayKey,
    label: days === 1 ? "Today" : `Last ${days} days`,
  };
}

/** Every day key in the window, so a quiet day is a zero rather than a gap. */
export function daysInRange(range: ResolvedRange): string[] {
  const out: string[] = [];
  const start = startOfDay(range.fromDay);
  for (let i = 0; i < range.days; i++) out.push(dayKey(start + i * DAY_MS));
  return out;
}
