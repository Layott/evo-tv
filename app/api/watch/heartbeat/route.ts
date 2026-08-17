import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";

/**
 * POST /api/watch/heartbeat
 *
 * The player calls this every few seconds with where it is in the video. It
 * writes one row per percent of the video reached, so the admin analytics page
 * can draw an audience retention curve and compute real watch time.
 *
 * Deliberately cheap and deliberately lossy:
 *
 * - No read before write. The primary key is (video, session, bucket) and the
 *   insert is `on conflict do nothing`, so a beat landing in a percent already
 *   recorded is a no-op in one round trip rather than a select plus an insert.
 * - Signed out still counts, keyed by the session id the player generates. A
 *   view is a view; requiring an account would undercount the public catalogue
 *   badly and make the numbers useless for deciding what to commission.
 * - Never fails the player. Analytics must not be able to interrupt playback,
 *   so an error here is swallowed and reported as accepted.
 */

const bodySchema = z.object({
  videoType: z.enum(["vod", "episode"]),
  videoId: z.string().min(1).max(128),
  /** Generated per playback by the client; not an account identifier. */
  sessionId: z.string().min(8).max(64),
  positionSec: z.number().finite().min(0),
  durationSec: z.number().finite().positive(),
});

/** Coarse enough to be a useful cut, coarse enough not to identify anybody. */
function deviceFrom(ua: string): string {
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobi|android|iphone/.test(s)) return "mobile";
  if (/smart-?tv|smarttv|appletv|googletv|hbbtv|netcast|webos|tizen/.test(s)) return "tv";
  if (!s) return "";
  return "desktop";
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { videoType, videoId, sessionId, positionSec, durationSec } = parsed.data;

  // A position past the end is a seek artefact or a clock the player got wrong,
  // not somebody watching 140% of a video.
  const ratio = Math.min(positionSec / durationSec, 1);
  const bucket = Math.min(99, Math.max(0, Math.floor(ratio * 100)));

  const user = await getCurrentUser();

  // Cloudflare gives the country on the request; there is nowhere else to get
  // it without asking the viewer, and it stays a two-letter code.
  const country = (req.headers.get("cf-ipcountry") ?? "").slice(0, 2).toUpperCase();
  const device = deviceFrom(req.headers.get("user-agent") ?? "");

  try {
    await db
      .insert(schema.videoViewBuckets)
      .values({
        videoType,
        videoId,
        sessionId,
        bucket,
        userId: user?.id ?? null,
        country: country === "XX" ? "" : country,
        device,
      })
      .onConflictDoNothing();
  } catch {
    // Swallowed on purpose: see the note above. A viewer must never see a
    // playback error because an analytics write failed.
  }

  return new NextResponse(null, { status: 204 });
}
