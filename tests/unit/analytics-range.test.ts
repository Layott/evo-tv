import { describe, expect, it } from "vitest";

import {
  daysInRange,
  isDayKey,
  MAX_RANGE_DAYS,
  resolveRange,
} from "@/lib/analytics/range";

/** 19 August 2026, 22:41 in Lagos, which is 21:41 UTC the same day. */
const NOW = Date.parse("2026-08-19T21:41:00.000Z");

describe("resolveRange", () => {
  it("counts a preset back from today, today included", () => {
    const r = resolveRange({ days: 7 }, NOW);
    expect(r.fromDay).toBe("2026-08-13");
    expect(r.toDay).toBe("2026-08-19");
    expect(r.days).toBe(7);
    expect(r.label).toBe("Last 7 days");
  });

  it("ends after today, so a view logged this evening is in range", () => {
    // The bug this replaces: a range ending at `now` dropped everything logged
    // later in the day, so the chart totalled less than the headline.
    const r = resolveRange({ days: 1 }, NOW);
    expect(r.since).toBe("2026-08-19T00:00:00.000Z");
    expect(r.until).toBe("2026-08-20T00:00:00.000Z");
    expect(r.label).toBe("Today");
  });

  it("reads a single day from `from` alone", () => {
    const r = resolveRange({ from: "2026-08-12" }, NOW);
    expect(r.days).toBe(1);
    expect(r.since).toBe("2026-08-12T00:00:00.000Z");
    expect(r.until).toBe("2026-08-13T00:00:00.000Z");
    expect(r.label).toBe("12 Aug 2026");
  });

  it("covers both ends of a window", () => {
    const r = resolveRange({ from: "2026-08-01", to: "2026-08-07" }, NOW);
    expect(r.days).toBe(7);
    expect(r.until).toBe("2026-08-08T00:00:00.000Z");
    expect(r.label).toBe("1 Aug 2026 to 7 Aug 2026");
  });

  it("treats a backwards window as a slip rather than an empty answer", () => {
    const r = resolveRange({ from: "2026-08-07", to: "2026-08-01" }, NOW);
    expect(r.fromDay).toBe("2026-08-01");
    expect(r.toDay).toBe("2026-08-07");
  });

  it("caps a window nobody meant to ask for", () => {
    const r = resolveRange({ from: "2020-01-01", to: "2026-08-19" }, NOW);
    expect(r.days).toBe(MAX_RANGE_DAYS);
    expect(r.fromDay).toBe("2020-01-01");
  });

  it("falls back to the preset when the dates are not dates", () => {
    const r = resolveRange({ days: 28, from: "last tuesday" }, NOW);
    expect(r.days).toBe(28);
    expect(r.toDay).toBe("2026-08-19");
  });

  it("is UTC, not the server's timezone", () => {
    // 00:30 in Lagos on the 20th is still the 19th in UTC, and the day keys
    // the buckets are grouped by are UTC.
    const lagosPastMidnight = Date.parse("2026-08-19T23:30:00.000Z");
    expect(resolveRange({ days: 1 }, lagosPastMidnight).toDay).toBe("2026-08-19");
  });
});

describe("daysInRange", () => {
  it("lists every day so a quiet day is a zero, not a gap", () => {
    const days = daysInRange(resolveRange({ from: "2026-08-01", to: "2026-08-04" }, NOW));
    expect(days).toEqual(["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04"]);
  });

  it("spans a month boundary", () => {
    const days = daysInRange(resolveRange({ from: "2026-07-30", to: "2026-08-02" }, NOW));
    expect(days).toEqual(["2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"]);
  });
});

describe("isDayKey", () => {
  it("accepts a real date and refuses digits that are not one", () => {
    expect(isDayKey("2026-08-19")).toBe(true);
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("2026-8-9")).toBe(false);
    expect(isDayKey("")).toBe(false);
    expect(isDayKey(20260819)).toBe(false);
  });
});
