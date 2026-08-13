import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The claim this file exists to test: a browser left alone for three hours is
 * signed out, and nothing else is.
 *
 * It is worth pinning because both halves fail silently. If the cookie format
 * assumption breaks, no session is ever found and the window simply stops
 * existing, with no error anywhere. If the bearer exemption breaks, the app
 * starts signing people out every three hours, which looks like a backend fault
 * rather than a rule.
 *
 * The database is mocked rather than run: the decision under test is "is this
 * row old enough", which needs no Postgres, and the round trip is already
 * covered by hand against a real server (see docs/HANDOVER-2026-08-13.md).
 */

const state = vi.hoisted(() => ({
  row: null as null | { id: string; expiresAt: Date; updatedAt: Date },
  selects: 0,
  deletes: 0,
}));

vi.mock("@/lib/db", async () => {
  const schema = await import("@/db/schema");
  return {
    schema,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              state.selects += 1;
              return state.row ? [state.row] : [];
            },
          }),
        }),
      }),
      delete: () => ({
        where: async () => {
          state.deletes += 1;
        },
      }),
    },
  };
});

const {
  SESSION_MAX_AGE_SEC,
  WEB_IDLE_WINDOW_SEC,
  isBearerRequest,
  revokeIdleWebSession,
  sessionTokenFromCookie,
} = await import("@/lib/auth/idle");

const MAX_AGE_MS = SESSION_MAX_AGE_SEC * 1000;
const TOKEN = "bAvvLm7OI7Zq6w8xP38dyXHGHR5b2MDe";

/** A session row as Better-Auth leaves it `agoSec` seconds after last use. */
function rowLastUsed(agoSec: number) {
  const lastUsed = Date.now() - agoSec * 1000;
  return {
    id: "sess_1",
    updatedAt: new Date(lastUsed),
    // Better-Auth sets this to now + max age on every slide, so a session last
    // used `agoSec` ago expires that far into the future.
    expiresAt: new Date(lastUsed + MAX_AGE_MS),
  };
}

function cookieHeaders(cookie: string, extra: Record<string, string> = {}) {
  return new Headers({ cookie, ...extra });
}

beforeEach(() => {
  state.row = null;
  state.selects = 0;
  state.deletes = 0;
});

describe("sessionTokenFromCookie", () => {
  it("takes the token from in front of Better-Auth's signature", () => {
    // Exactly the value observed on the wire, signature and all.
    const headers = cookieHeaders(
      `evotv.session_token=${TOKEN}.CuY3HWiR3iaJFre5UdEfuTKCEyYkGTPAi4k2BwwSPb8%3D`,
    );
    expect(sessionTokenFromCookie(headers)).toBe(TOKEN);
  });

  it("reads the __Secure- prefixed name production sets", () => {
    const headers = cookieHeaders(`__Secure-evotv.session_token=${TOKEN}.sig`);
    expect(sessionTokenFromCookie(headers)).toBe(TOKEN);
  });

  it("finds it among the other cookies a real request carries", () => {
    const headers = cookieHeaders(
      `evotv_role=admin; evotv.session_data=abc.def; evotv.session_token=${TOKEN}.sig; other=1`,
    );
    expect(sessionTokenFromCookie(headers)).toBe(TOKEN);
  });

  it("does not mistake the session cache cookie for the token", () => {
    const headers = cookieHeaders("evotv.session_data=eyJzZXNzaW9uIjp7fX0.sig");
    expect(sessionTokenFromCookie(headers)).toBeNull();
  });

  it("returns null when there is no cookie at all", () => {
    expect(sessionTokenFromCookie(new Headers())).toBeNull();
  });
});

describe("revokeIdleWebSession", () => {
  it("leaves a session that was used inside the window", async () => {
    state.row = rowLastUsed(WEB_IDLE_WINDOW_SEC - 600); // 10 min to spare
    const revoked = await revokeIdleWebSession(
      cookieHeaders(`evotv.session_token=${TOKEN}.sig`),
    );
    expect(revoked).toBe(false);
    expect(state.deletes).toBe(0);
  });

  it("deletes a session idle past the window", async () => {
    state.row = rowLastUsed(WEB_IDLE_WINDOW_SEC + 600); // 10 min over
    const revoked = await revokeIdleWebSession(
      cookieHeaders(`evotv.session_token=${TOKEN}.sig`),
    );
    expect(revoked).toBe(true);
    expect(state.deletes).toBe(1);
  });

  it("exempts the app, which authenticates with a bearer token", async () => {
    // Same stale session. The difference is only how it was presented.
    state.row = rowLastUsed(WEB_IDLE_WINDOW_SEC * 10);
    const revoked = await revokeIdleWebSession(
      cookieHeaders(`evotv.session_token=${TOKEN}.sig`, {
        authorization: `Bearer ${TOKEN}`,
      }),
    );
    expect(revoked).toBe(false);
    expect(state.deletes).toBe(0);
    // Not merely spared: never looked up.
    expect(state.selects).toBe(0);
  });

  it("does nothing for a caller with no session cookie", async () => {
    const revoked = await revokeIdleWebSession(new Headers());
    expect(revoked).toBe(false);
    expect(state.selects).toBe(0);
  });

  it("does nothing when the token matches no row", async () => {
    state.row = null;
    const revoked = await revokeIdleWebSession(
      cookieHeaders(`evotv.session_token=${TOKEN}.sig`),
    );
    expect(revoked).toBe(false);
    expect(state.deletes).toBe(0);
  });

  it("believes whichever column says the session was used more recently", async () => {
    // `updated_at` stale, `expires_at` fresh. Taking the later of the two is
    // what stops a change in adapter behaviour from signing out active people.
    const stale = rowLastUsed(WEB_IDLE_WINDOW_SEC * 2);
    state.row = {
      ...stale,
      expiresAt: new Date(Date.now() + MAX_AGE_MS),
    };
    const revoked = await revokeIdleWebSession(
      cookieHeaders(`evotv.session_token=${TOKEN}.sig`),
    );
    expect(revoked).toBe(false);
    expect(state.deletes).toBe(0);
  });

  it("keeps the window under the life of the row it is narrowing", () => {
    expect(WEB_IDLE_WINDOW_SEC).toBeLessThan(SESSION_MAX_AGE_SEC);
  });
});

describe("isBearerRequest", () => {
  it("is true only for a bearer scheme", () => {
    expect(isBearerRequest(new Headers({ authorization: "Bearer x" }))).toBe(true);
    expect(isBearerRequest(new Headers({ authorization: "Basic x" }))).toBe(false);
    expect(isBearerRequest(new Headers())).toBe(false);
  });
});
