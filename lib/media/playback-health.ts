/**
 * Has this player actually put a picture on the screen.
 *
 * The channel's ad layers recovered from one signal, `onError`, and a file that
 * stalls without erroring never sends it. The live filler did exactly that: an
 * mp4 with its index at the end downloaded quietly for ever, raised nothing,
 * and the viewer got a black rectangle labelled "Back shortly" for as long as
 * the tab stayed open.
 *
 * So an ad layer must not ask whether the element looks healthy. It must ask
 * whether a frame arrived, and give the channel back when one has not. This is
 * the same reasoning as the stall watchdog already in `channel-breaks.tsx`,
 * which watches `currentTime` move rather than trusting `readyState`, except
 * that this one covers the case where playback never begins at all.
 */

/** The parts of a video element this question needs. */
export interface PlaybackState {
  readyState: number;
  videoWidth: number;
  error: { code: number } | null;
  /**
   * Whether there is a picture to measure.
   *
   * Defaults to true because every creative that reaches a player here is
   * meant to have one. An audio-only file has no width and never will, so
   * width would condemn it for ever; that file is the ads form's problem to
   * refuse, not the watchdog's to hang on.
   */
  hasVideoTrack?: boolean;
}

/** `HAVE_CURRENT_DATA`: there is a frame at the current position. */
const HAVE_CURRENT_DATA = 2;

export function hasDecodedFirstFrame(state: PlaybackState | null): boolean {
  if (!state) return false;
  // A decode failure part way through leaves the last frame and its dimensions
  // in place, so the error has to outrank both.
  if (state.error) return false;
  if (state.readyState < HAVE_CURRENT_DATA) return false;
  // Dimensions arrive with the metadata, one step before any frame is decoded,
  // so a known width alone is not a picture. Past HAVE_CURRENT_DATA a width of
  // zero means there is no video track rather than no frame.
  if (state.hasVideoTrack === false) return true;
  return state.videoWidth > 0;
}

/** Reads the state above off a real element, or null when it has gone away. */
export function readPlaybackState(video: HTMLVideoElement | null): PlaybackState | null {
  if (!video) return null;
  return {
    readyState: video.readyState,
    videoWidth: video.videoWidth,
    error: video.error ? { code: video.error.code } : null,
  };
}
