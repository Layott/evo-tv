/**
 * A show's price over time.
 *
 * Pure, so the admin editor can show "what a viewer pays on day 3" as it is
 * typed and the server can answer the same question without a second
 * implementation drifting from the first.
 *
 * A ladder of windows, each one saying "from this many days after release, this
 * is the price". Zero means free from that day on. The first window is day 0.
 */

export interface PriceWindow {
  /** Days after the show's release date. */
  fromDay: number;
  /** Whole naira. Zero is free. */
  priceNgn: number;
}

export const MAX_PRICE_WINDOWS = 8;

/** The price on a given day. Days before the first window use the first price. */
export function priceAtDay(windows: PriceWindow[], day: number): number {
  if (windows.length === 0) return 0;
  const sorted = [...windows].sort((a, b) => a.fromDay - b.fromDay);
  let price = sorted[0]!.priceNgn;
  for (const w of sorted) {
    if (day >= w.fromDay) price = w.priceNgn;
    else break;
  }
  return price;
}

/** The day it stops costing anything, or null if it never does. */
export function freeFromDay(windows: PriceWindow[]): number | null {
  const sorted = [...windows].sort((a, b) => a.fromDay - b.fromDay);
  const free = sorted.find((w) => w.priceNgn === 0 && w.fromDay > 0);
  return free ? free.fromDay : null;
}

/** `N800` for 80000 kobo-free naira. Whole numbers only; nothing here bills. */
export function formatPrice(priceNgn: number): string {
  if (priceNgn <= 0) return "Free";
  return `₦${priceNgn.toLocaleString("en-NG")}`;
}

/**
 * Problems an operator should see before saving, in the order they matter.
 *
 * Not thrown: a half-typed ladder is a normal state of a form, and the editor
 * shows these rather than refusing to render.
 */
export function priceWindowProblems(windows: PriceWindow[]): string[] {
  const problems: string[] = [];
  if (windows.length === 0) return problems;

  const sorted = [...windows].sort((a, b) => a.fromDay - b.fromDay);
  if (sorted[0]!.fromDay !== 0) {
    problems.push("The first window has to start on day 0, or a viewer on day one has no price.");
  }
  const seen = new Set<number>();
  for (const w of sorted) {
    if (seen.has(w.fromDay)) {
      problems.push(`Two windows both start on day ${w.fromDay}.`);
    }
    seen.add(w.fromDay);
    if (w.fromDay < 0) problems.push("A window cannot start before the show is released.");
    if (w.priceNgn < 0) problems.push("A price cannot be negative.");
  }
  const free = sorted.findIndex((w) => w.priceNgn === 0 && w.fromDay > 0);
  if (free !== -1 && free < sorted.length - 1) {
    problems.push(
      "Once a show is free it stays free: the windows after the free one would never apply.",
    );
  }
  return problems;
}
