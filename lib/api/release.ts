import "server-only";
import { isNull, lte, or, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Released, or not yet.
 *
 * One rule, in one place, because it has to be asked in a dozen queries and a
 * list that forgets it is a leak: a viewer sees next week's episode in a rail,
 * clicks it, and either watches it early or gets an error. Both are worse than
 * not showing it.
 *
 * Null means released. That keeps every row written before this existed
 * exactly as it was, and makes scheduling something an editor opts into rather
 * than a state the table acquired overnight.
 */

/** The SQL half: `publish_at IS NULL OR publish_at <= now`. */
export function releasedCondition(column: PgColumn): SQL {
  return or(isNull(column), lte(column, new Date().toISOString()))!;
}

/** The JavaScript half, for rows already in hand. */
export function isReleased(at: string | null | undefined): boolean {
  if (!at) return true;
  return new Date(at).getTime() <= Date.now();
}

/**
 * How long until it lands, in the words a viewer would use.
 *
 * Deliberately coarse. A countdown to the second on something a week away is
 * a stopwatch, not information, and it forces a re-render every second on a
 * page nobody is watching for that reason.
 */
export function untilLabel(at: string): string {
  const ms = new Date(at).getTime() - Date.now();
  if (ms <= 0) return "any moment";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}
