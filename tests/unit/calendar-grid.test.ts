import { describe, expect, it } from "vitest";

import { zonedDateKey, zonedDayOfWeek, zonedToUtc } from "@/lib/epg/grid";

/**
 * The calendar was empty every month while the channel was on air, because the
 * endpoint answered with dated rows only and this platform schedules almost
 * nothing dated: it runs on the weekly grid. Laying the grid over the dates is
 * date arithmetic in the channel's timezone, which is exactly the kind of code
 * that is quietly an hour or a day out, so the arithmetic is pinned here.
 */

describe("laying the weekly grid over dates", () => {
  it("puts a Thursday slot on the Thursdays of the month", () => {
    // August 2026: the 6th, 13th, 20th and 27th are Thursdays in Lagos.
    const thursdays = [6, 13, 20, 27];
    for (const day of thursdays) {
      const at = zonedToUtc(2026, 8, day, 7 * 60);
      expect(zonedDayOfWeek(at), `Aug ${day}`).toBe(4);
    }
  });

  it("keeps a 07:00 Lagos slot on the same calendar day it belongs to", () => {
    // Lagos is UTC+1 with no DST, so 07:00 local is 06:00Z and the date key
    // must still read as the 20th rather than slipping to the 19th.
    const at = zonedToUtc(2026, 8, 20, 7 * 60);
    expect(at.toISOString()).toBe("2026-08-20T06:00:00.000Z");
    expect(zonedDateKey(at)).toBe("2026-08-20");
  });

  it("keeps a slot just after midnight on its own day", () => {
    // 00:30 Lagos is 23:30Z the previous day. A naive UTC date key would file
    // it under yesterday, which is how a schedule ends up an evening out.
    const at = zonedToUtc(2026, 8, 20, 30);
    expect(at.toISOString()).toBe("2026-08-19T23:30:00.000Z");
    expect(zonedDateKey(at)).toBe("2026-08-20");
  });

  it("walks a month of days without repeating or skipping one", () => {
    // The expansion steps a day at a time from the range start. Counting the
    // keys it produces is what catches an off-by-one at a month boundary.
    const start = Date.UTC(2026, 7, 1);
    const keys = new Set<string>();
    for (let i = 0; i < 31; i += 1) {
      keys.add(zonedDateKey(new Date(start + i * 86_400_000)));
    }
    expect(keys.size).toBe(31);
    expect(keys.has("2026-08-01")).toBe(true);
    expect(keys.has("2026-08-31")).toBe(true);
  });
});
