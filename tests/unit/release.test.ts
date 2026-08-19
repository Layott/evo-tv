import { describe, expect, it } from "vitest";

import { isReleased, untilLabel } from "@/lib/api/release";

/**
 * The claim: null means published, and a future date means not yet.
 *
 * Worth pinning because the old field looked like this and was not. Nothing
 * filtered on `published_at`; it only sorted, so a row dated next Friday was on
 * the site today and played today.
 */
describe("scheduled release", () => {
  it("treats no date as published, which is every existing row", () => {
    expect(isReleased(null)).toBe(true);
    expect(isReleased(undefined)).toBe(true);
  });

  it("hides a future date and shows a past one", () => {
    const inAnHour = new Date(Date.now() + 3_600_000).toISOString();
    const anHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    expect(isReleased(inAnHour)).toBe(false);
    expect(isReleased(anHourAgo)).toBe(true);
  });

  it("says how long in words a viewer would use, not to the second", () => {
    expect(untilLabel(new Date(Date.now() + 5 * 60_000).toISOString())).toBe(
      "in 5 minutes",
    );
    expect(untilLabel(new Date(Date.now() + 3 * 3_600_000).toISOString())).toBe(
      "in 3 hours",
    );
    expect(
      untilLabel(new Date(Date.now() + 2 * 24 * 3_600_000).toISOString()),
    ).toBe("in 2 days");
    // A moment that has already passed is not "in -1 minutes".
    expect(untilLabel(new Date(Date.now() - 60_000).toISOString())).toBe(
      "any moment",
    );
  });
});
