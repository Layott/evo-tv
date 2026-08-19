import "server-only";

import type { PlaybackViewer } from "@/lib/api/playback";

/**
 * Audience numbers are for staff, not for viewers.
 *
 * Owner's decision, 2026-08-18: how many people are watching a broadcast, and
 * how many times a video has been played, are operational figures. A viewer
 * does not need them and a competitor should not have them for free.
 *
 * Stripped here rather than hidden in the UI, for the same reason the premium
 * wall had to move server-side: a number that reaches the browser is public
 * whatever the markup does with it. Anyone can open the network tab, and a
 * scraper does not render the page at all. Hiding it in a component would leave
 * every count sitting in the JSON of a dozen public endpoints.
 *
 * The field is deleted rather than zeroed. Absent means "not allowed to know";
 * 0 means "nobody is watching". Conflating those makes an empty broadcast
 * indistinguishable from a hidden one, and a client cannot tell whether to
 * render "0 watching" or nothing at all.
 */

type WithViewers = { viewerCount?: number; peakViewerCount?: number };
type WithViews = { viewCount?: number };

/** Strip the live audience size from one object unless the caller is staff. */
export function stripViewerCount<T extends WithViewers>(row: T, admin: boolean): T {
  if (admin) return row;
  const { viewerCount: _v, peakViewerCount: _p, ...rest } = row;
  return rest as T;
}

export function stripViewerCountAll<T extends WithViewers>(
  rows: T[],
  admin: boolean,
): T[] {
  if (admin) return rows;
  return rows.map((r) => stripViewerCount(r, false));
}

/** Strip the play count from one object unless the caller is staff. */
export function stripViewCount<T extends WithViews>(row: T, admin: boolean): T {
  if (admin) return row;
  const { viewCount: _c, ...rest } = row;
  return rest as T;
}

export function stripViewCountAll<T extends WithViews>(
  rows: T[],
  admin: boolean,
): T[] {
  if (admin) return rows;
  return rows.map((r) => stripViewCount(r, false));
}

/**
 * Convenience for the routes that already resolve a viewer for playback, so a
 * caller passes the same object to both strippers rather than re-deriving the
 * role.
 */
export function countsVisibleTo(viewer: PlaybackViewer): boolean {
  return viewer.admin;
}
