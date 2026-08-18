import "server-only";

import type { Stream, Vod } from "@/lib/types";
import { getCurrentUser } from "@/lib/auth/guards";
import { getEntitlements, NO_ENTITLEMENTS } from "@/lib/api/entitlements";

/**
 * Watching requires an account, so the playback URL is not public.
 *
 * Enforced on every endpoint that returns a stream, not just the one the player
 * happens to call. A gate in the UI is a suggestion: the manifest URL was in
 * the JSON, so anyone could read it out of the network tab and open it
 * directly, and the sign-in wall would have been decoration.
 *
 * Everything else stays public deliberately. Title, thumbnail, streamer and
 * live state are what a shared link needs to render a preview and what a search
 * engine needs to index the page, and none of it is the broadcast itself.
 */
export function stripPlayback<T extends Pick<Stream, "hlsUrl">>(
  stream: T,
  signedIn: boolean,
): T & { requiresAuth?: true } {
  if (signedIn) return stream;
  return {
    ...stream,
    hlsUrl: "",
    // Explicit, so a client can tell "no video source configured yet" apart
    // from "you are not allowed to see it" and say the right thing.
    requiresAuth: true as const,
  };
}

export function stripPlaybackAll<T extends Pick<Stream, "hlsUrl">>(
  streams: T[],
  signedIn: boolean,
): Array<T & { requiresAuth?: true }> {
  if (signedIn) return streams;
  return streams.map((s) => stripPlayback(s, false));
}

/* ------------------------------------------------------------------ */
/* Recorded video                                                     */
/* ------------------------------------------------------------------ */

/**
 * What this caller is allowed to watch. Resolved once per request.
 *
 * Reading the subscription costs a query, so a route that returns a list of
 * fifty VODs resolves this once and passes it down rather than asking per row.
 */
export interface PlaybackViewer {
  signedIn: boolean;
  /** Entitled to premium content, by subscription or by being staff. */
  premium: boolean;
}

export async function resolveViewer(): Promise<PlaybackViewer> {
  const user = await getCurrentUser();
  if (!user) return { signedIn: false, premium: false };
  const entitlements = await getEntitlements(user.id, user.role).catch(
    () => NO_ENTITLEMENTS,
  );
  return { signedIn: true, premium: entitlements.premiumContent };
}

/**
 * Withhold a recorded video's playback URLs from anyone not entitled to them.
 *
 * The premium wall on a VOD was a modal in the browser and nothing else. Both
 * `hlsUrl` and `mp4Url` were in the JSON of every public endpoint that returned
 * a VOD, so the entire paywall could be walked around by opening devtools,
 * copying the URL out of the network tab and pasting it into a new tab. The
 * subscription was, in effect, a suggestion not to look.
 *
 * Only premium rows are gated, and this is deliberate. Live streams withhold
 * playback from everyone signed out, because watching a broadcast requires an
 * account; the recorded catalogue does not work that way. Free VODs are public
 * by design, they live under a public route, they are what a shared link and a
 * search result point at, and making them require an account would be a product
 * change rather than a security fix. So a free VOD plays for anybody.
 *
 * Everything else stays public on purpose: title, thumbnail, duration, chapters
 * and view count are what a shared link needs to render a preview and what a
 * search engine needs to index, and none of it is the video.
 *
 * `maxHeight` in the entitlements endpoint is a data-saving cap on the quality
 * ladder and was never a security boundary. This is the boundary.
 */
export function stripVodPlayback<
  T extends Pick<Vod, "hlsUrl" | "mp4Url" | "isPremium">,
>(
  vod: T,
  viewer: PlaybackViewer,
): T & { requiresPremium?: true } {
  if (vod.isPremium && !viewer.premium) {
    return { ...vod, hlsUrl: "", mp4Url: "", requiresPremium: true as const };
  }
  return vod;
}

export function stripVodPlaybackAll<
  T extends Pick<Vod, "hlsUrl" | "mp4Url" | "isPremium">,
>(
  vods: T[],
  viewer: PlaybackViewer,
): Array<T & { requiresPremium?: true }> {
  return vods.map((v) => stripVodPlayback(v, viewer));
}
