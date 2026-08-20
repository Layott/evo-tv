import { describe, expect, it, vi, beforeEach } from "vitest";

import { endOtherSessions } from "@/lib/auth/one-device";

/**
 * The rule is small and the cost of getting it wrong is not: delete the wrong
 * row and the person signing in is signed out of the session they just created.
 */

const state = {
  enabled: true as boolean,
  deleted: [] as { userId: string; keep: string }[],
};

vi.mock("server-only", () => ({}));

vi.mock("@/lib/api/flags", () => ({
  isFlagEnabled: async (_key: string, fallback: boolean) => state.enabled ?? fallback,
}));

vi.mock("@/lib/db", () => {
  const rows = [{ id: "s_old_1" }, { id: "s_old_2" }];
  return {
    schema: { session: { userId: "user_id", id: "id" } },
    db: {
      delete: () => ({
        where: (clause: { userId: string; keep: string }) => ({
          returning: async () => {
            state.deleted.push(clause);
            return rows;
          },
        }),
      }),
    },
  };
});

vi.mock("drizzle-orm", () => ({
  and: (...parts: unknown[]) => Object.assign({}, ...(parts as object[])),
  eq: (_col: unknown, value: string) => ({ userId: value }),
  ne: (_col: unknown, value: string) => ({ keep: value }),
}));


describe("endOtherSessions", () => {
  beforeEach(() => {
    state.deleted = [];
    state.enabled = true;
  });

  it("removes the other sessions and keeps the new one", async () => {
    const count = await endOtherSessions("user_1", "s_new");
    expect(count).toBe(2);
    expect(state.deleted).toEqual([{ userId: "user_1", keep: "s_new" }]);
  });

  it("does nothing when an operator has switched it off", async () => {
    state.enabled = false;
    const count = await endOtherSessions("user_1", "s_new");
    expect(count).toBe(0);
    expect(state.deleted).toEqual([]);
  });
});
