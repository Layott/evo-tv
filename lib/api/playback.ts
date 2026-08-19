import "server-only";

import type { Stream, Vod } from "@/lib/types";
import { getCurrentUser } from "@/lib/auth/guards";
import { getEntitlements, NO_ENTITLEMENTS } from "@/lib/api/entitlements";
import { hasMinRole } from "@/lib/auth/roles";

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
  /** Staff. Audience numbers are theirs and nobody else's. */
  admin: boolean;
}

export async function resolveViewer(): Promise<PlaybackViewer> {
  const user = await getCurrentUser();
  if (!user) return { signedIn: false, premium: false, admin: false };
  const entitlements = await getEntitlements(user.id, user.role).catch(
    () => NO_ENTITLEMENTS,
  );
  return {
    signedIn: true,
    premium: entitlements.premiumContent,
    admin: hasMinRole((user as { role?: string }).role, "admin"),
  };
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
 * Two gates, because they answer different questions.
 *
 * **Signed out gets nothing**, free or premium. Watching requires an account,
 * which is the same rule live streams already follow (owner's decision,
 * 2026-08-18). The catalogue is still browsable signed out and a shared link
 * still opens to a real page; what it does not do is play without an account.
 *
 * **Signed in but not a subscriber gets nothing for premium rows.** The free
 * catalogue plays as normal.
 *
 * Everything else stays public on purpose: title, thumbnail, duration and
 * chapters are what a shared link needs to render a preview and what a search
 * engine needs to index, and none of it is the video. View count is not among
 * them any more, see lib/api/counts.ts.
 *
 * `maxHeight` in the entitlements endpoint is a data-saving cap on the quality
 * ladder and was never a security boundary. This is the boundary.
 */
export function stripVodPlayback<
  T extends Pick<Vod, "hlsUrl" | "mp4Url" | "isPremium"> & {
    publishAt?: string | null;
  },
>(
  vod: T,
  viewer: PlaybackViewer,
): T & {
  requiresAuth?: true;
  requiresPremium?: true;
  comingSoon?: true;
} {
  /*
   * Not out yet beats every other answer, including premium.
   *
   * The lists already exclude it, so reaching this means somebody has the
   * detail URL: a link shared early, or a guess. They get the page and the
   * date, and no manifest. Telling them to subscribe for something that does
   * not exist yet would be worse than useless.
   */
  if (vod.publishAt && new Date(vod.publishAt).getTime() > Date.now()) {
    return { ...vod, hlsUrl: "", mp4Url: "", comingSoon: true as const };
  }
  if (!viewer.signedIn) {
    return { ...vod, hlsUrl: "", mp4Url: "", requiresAuth: true as const };
  }
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
): Array<T & { requiresAuth?: true; requiresPremium?: true }> {
  return vods.map((v) => stripVodPlayback(v, viewer));
}
