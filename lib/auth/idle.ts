import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Idle timeout for browser sessions.
 *
 * A session row lives for `SESSION_MAX_AGE_SEC` and slides forward every time
 * it is used, so the row alone cannot express "signed out after three quiet
 * hours". This module adds that window, and adds it for browsers only.
 *
 * Why browsers only: a lot of the audience signs in from a shared laptop or a
 * cybercafe machine, where a session left open is somebody else's account. A
 * phone is not that. Killing a phone session every three hours would mean
 * retyping a password several times a day for no safety gained, so the app
 * keeps its long session and locks the screen behind fingerprint or face
 * instead. Cookie = browser, bearer token = app, which is the split used here.
 */

/** How long a session row survives. Slides forward while it is in use. */
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

/**
 * How often a request slides the session forward.
 *
 * This is also the resolution of the idle clock below: a browser session dies
 * somewhere between `WEB_IDLE_WINDOW_SEC - SESSION_UPDATE_AGE_SEC` and
 * `WEB_IDLE_WINDOW_SEC` after the last request. Five minutes of slack on three
 * hours is invisible to a viewer and costs one write per five active minutes.
 */
export const SESSION_UPDATE_AGE_SEC = 60 * 5;

/** Quiet time after which a browser has to sign in again. */
export const WEB_IDLE_WINDOW_SEC = 60 * 60 * 3;

const IDLE_MS = WEB_IDLE_WINDOW_SEC * 1000;
const MAX_AGE_MS = SESSION_MAX_AGE_SEC * 1000;

/** The app authenticates with a bearer token and is exempt. */
export function isBearerRequest(headers: Headers): boolean {
  return (headers.get("authorization") ?? "").startsWith("Bearer ");
}

/**
 * Better-Auth writes the session token into `<prefix>.session_token`, and
 * signs it, so the cookie value is `<token>.<signature>`. The token itself
 * carries no dot, so everything before the first one is the token.
 *
 * Exported only so a test can hold it to that claim. It is the one assumption
 * here about somebody else's internals, and if a Better-Auth upgrade changes
 * the cookie format this stops finding sessions and the idle window silently
 * never fires again.
 */
export function sessionTokenFromCookie(headers: Headers): string | null {
  const raw = headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name !== "evotv.session_token" && name !== "__Secure-evotv.session_token") {
      continue;
    }
    const value = decodeURIComponent(part.slice(eq + 1).trim());
    const token = value.split(".")[0];
    return token.length > 0 ? token : null;
  }
  return null;
}

/**
 * When the session was last used.
 *
 * Read two ways and the later one wins. `updated_at` is the direct answer, but
 * it is written by the adapter rather than by us; `expires_at` is set to
 * `now + SESSION_MAX_AGE_SEC` on every slide, so subtracting the max age
 * recovers the same instant independently. Taking the later of the two means a
 * change in either behaviour can only ever keep a live session alive, never
 * sign out somebody who was active.
 */
function lastUsedMs(row: { expiresAt: Date; updatedAt: Date }): number {
  return Math.max(row.updatedAt.getTime(), row.expiresAt.getTime() - MAX_AGE_MS);
}

/**
 * Delete the caller's session if it has been idle past the window.
 *
 * Runs before Better-Auth reads the same row, deliberately. Better-Auth slides
 * the session as a side effect of reading it, so a check made on the session
 * it hands back would be looking at a timestamp it had just refreshed, and
 * would never fire.
 *
 * Returns true when a session was revoked, so callers can say why.
 */
export async function revokeIdleWebSession(headers: Headers): Promise<boolean> {
  if (isBearerRequest(headers)) return false;

  const token = sessionTokenFromCookie(headers);
  if (!token) return false;

  const row = (
    await db
      .select({
        id: schema.session.id,
        expiresAt: schema.session.expiresAt,
        updatedAt: schema.session.updatedAt,
      })
      .from(schema.session)
      .where(eq(schema.session.token, token))
      .limit(1)
  )[0];
  if (!row) return false;

  if (Date.now() - lastUsedMs(row) < IDLE_MS) return false;

  await db.delete(schema.session).where(eq(schema.session.id, row.id));
  return true;
}
