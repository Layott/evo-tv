import { describe, expect, it } from "vitest";
import {
  canGrantRole,
  canReadAuditLog,
  hasMinRole,
  isPlatformRole,
  RANK,
  roleRank,
} from "@/lib/auth/roles";

describe("roles RANK ordering", () => {
  it("is monotonically increasing across the ladder", () => {
    expect(RANK.guest).toBe(0);
    expect(RANK.guest).toBeLessThan(RANK.user);
    expect(RANK.user).toBeLessThan(RANK.premium);
    expect(RANK.premium).toBeLessThan(RANK.support_admin);
    expect(RANK.support_admin).toBeLessThan(RANK.moderator);
    expect(RANK.moderator).toBeLessThan(RANK.finance_admin);
    expect(RANK.finance_admin).toBeLessThan(RANK.admin);
    expect(RANK.admin).toBeLessThan(RANK.head_admin);
  });
});

describe("isPlatformRole", () => {
  it.each([
    "guest",
    "user",
    "premium",
    "support_admin",
    "moderator",
    "finance_admin",
    "admin",
    "head_admin",
  ])("accepts valid role %s", (r) => {
    expect(isPlatformRole(r)).toBe(true);
  });

  it.each(["", "owner", "ADMIN", null, undefined, 0, {}])(
    "rejects invalid input %p",
    (r) => {
      expect(isPlatformRole(r)).toBe(false);
    },
  );
});

describe("roleRank", () => {
  it("returns 0 for null/undefined/unknown", () => {
    expect(roleRank(null)).toBe(0);
    expect(roleRank(undefined)).toBe(0);
    expect(roleRank("nonsense")).toBe(0);
  });
  it("returns the configured rank for valid roles", () => {
    expect(roleRank("user")).toBe(RANK.user);
    expect(roleRank("admin")).toBe(RANK.admin);
    expect(roleRank("head_admin")).toBe(RANK.head_admin);
  });
});

describe("hasMinRole", () => {
  it("admin satisfies moderator requirement", () => {
    expect(hasMinRole("admin", "moderator")).toBe(true);
  });
  it("head_admin satisfies any lower role", () => {
    expect(hasMinRole("head_admin", "user")).toBe(true);
    expect(hasMinRole("head_admin", "admin")).toBe(true);
    expect(hasMinRole("head_admin", "head_admin")).toBe(true);
  });
  it("user does NOT satisfy moderator requirement", () => {
    expect(hasMinRole("user", "moderator")).toBe(false);
  });
  it("equal roles satisfy", () => {
    expect(hasMinRole("admin", "admin")).toBe(true);
  });
  it("null actor satisfies nothing above guest", () => {
    expect(hasMinRole(null, "user")).toBe(false);
    expect(hasMinRole(null, "guest")).toBe(true);
  });
});

describe("canGrantRole policy", () => {
  it("head_admin can grant any role", () => {
    expect(canGrantRole("head_admin", "user")).toBe(true);
    expect(canGrantRole("head_admin", "moderator")).toBe(true);
    expect(canGrantRole("head_admin", "admin")).toBe(true);
    expect(canGrantRole("head_admin", "head_admin")).toBe(true);
  });

  it("admin can grant moderator/finance_admin/support_admin/user/premium", () => {
    expect(canGrantRole("admin", "moderator")).toBe(true);
    expect(canGrantRole("admin", "finance_admin")).toBe(true);
    expect(canGrantRole("admin", "support_admin")).toBe(true);
    expect(canGrantRole("admin", "user")).toBe(true);
    expect(canGrantRole("admin", "premium")).toBe(true);
  });

  it("admin CANNOT grant admin or head_admin", () => {
    expect(canGrantRole("admin", "admin")).toBe(false);
    expect(canGrantRole("admin", "head_admin")).toBe(false);
  });

  it("moderator cannot grant any role", () => {
    expect(canGrantRole("moderator", "user")).toBe(false);
    expect(canGrantRole("moderator", "moderator")).toBe(false);
  });

  it("user cannot grant any role", () => {
    expect(canGrantRole("user", "user")).toBe(false);
  });

  it("null actor cannot grant", () => {
    expect(canGrantRole(null, "user")).toBe(false);
    expect(canGrantRole(undefined, "user")).toBe(false);
  });
});

describe("canReadAuditLog", () => {
  it("head_admin sees everything", () => {
    expect(canReadAuditLog("head_admin", "head_admin")).toBe(true);
    expect(canReadAuditLog("head_admin", "admin")).toBe(true);
    expect(canReadAuditLog("head_admin", null)).toBe(true);
  });
  it("admin sees everyone EXCEPT head_admin actions", () => {
    expect(canReadAuditLog("admin", "admin")).toBe(true);
    expect(canReadAuditLog("admin", "moderator")).toBe(true);
    expect(canReadAuditLog("admin", "head_admin")).toBe(false);
  });
  it("moderator + below cannot read audit log", () => {
    expect(canReadAuditLog("moderator")).toBe(false);
    expect(canReadAuditLog("user")).toBe(false);
    expect(canReadAuditLog(null)).toBe(false);
  });
});
