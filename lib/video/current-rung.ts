/**
 * Which rung the player is actually pulling, for the heartbeat to report.
 *
 * `watch_events.rung` was built for this and has been null on every row ever
 * written, because the heartbeat sends no body and the player never told anyone
 * what it had chosen. So the audience breakdown could say where people watched
 * and on what, and not at which quality, which is the one that decides the
 * bandwidth bill.
 *
 * A module-level map rather than a prop, because the player and the heartbeat
 * hook sit on opposite sides of the page and threading a value through the
 * component tree to be read once a minute would be worse than a registry with
 * two functions in it.
 *
 * Deliberately not state: nothing re-renders when it changes, and the beat
 * reads whatever is current at the moment it fires.
 */

const current = new Map<string, string>();

/** Called by the player on every level switch. */
export function reportRung(mediaId: string | undefined, rung: string | null): void {
  if (!mediaId) return;
  if (rung) current.set(mediaId, rung);
  else current.delete(mediaId);
}

/** Called by the heartbeat. Absent means the player has not settled yet. */
export function currentRung(mediaId: string | undefined): string | null {
  if (!mediaId) return null;
  return current.get(mediaId) ?? null;
}

/** The player is gone; stop reporting for it. */
export function forgetRung(mediaId: string | undefined): void {
  if (mediaId) current.delete(mediaId);
}

/**
 * The suffix a variant URL carries, which is what the server stores.
 *
 * Read off the URL rather than guessed from the height, so a ladder whose
 * resolutions change still reports the rung the operator configured.
 */
export function rungFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const name = url.split("?")[0]!.split("/").pop() ?? "";
  const base = name.replace(/\.m3u8$/i, "");
  for (const suffix of ["_low", "_mid", "_hi", "_fhd"]) {
    if (base.endsWith(suffix)) return suffix;
  }
  return null;
}
