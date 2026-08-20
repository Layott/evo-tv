import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { getEntitlements } from "@/lib/api/entitlements";
import { filterMaster } from "@/lib/video/master-playlist";
import { readPlaybackTicket } from "@/lib/video/playback-ticket";

/**
 * GET /api/hls/[id]/master.m3u8
 *
 * The master playlist, served per viewer.
 *
 * nginx writes one master advertising every rung the encoder publishes, and it
 * has no idea who is asking, so `premiumOnly` on a rung was a label on an admin
 * screen and nothing more: any viewer could select 1080p. A 1080p viewer costs
 * roughly seven times a 360p one, which is the whole reason the ladder exists.
 *
 * So the manifest comes through here. Free viewers get 360p and 480p; 720p and
 * 1080p are for people who pay. The viewer's tier arrives as a signed ticket in
 * the URL the API handed out, because the app's native player cannot attach a
 * bearer token to a manifest request; a cookie or bearer works too, and is what
 * the website uses.
 *
 * The variant playlists and segments still come straight from nginx. Only the
 * master passes through this process, which is a few hundred bytes once per
 * viewer per session rather than a video stream through Node.
 */

export const dynamic = "force-dynamic";

/** How long a liveness probe is trusted. Short: rungs come and go mid-broadcast. */
const PROBE_TTL_MS = 10_000;
const probeCache = new Map<string, { at: number; publishing: Set<string> }>();

/**
 * Which advertised rungs are actually serving.
 *
 * Production advertises `_fhd` whether or not the encoder sends it, and a
 * player that picks an advertised rung with nothing behind it sits on a black
 * screen instead of falling back. One HEAD per variant, cached for ten seconds
 * and shared across every viewer of that stream, answers it.
 *
 * A probe that throws returns null rather than an empty set: failing to reach
 * nginx must not be able to empty somebody's playlist.
 */
async function probePublishing(urls: string[]): Promise<Set<string> | null> {
  const key = urls.join("|");
  const hit = probeCache.get(key);
  if (hit && Date.now() - hit.at < PROBE_TTL_MS) return hit.publishing;

  try {
    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const res = await fetch(url, { method: "HEAD", cache: "no-store" });
          return res.ok ? url : null;
        } catch {
          return null;
        }
      }),
    );
    const publishing = new Set(results.filter((u): u is string => u !== null));
    // Every probe failing is far more likely to be the probe than four dead
    // rungs, and an empty playlist is a worse answer than an honest one.
    if (publishing.size === 0) return null;
    probeCache.set(key, { at: Date.now(), publishing });
    return publishing;
  } catch {
    return null;
  }
}

function playlistResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      "content-type": "application/vnd.apple.mpegurl",
      // Per viewer, so it must never sit in a shared cache. A CDN holding one
      // person's HD manifest and serving it to everyone would undo all of this.
      "cache-control": "private, no-store",
      /*
       * The website is on evotv.co and this route answers on api.evotv.co, so
       * the player's fetch is cross-origin. nginx already sets exactly this on
       * /hls, which is why playback worked before the manifest moved here.
       *
       * `*` is right rather than lax: the response carries no identity, only
       * which rungs this ticket may see, and the ticket is in the URL the
       * caller already has.
       */
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, HEAD, OPTIONS",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const row = (
    await db
      .select({ hlsPath: schema.streams.hlsPath, deletedAt: schema.streams.deletedAt })
      .from(schema.streams)
      .where(eq(schema.streams.id, id))
      .limit(1)
  )[0];

  if (!row || row.deletedAt || !row.hlsPath) {
    return new NextResponse("Not found", { status: 404 });
  }

  /*
   * Tier, from whichever proof arrived.
   *
   * The ticket is what the app carries. A session is what a browser carries,
   * and it is also the answer for anybody who opens the URL directly. Neither
   * present means the free rungs, not a refusal: a stale ticket should cost
   * somebody their HD, not their broadcast.
   */
  const ticket = readPlaybackTicket(req.nextUrl.searchParams.get("k"));
  let hd = ticket.hd;
  if (!hd) {
    const user = await getCurrentUser();
    if (user) {
      const entitlements = await getEntitlements(user.id, user.role);
      hd = entitlements.hdPlayback;
    }
  }

  let master: string;
  try {
    const upstream = await fetch(row.hlsPath, { cache: "no-store" });
    if (!upstream.ok) {
      return new NextResponse(`Upstream ${upstream.status}`, { status: 502 });
    }
    master = await upstream.text();
  } catch {
    return new NextResponse("Upstream unreachable", { status: 502 });
  }

  // A single-rung broadcast has no ladder to filter. Hand it back as it came.
  if (!master.includes("#EXT-X-STREAM-INF")) {
    return playlistResponse(master);
  }

  const absolutes = master
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "" && !line.startsWith("#"))
    .map((uri) => new URL(uri.trim(), row.hlsPath!).toString());

  const publishing = (await probePublishing(absolutes)) ?? undefined;

  const filtered = filterMaster({
    master,
    originUrl: row.hlsPath,
    hd,
    publishing,
  });

  /*
   * A playlist with nothing in it is not something to hand a player.
   *
   * It happens when every rung a free viewer may see is off air, which is a
   * real state during a single-rung test broadcast at 1080p. Falling back to
   * the unfiltered master would hand out HD for free; falling back to the
   * publishing check alone keeps the viewer watching and still costs the tier
   * rule, so this refuses instead and says why.
   */
  if (filtered.keptVariants === 0) {
    return new NextResponse(
      filtered.droppedForTier > 0
        ? "No rung available at your subscription level"
        : "No rung is publishing",
      { status: 409 },
    );
  }

  return playlistResponse(filtered.playlist);
}
