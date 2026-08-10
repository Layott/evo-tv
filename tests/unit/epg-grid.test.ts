import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  applyOverrides,
  entryOnAir,
  gridSlotAfter,
  gridSlotAt,
  materializeDay,
  minuteLabel,
  splitTitle,
  zonedDateKey,
  zonedDayOfWeek,
  zonedMinuteOfWeek,
  zonedToUtc,
  type DatedEntry,
  type GridSlot,
} from "@/lib/epg/grid";
import { assertCoversWeek, parseGridCsv } from "@/scripts/import-epg";

/**
 * Africa/Lagos is UTC+1 year round, so every Lagos wall-clock time below is
 * written as its UTC instant minus one hour. 2024-01-01 was a Monday, which
 * makes the ISO weekday arithmetic checkable by eye.
 */
const lagos = (iso: string) => new Date(iso);

function slot(
  dayOfWeek: number,
  startMinute: number,
  durationMin: number,
  title: string,
): GridSlot {
  return {
    id: `s_${dayOfWeek}_${startMinute}`,
    dayOfWeek,
    startMinute,
    durationMin,
    title,
    pillar: "esports",
    parentalRating: 16,
    slotCode: null,
  };
}

/** A minimal week: one slot per hour on Monday, plus the Sunday 23:00 tail. */
const WEEK: GridSlot[] = [
  slot(1, 0, 60, "Monday midnight"),
  slot(1, 19 * 60, 60, "EAFC"),
  slot(1, 20 * 60, 60, "THE MOTHERLAND GAMING \\ APEX LEGENDS"),
  slot(7, 22 * 60, 60, "Sunday ten"),
  slot(7, 23 * 60, 60, "Sunday eleven"),
];

describe("zone primitives", () => {
  it("reads Lagos wall-clock one hour ahead of UTC", () => {
    // 2024-01-01T18:30Z is 19:30 in Lagos, still Monday.
    const at = lagos("2024-01-01T18:30:00.000Z");
    expect(zonedDayOfWeek(at)).toBe(1);
    expect(zonedDateKey(at)).toBe("2024-01-01");
    expect(zonedMinuteOfWeek(at)).toBe(19 * 60 + 30);
  });

  it("rolls the date forward when UTC is still on the previous day", () => {
    // 23:30Z on Sunday is already 00:30 Monday in Lagos.
    const at = lagos("2024-01-07T23:30:00.000Z");
    expect(zonedDateKey(at)).toBe("2024-01-08");
    expect(zonedDayOfWeek(at)).toBe(1);
    expect(zonedMinuteOfWeek(at)).toBe(30);
  });

  it("round-trips a wall-clock time back to its UTC instant", () => {
    expect(zonedToUtc(2024, 1, 1, 19 * 60).toISOString()).toBe(
      "2024-01-01T18:00:00.000Z",
    );
    expect(zonedToUtc(2024, 1, 1, 0).toISOString()).toBe(
      "2023-12-31T23:00:00.000Z",
    );
  });

  it("renders minute-of-day labels, wrapping 1440 to 00:00", () => {
    expect(minuteLabel(0)).toBe("00:00");
    expect(minuteLabel(19 * 60)).toBe("19:00");
    expect(minuteLabel(23 * 60 + 5)).toBe("23:05");
    expect(minuteLabel(1440)).toBe("00:00");
  });
});

describe("nowPlaying", () => {
  it("finds the slot mid-way through", () => {
    const at = lagos("2024-01-01T18:30:00.000Z"); // Mon 19:30 Lagos
    expect(gridSlotAt(WEEK, at)?.title).toBe("EAFC");
  });

  it("treats the start boundary as inside the slot", () => {
    const at = lagos("2024-01-01T18:00:00.000Z"); // Mon 19:00:00 exactly
    expect(gridSlotAt(WEEK, at)?.title).toBe("EAFC");
  });

  it("treats the end boundary as the next slot, not this one", () => {
    const at = lagos("2024-01-01T19:00:00.000Z"); // Mon 20:00:00 exactly
    expect(gridSlotAt(WEEK, at)?.title).toBe(
      "THE MOTHERLAND GAMING \\ APEX LEGENDS",
    );
  });

  it("resolves the 23:00 slot", () => {
    const at = lagos("2024-01-07T22:15:00.000Z"); // Sun 23:15 Lagos
    expect(gridSlotAt(WEEK, at)?.title).toBe("Sunday eleven");
  });

  it("returns null inside a gap rather than guessing", () => {
    const at = lagos("2024-01-01T09:00:00.000Z"); // Mon 10:00, unprogrammed
    expect(gridSlotAt(WEEK, at)).toBeNull();
  });
});

describe("upNext", () => {
  it("hands over from Sunday 23:00 to the first slot of Monday", () => {
    const at = lagos("2024-01-07T22:30:00.000Z"); // Sun 23:30 Lagos
    expect(gridSlotAt(WEEK, at)?.title).toBe("Sunday eleven");
    expect(gridSlotAfter(WEEK, at)?.title).toBe("Monday midnight");
  });

  it("returns the following slot mid-week", () => {
    const at = lagos("2024-01-01T18:30:00.000Z");
    expect(gridSlotAfter(WEEK, at)?.title).toBe(
      "THE MOTHERLAND GAMING \\ APEX LEGENDS",
    );
  });

  it("picks the next start when now falls in a gap", () => {
    const at = lagos("2024-01-01T09:00:00.000Z"); // Mon 10:00
    expect(gridSlotAfter(WEEK, at)?.title).toBe("EAFC");
  });
});

