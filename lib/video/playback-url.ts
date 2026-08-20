import "server-only";

import { mintPlaybackTicket } from "@/lib/video/playback-ticket";

/**
 * The URL a player should be given for a live stream.
 *
 * Not the origin manifest any more. That one advertises every rung nginx
 * knows about, so handing it out is handing out 1080p to anybody who asks,
 * and it advertises rungs that are not publishing, which strands a player on
 * a black screen. Both are answered by serving the master ourselves.
 *
 * The ticket rides in the URL because the app's native player takes a bare
 * `{ uri }` and cannot attach a bearer token to the manifest request. It says
 * one thing, "this URL may see HD", and expires in ten minutes.
 *
 * Anything that is not one of our own ladder manifests is passed through
 * untouched: a Cloudflare Stream URL, a manually pasted manifest, an empty
 * string for a viewer who may not watch at all.
 */
export function playbackUrlFor(
  streamId: string,
  hlsPath: string | null | undefined,
  hd: boolean,
): string {
  if (!hlsPath) return "";

  // Only our own nginx output goes through the gate. `RTMP_HLS_BASE_URL` is
  // what `on-publish` wrote the path against, so it is the honest test.
  const base = process.env.RTMP_HLS_BASE_URL?.replace(/\/+$/, "");
  if (!base || !hlsPath.startsWith(base)) return hlsPath;

  /*
   * Absolute, because the app's native player cannot resolve a relative URL.
   *
   * Production has no `NEXT_PUBLIC_APP_URL`; what it does have is
   * `BETTER_AUTH_URL`, which is the API origin both clients already talk to.
   * An empty answer still works for the website, which resolves it against
   * its own origin, so this degrades rather than breaks.
   */
  const origin = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    ""
  ).replace(/\/+$/, "");
  const ticket = mintPlaybackTicket(hd);
  return `${origin}/api/hls/${encodeURIComponent(streamId)}/master.m3u8?k=${ticket}`;
}
