import { describe, expect, it } from "vitest";

import {
  CAPABILITIES,
  capabilitiesFor,
  hasCapability,
  isStaffRole,
} from "@/lib/auth/capabilities";
import { RANK, type PlatformRole } from "@/lib/auth/role-catalog";

/**
 * The claim: a room is not inherited by rank.
 *
 * That is the entire reason capabilities exist beside the ladder. The ladder
 * says finance outranks moderation, which would hand a finance admin every
 * sanction power if rooms were rank-based, and hand a programmer the same for
 * being ranked above support.
 */
describe("rooms are not a ladder", () => {
  it("gives the two room roles exactly one room each", () => {
    expect(capabilitiesFor("programmer")).toEqual(["editorial"]);
    expect(capabilitiesFor("broadcast_op")).toEqual(["broadcast"]);
  });

  it("does not let a higher rank reach a lower rank's room", () => {
    // finance_admin outranks moderator on the ladder.
    expect(RANK.finance_admin).toBeGreaterThan(RANK.moderator);
    expect(hasCapability("finance_admin", "community")).toBe(false);
    // programmer outranks support_admin on the ladder.
    expect(RANK.programmer).toBeGreaterThan(RANK.support_admin);
    expect(hasCapability("programmer", "support")).toBe(false);
  });

  it("keeps a programmer out of the control room and off the books", () => {
    expect(hasCapability("programmer", "broadcast")).toBe(false);
    expect(hasCapability("programmer", "commerce")).toBe(false);
    expect(hasCapability("programmer", "roster")).toBe(false);
  });

  it("keeps a broadcast operator out of editorial", () => {
    expect(hasCapability("broadcast_op", "editorial")).toBe(false);
    expect(hasCapability("broadcast_op", "commerce")).toBe(false);
  });

  it("gives admin every room, so converting a route takes nothing away", () => {
    for (const room of [
      "editorial",
      "broadcast",
      "commerce",
      "community",
      "support",
      "roster",
    ] as const) {
      expect(hasCapability("admin", room)).toBe(true);
    }
  });

  it("reserves the full audit log for head admin", () => {
    expect(hasCapability("admin", "audit_full")).toBe(false);
    expect(hasCapability("head_admin", "audit_full")).toBe(true);
  });

  it("grants a viewer nothing, and an unknown role nothing", () => {
    expect(capabilitiesFor("user")).toEqual([]);
    expect(capabilitiesFor("premium")).toEqual([]);
    expect(capabilitiesFor("creator")).toEqual([]);
    // A typo must not be a promotion.
    expect(capabilitiesFor("adminn")).toEqual([]);
    expect(capabilitiesFor(null)).toEqual([]);
    expect(isStaffRole("user")).toBe(false);
    expect(isStaffRole("programmer")).toBe(true);
  });

  it("has an entry for every role, so a new one cannot be silently powerless", () => {
    for (const role of Object.keys(RANK) as PlatformRole[]) {
      expect(CAPABILITIES[role]).toBeDefined();
    }
  });
});