describe("materializeDay", () => {
  it("dates the weekday grid onto a concrete Lagos day", () => {
    const now = lagos("2024-01-01T18:30:00.000Z");
    const entries = materializeDay(WEEK, "2024-01-01", now);

    expect(entries.map((e) => e.title)).toEqual([
      "Monday midnight",
      "EAFC",
      "THE MOTHERLAND GAMING",
    ]);
    expect(entries[1]!.startsAt).toBe("2024-01-01T18:00:00.000Z");
    expect(entries[1]!.endsAt).toBe("2024-01-01T19:00:00.000Z");
    expect(entries[1]!.startLabel).toBe("19:00");
    expect(entries[1]!.endLabel).toBe("20:00");
    expect(entries[1]!.isLive).toBe(true);
    expect(entries[0]!.isLive).toBe(false);
  });

  it("splits a compound slot title into title and subtitle", () => {
    expect(splitTitle("FIST OF FURY 25 \\ VGA SHOW")).toEqual([
      "FIST OF FURY 25",
      "VGA SHOW",
    ]);
    expect(splitTitle("EAFC")).toEqual(["EAFC", ""]);
  });

  it("labels the final slot of the day as ending at 00:00", () => {
    const tail = [slot(1, 23 * 60, 60, "Late")];
    const entries = materializeDay(tail, "2024-01-01", lagos("2024-01-01T12:00:00.000Z"));
    expect(entries[0]!.startLabel).toBe("23:00");
    expect(entries[0]!.endLabel).toBe("00:00");
  });
});

describe("dated overrides", () => {
  const now = lagos("2024-01-01T18:30:00.000Z");

  const override: DatedEntry = {
    id: "stream_1",
    title: "MPRO LEAGUE GRAND FINAL",
    subtitle: "live from Lagos",
    pillar: "esports",
    airsAt: "2024-01-01T18:00:00.000Z", // Mon 19:00 Lagos, exactly over EAFC
    durationMin: 60,
    watchUrl: "/stream/1",
    thumbnailUrl: "",
    isLive: true,
  };

  it("replaces the grid slot it overlaps", () => {
    const merged = applyOverrides(materializeDay(WEEK, "2024-01-01", now), [override], now);
    const titles = merged.map((e) => e.title);
    expect(titles).toContain("MPRO LEAGUE GRAND FINAL");
    expect(titles).not.toContain("EAFC");
    // Slots it does not touch survive.
    expect(titles).toContain("Monday midnight");
    expect(titles).toContain("THE MOTHERLAND GAMING");
  });

  it("removes every slot a long override spans, not just the first", () => {
    const long = { ...override, durationMin: 120 };
    const merged = applyOverrides(materializeDay(WEEK, "2024-01-01", now), [long], now);
    const titles = merged.map((e) => e.title);
    expect(titles).not.toContain("EAFC");
    expect(titles).not.toContain("THE MOTHERLAND GAMING");
    expect(titles).toContain("Monday midnight");
  });

  it("leaves the grid untouched when nothing overlaps", () => {
    const elsewhere = { ...override, airsAt: "2024-01-01T05:00:00.000Z" };
    const merged = applyOverrides(materializeDay(WEEK, "2024-01-01", now), [elsewhere], now);
    expect(merged.map((e) => e.title)).toContain("EAFC");
  });

  it("keeps the merged day sorted and answers what is on air", () => {
    const merged = applyOverrides(materializeDay(WEEK, "2024-01-01", now), [override], now);
    const starts = merged.map((e) => e.startsAt);
    expect([...starts].sort()).toEqual(starts);
    expect(entryOnAir(merged, now)?.title).toBe("MPRO LEAGUE GRAND FINAL");
  });
});

describe("the committed April grid", () => {
  const csv = readFileSync(
    path.join(process.cwd(), "db", "epg", "week-1.csv"),
    "utf8",
  );
  const slots = parseGridCsv(csv);

  it("holds exactly 168 slots, 24 per weekday", () => {
    expect(slots).toHaveLength(168);
    for (let day = 1; day <= 7; day++) {
      expect(slots.filter((s) => s.dayOfWeek === day)).toHaveLength(24);
    }
  });

  it("covers every minute of every day with no gaps and no overlaps", () => {
    expect(() => assertCoversWeek(slots)).not.toThrow();
  });

  it("strips the decorative emoji the source spreadsheet carries", () => {
    expect(slots.some((s) => s.title.startsWith("NoBoneZ"))).toBe(true);
    expect(slots.every((s) => /^[\p{L}\p{N}]/u.test(s.title))).toBe(true);
  });

  it("assigns every slot a pillar", () => {
    expect(
      slots.every((s) => ["esports", "anime", "lifestyle"].includes(s.pillar)),
    ).toBe(true);
  });

  it("rejects a grid with a hole in it", () => {
    const holed = slots.filter((s) => !(s.dayOfWeek === 3 && s.startMinute === 600));
    expect(() => assertCoversWeek(holed)).toThrow(/gap/);
  });
});
