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
import { assertCoversWeek, overlay, parseGridCsv } from "@/scripts/import-epg";

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
    // A slot with no show and no subtitle of its own still has to render, and
    // the compound `A \ B` titles from the import are what these tests feed.
    subtitle: null,
    showTitle: null,
    pillar: "esports",
    parentalRating: 16,
    slotCode: null,
    // Unprogrammed by default: these tests are about the weekday and minute
    // arithmetic, and a slot with no show still has to render.
    showId: null,
    showSlug: null,
    showPosterUrl: null,
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

describe("merging consecutive slots", () => {
  const now = lagos("2024-01-01T12:00:00.000Z");

  it("collapses an hour-ruled block into one entry", () => {
    const block = [
      slot(1, 0, 60, "NoBoneZ"),
      slot(1, 60, 60, "NoBoneZ"),
      slot(1, 120, 60, "NoBoneZ"),
      slot(1, 180, 60, "EAFC"),
    ];
    const entries = materializeDay(block, "2024-01-01", now);

    expect(entries).toHaveLength(2);
    expect(entries[0]!.title).toBe("NoBoneZ");
    expect(entries[0]!.startLabel).toBe("00:00");
    expect(entries[0]!.endLabel).toBe("03:00");
    expect(entries[0]!.durationMin).toBe(180);
    expect(entries[1]!.title).toBe("EAFC");
  });

  it("does not merge across a different programme", () => {
    const block = [
      slot(1, 0, 60, "NoBoneZ"),
      slot(1, 60, 60, "EAFC"),
      slot(1, 120, 60, "NoBoneZ"),
    ];
    expect(materializeDay(block, "2024-01-01", now).map((e) => e.title)).toEqual([
      "NoBoneZ",
      "EAFC",
      "NoBoneZ",
    ]);
  });

  it("does not merge across a gap even when the title repeats", () => {
    const block = [slot(1, 0, 60, "NoBoneZ"), slot(1, 180, 60, "NoBoneZ")];
    expect(materializeDay(block, "2024-01-01", now)).toHaveLength(2);
  });

  it("keeps the block live when any part of it is on air", () => {
    const at = lagos("2024-01-01T01:30:00.000Z"); // Mon 02:30 Lagos
    const block = [
      slot(1, 0, 60, "NoBoneZ"),
      slot(1, 60, 60, "NoBoneZ"),
      slot(1, 120, 60, "NoBoneZ"),
    ];
    const entries = materializeDay(block, "2024-01-01", at);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.isLive).toBe(true);
  });

  it("carries the strictest rating of the merged parts", () => {
    const a = { ...slot(1, 0, 60, "NoBoneZ"), parentalRating: 16 };
    const b = { ...slot(1, 60, 60, "NoBoneZ"), parentalRating: 18 };
    const entries = materializeDay([a, b], "2024-01-01", now);
    expect(entries[0]!.parentalRating).toBe(18);
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

describe("the August originals overlay", () => {
  const base = parseGridCsv(
    readFileSync(path.join(process.cwd(), "db", "epg", "week-1.csv"), "utf8"),
  );
  const originals = parseGridCsv(
    readFileSync(
      path.join(process.cwd(), "db", "epg", "originals-august.csv"),
      "utf8",
    ),
  );
  const merged = overlay(base, originals);

  it("replaces slots rather than adding them, so the week still adds up", () => {
    expect(merged).toHaveLength(168);
    expect(() => assertCoversWeek(merged)).not.toThrow();
  });

  it("puts each original where the August calendar says it airs", () => {
    const at = (day: number, hour: number) =>
      merged.find((s) => s.dayOfWeek === day && s.startMinute === hour * 60)?.title;

    // Friday: "OTAKU & CHILLS - FRIDAY AFTERNOON", "HYP EVERY FRIDAY".
    expect(at(5, 15)).toBe("Otaku & Chillz");
    expect(at(5, 20)).toBe("Take a Seat: Confessionals");
    // Saturday: breakfast show in the morning, Elysium Wave in the evening.
    expect(at(6, 9)).toBe("Breakfast Show with Jeremiah");
    expect(at(6, 17)).toBe("Sucre's Space");
    expect(at(6, 20)).toBe("Elysium Wave");
    expect(at(6, 21)).toBe("Elysium Wave");
  });

  it("gives Otaku & Chillz the anime pillar and the rest lifestyle", () => {
    const pillarAt = (day: number, hour: number) =>
      merged.find((s) => s.dayOfWeek === day && s.startMinute === hour * 60)?.pillar;
    expect(pillarAt(5, 15)).toBe("anime");
    expect(pillarAt(5, 20)).toBe("lifestyle");
    expect(pillarAt(6, 20)).toBe("lifestyle");
  });

  it("refuses an overlay slot with no slot to replace", () => {
    const stray = [{ ...originals[0]!, dayOfWeek: 5, startMinute: 15 * 60 + 30 }];
    expect(() => overlay(base, stray)).toThrow(/no slot to replace/);
  });
});
