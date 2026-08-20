import "server-only";
import crypto from "node:crypto";

/**
 * What a player is allowed to see, in the URL it was handed.
 *
 * The quality ladder is a cost decision: a 1080p viewer costs roughly seven
 * times a 360p one, and the ladder exists so free viewers are served cheaply
 * and paying ones are served properly. Marking a rung `premiumOnly` in
 * `lib/video/rungs.ts` only ever labelled the admin screen; nothing withheld
 * anything, because the player was handed nginx's master playlist directly and
 * nginx has no idea who is watching.
 *
 * So the master is served by us, per viewer. Which raises the question of how
 * the player proves who it is: the website can send its cookie, but the app's
 * native player is `expo-video` with a bare `{ uri }` and no way to attach a
 * bearer token to the manifest request.
 *
 * A ticket solves both. When the API hands out a playback URL it already knows
 * the viewer, so it mints a short-lived signed string saying only "this URL may
 * see HD" and appends it. No account id, no email, nothing that identifies a
 * person if the URL is shared or logged; the worst a leaked ticket does is let
 * somebody else watch in 720p for a few minutes, which is the same thing they
 * get by signing up for a trial.
 */

const SECRET = process.env.AUTH_SECRET ?? "dev_stream_key_secret";

/**
 * Forty-five minutes of validity, minted in ten-minute buckets.
 *
 * The bucket is the important half. Clients poll the stream endpoint every
 * thirty to sixty seconds, and a ticket minted from `Date.now()` would come
 * back different every time, which changes the player's `src` prop, which
 * reloads the video. A viewer would see the picture stutter once a minute
 * because of an access-control decision that had not changed.
 *
 * Bucketing means every mint inside the same ten minutes produces a byte-identical
 * string, so nothing downstream sees a change. The validity outruns the bucket
 * by enough that a ticket handed out at the end of one is still good well into
 * the next.
 */
const BUCKET_MS = 10 * 60 * 1000;
const TTL_MS = 45 * 60 * 1000;

export interface PlaybackTicket {
  /** Whether the premium rungs belong in this viewer's master playlist. */
  hd: boolean;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

/**
 * `<hd><expiry>.<signature>`, e.g. `1-1755712345678.9f2c...`.
 *
 * Deliberately not a JWT. There is one claim, it is a boolean, and a format
 * nobody can mistake for an identity token is a format nobody will be tempted
 * to start putting an identity in.
 */
export function mintPlaybackTicket(
  hd: boolean,
  now: number = Date.now(),
): string {
  const bucket = Math.floor(now / BUCKET_MS) * BUCKET_MS;
  const payload = `${hd ? "1" : "0"}-${bucket + TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Read a ticket, or refuse it.
 *
 * A missing, malformed, expired or badly signed ticket is not an error: it is
 * a viewer with no HD entitlement. Playback continues at the free rungs rather
 * than failing, because a manifest that 403s takes the channel off the air for
 * somebody whose only crime is a stale URL.
 */
export function readPlaybackTicket(
  raw: string | null | undefined,
  now: number = Date.now(),
): PlaybackTicket {
  if (!raw) return { hd: false };
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return { hd: false };

  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const expected = sign(payload);
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return { hd: false };
  }

  const [hd, expiry] = payload.split("-");
  if (!expiry || Number(expiry) < now) return { hd: false };
  return { hd: hd === "1" };
}
