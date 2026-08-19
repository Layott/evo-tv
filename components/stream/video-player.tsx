"use client";

import * as React from "react";

import { useWatchHeartbeat } from "@/hooks/use-watch-heartbeat";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Captions,
  PictureInPicture2,
  Loader2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  AlertTriangle,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type HlsType from "hls.js";
import { toast } from "sonner";
import {
  getCaptionPhrasesSync,
  listCaptionLanguages,
  type CaptionLang,
} from "@/lib/client/player-features";

/**
 * Seconds of video to bank before a live stream starts playing.
 *
 * Tuned against the 2s fragments nginx cuts, so this is four segments in hand.
 * Raising it makes the start slower and the picture steadier; the ceiling is
 * patience, not memory.
 */
const LIVE_PREBUFFER_SEC = 8;

/** Start anyway after this long, however little was banked. */
const LIVE_PREBUFFER_TIMEOUT_MS = 6000;

/**
 * Seconds of contiguous buffer sitting in front of the playhead.
 *
 * `video.buffered` is a set of ranges rather than one span, and only the range
 * containing the playhead can actually be played through; a later range across
 * a gap is not a cushion. So this finds the range the playhead is in and
 * measures to its end, and reports nothing when the playhead sits in a hole.
 */
function bufferedAheadOf(v: HTMLVideoElement): number {
  const t = v.currentTime;
  for (let i = 0; i < v.buffered.length; i++) {
    if (v.buffered.start(i) <= t + 0.1 && v.buffered.end(i) > t) {
      return v.buffered.end(i) - t;
    }
  }
  return 0;
}

interface VideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  isLive?: boolean;
  chapters?: { label: string; startSec: number }[];
  onTimeUpdate?: (currentSec: number) => void;
  onReady?: (video: HTMLVideoElement) => void;
  className?: string;
  /** id used for captions/AI track lookup; uses src if omitted */
  mediaId?: string;
  /**
   * Which catalogue row this playback belongs to, so watch time and audience
   * retention can be recorded against it. Omitted for live, where there is no
   * fixed duration to measure a percentage against.
   */
  analytics?: { type: "vod" | "episode"; id: string };
}

/**
 * Renditions come from the manifest, never from a list written here.
 *
 * This was `["auto", "1080p", "720p", "480p", "360p"]`, hardcoded. Picking one
 * set React state and did nothing else: no call into hls.js, no level switch.
 * A viewer on a single-bitrate stream was offered 1080p, told they were
 * watching 360p, and got whatever the one rendition happened to be.
 *
 * `hls.levels` is the real ladder for the stream that is actually loaded, so
 * the menu shows exactly what exists and switching it switches the video.
 */
interface Rendition {
  /** Index into hls.levels. -1 is auto. */
  index: number;
  label: string;
}

function renditionLabel(level: { height?: number; bitrate?: number }): string {
  if (level.height) return `${level.height}p`;
  if (level.bitrate) return `${Math.round(level.bitrate / 1000)} kbps`;
  return "Source";
}
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
type CaptionSelection = "off" | "auto" | CaptionLang;

function formatTime(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}


/**
 * The tallest rendition this viewer may pull, or null for no cap.
 *
 * Free viewers are held to 480p. That is two decisions at once: it is the
 * right default for a mobile-first audience buying its own data, and it is the
 * difference between a viewer costing 0.36 GB an hour and 0.68, which is the
 * budget that decides how many people the channel can carry.
 *
 * Fetched once per page and shared, so a grid of players makes one request.
 * Null while it is in flight, which means no cap: a moment of the better
 * picture is a far smaller problem than a moment of no picture.
 */
let entitlementsInflight: Promise<number | null> | null = null;

function maxHeightForViewer(): Promise<number | null> {
  entitlementsInflight ??= fetch("/api/me/entitlements", { credentials: "include" })
    .then((r) => (r.ok ? r.json() : null))
    .then((body: { maxHeight?: number | null } | null) => body?.maxHeight ?? null)
    .catch(() => null);
  return entitlementsInflight;
}

export function VideoPlayer({
  src,
  poster,
  autoPlay,
  isLive,
  chapters,
  onTimeUpdate,
  onReady,
  className,
  mediaId,
  analytics,
}: VideoPlayerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  /**
   * The same element as `videoRef`, held in state as well.
   *
   * A ref does not re-render, so a hook depending on `videoRef.current` reads
   * null on the first pass and never runs again. State gives the heartbeat
   * something to wake up on.
   */
  const [videoEl, setVideoEl] = React.useState<HTMLVideoElement | null>(null);

  // Records watch time and audience retention for on-demand playback.
  useWatchHeartbeat(videoEl, analytics);
  const [hlsError, setHlsError] = React.useState<string | null>(null);
  /** The attached hls.js instance, so a re-run can tear the old one down. */
  const hlsRef = React.useRef<HlsType | null>(null);

  /**
   * Attach hls.js when the source is an HLS manifest.
   *
   * The element was given `src={src}` directly. Only Safari can play `.m3u8`
   * natively; in Chrome, Firefox and Edge the video sat at readyState 0 with no
   * error event, so a live stream rendered as a permanently black player. Every
   * live source here is HLS, from Cloudflare Stream or from our own ffmpeg
   * output, which made this the whole live path on most browsers.
   *
   * `hls.js` was already a dependency and already wired up in
   * `components/stream/hls-player.tsx`, a second player this one replaced. The
   * import is dynamic so the library only loads for a page that plays HLS.
   */
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setHlsError(null);
    setRenditions([]);
    setSelectedLevel(-1);
    setActiveLevel(-1);

    const isHls = src.includes(".m3u8");

    // A plain progressive file needs nothing.
    if (!isHls) {
      video.src = src;
      return;
    }

    let cancelled = false;
    let prebufferTimer: ReturnType<typeof setTimeout> | null = null;

    // Any instance still attached from a previous run has to go before a new
    // one touches the element. React's dev Strict Mode mounts this effect
    // twice, and because the import is async both runs used to reach
    // `attachMedia` on the same <video>: the second detached the first's
    // MediaSource, and the result was two playlist fetches followed by no
    // segment requests at all, with the player stuck at readyState 0.
    hlsRef.current?.destroy();
    hlsRef.current = null;

    void import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !videoRef.current) return;

      /*
       * hls.js first, native second, and the order matters.
       *
       * The obvious check is `canPlayType("application/vnd.apple.mpegurl")` and
       * to use native playback when it is non-empty. Desktop Chrome answers
       * "maybe" to that and then cannot play the manifest at all: the element
       * sits at readyState 0 with no error event and the player is a black
       * rectangle forever. That is exactly the bug this replaced.
       *
       * Where Media Source Extensions exist, hls.js is the reliable path.
       * Native is the fallback for Safari and iOS, which cannot run hls.js but
       * genuinely do play HLS themselves.
       */
      if (!Hls.isSupported()) {
        if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
          videoRef.current.src = src;
          if (autoPlay) void videoRef.current.play().catch(() => {});
        } else {
          setHlsError("This browser cannot play live streams.");
        }
        return;
      }
      /*
       * Tuned for stability over latency, against a real broadcast.
       *
       * The self-hosted path is single-bitrate: there is no lower rendition to
       * drop to, so a viewer whose connection dips does not get a softer
       * picture, they get a stall. The only defence is a deeper buffer.
       *
       * hls.js defaults sit about three fragments from the live edge, which at
       * 2s fragments is roughly six seconds of headroom. That is tuned for
       * latency and is the wrong trade here: segments come from one droplet in
       * Frankfurt to viewers in Lagos, so a single slow round trip empties the
       * buffer. Sitting further back costs a few seconds of delay and removes
       * most of the stalls.
       *
       * Note what is NOT set: `lowLatencyMode`. An earlier attempt enabled it
       * alongside a low `liveSyncDurationCount`, and hls.js then fetched both
       * playlists and never requested a single fragment. Do not reintroduce it
       * without confirming segments are actually being loaded.
       */
      const instance = new Hls({
        /*
         * Start ~20s behind the edge rather than ~12s.
         *
         * Latency on a broadcast channel is worth almost nothing and a stall
         * costs everything: nobody watching a tournament can tell whether the
         * picture is twelve or twenty seconds old, but everybody notices a
         * spinner. This is the single biggest lever on stalling, because the
         * gap it opens is the only thing standing between a slow round trip
         * from Frankfurt and an empty buffer.
         */
        liveSyncDurationCount: 10,
        /*
         * How far behind hls.js tolerates before it seeks the viewer forward.
         *
         * This was 200 fragments, about 400 seconds, deliberately: it let a
         * viewer scrub back across the whole DVR window without the player
         * dragging them forward again, and "Go live" was how they returned.
         *
         * Live scrubbing and that button are both gone now, so nothing puts a
         * viewer behind on purpose any more, and anything that does put them
         * behind (a backgrounded tab, a laptop waking up) is a fault the player
         * has to correct on its own. 30 fragments is about a minute: past that
         * it resyncs to the edge, which is what the manual control used to do.
         */
        liveMaxLatencyDurationCount: 30,
        // Buffer ahead aggressively when bandwidth allows.
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        /*
         * Retain only a little behind the playhead.
         *
         * This was 300s to match the DVR window nginx serves, so that a seek
         * back five minutes landed on data hls.js still held. With no live
         * scrub bar there is nothing to seek back to, and at 2.8 Mbps that
         * window was roughly 105 MB of memory kept for a feature the player no
         * longer offers. Thirty seconds is enough for `recoverMediaError` to
         * have something to work with.
         */
        backBufferLength: 30,
        // A dropped segment on a busy origin is ordinary. Retry rather than
        // raising a fatal error and tearing the stream down.
        fragLoadingMaxRetry: 6,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
      });
      hlsRef.current = instance;
      instance.attachMedia(videoRef.current);
      instance.loadSource(src);
      instance.on(Hls.Events.MANIFEST_PARSED, () => {
        // Belt and braces: if a policy still refuses, mute and try once more,
        // so the picture starts even where the rules are stricter than usual.
        // The real ladder for this stream. A self-hosted single-bitrate
        // broadcast yields one entry and the menu hides itself.
        setRenditions(
          instance.levels.map((lvl, index) => ({
            index,
            label: renditionLabel(lvl),
          })),
        );
        setSelectedLevel(instance.currentLevel ?? -1);

        // Cap the ladder for a viewer who has not paid for the top of it. This
        // stops hls.js *asking* for the higher rungs; it is a data and cost
        // decision, not a lock. What is behind a subscription is decided on the
        // server, where the URL is handed out.
        void maxHeightForViewer().then((maxHeight) => {
          if (!maxHeight || cancelled) return;
          const allowed = instance.levels
            .map((lvl, index) => ({ index, height: lvl.height ?? 0 }))
            .filter((l) => l.height > 0 && l.height <= maxHeight);
          // Every rung is above the cap: leave it alone rather than refusing to
          // play. A single-rendition stream is the common case today.
          if (allowed.length === 0 || allowed.length === instance.levels.length) return;
          const cap = allowed[allowed.length - 1]!.index;
          instance.autoLevelCapping = cap;
          if (instance.currentLevel > cap) instance.currentLevel = cap;
        });
        if (autoPlay) {
          const startPlayback = () => {
            void videoRef.current?.play().catch(() => {
              const v = videoRef.current;
              if (!v) return;
              v.muted = true;
              setMuted(true);
              void v.play().catch(() => {});
            });
          };

          if (!isLive) {
            startPlayback();
            return;
          }

          /*
           * Hold the first frame back until there is a cushion behind it.
           *
           * `canplay` fires as soon as the decoder has roughly one frame, so
           * calling `play()` there starts the picture with almost nothing in
           * hand: the viewer sees video for a second or two and then the
           * spinner, because the buffer was empty the whole time and the first
           * slow segment emptied it. That start-then-stall is what "it still
           * buffers" looks like, and no amount of retuning the sync point fixes
           * it, because the problem is when playback begins rather than where.
           *
           * So the gate is on buffered seconds, not on readiness. A few seconds
           * of black at the start buys a cushion that survives a slow segment,
           * and a viewer who waited three seconds for a channel to come up will
           * not notice; the same three seconds spent stalling mid-picture is
           * the thing they complain about.
           *
           * The timeout is the escape hatch. A thin or throttled connection may
           * never reach the target, and refusing to start at all would be worse
           * than starting shallow, so past that point it plays with whatever it
           * has.
           */
          let started = false;
          const begin = () => {
            if (started || cancelled) return;
            started = true;
            instance.off(Hls.Events.BUFFER_APPENDED, onAppended);
            if (prebufferTimer) clearTimeout(prebufferTimer);
            setPrebuffering(false);
            startPlayback();
          };
          const onAppended = () => {
            const v = videoRef.current;
            if (!v) return;
            if (bufferedAheadOf(v) >= LIVE_PREBUFFER_SEC) begin();
          };

          setPrebuffering(true);
          instance.on(Hls.Events.BUFFER_APPENDED, onAppended);
          prebufferTimer = setTimeout(begin, LIVE_PREBUFFER_TIMEOUT_MS);
        }
      });
      instance.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        setActiveLevel(data.level);
      });
      instance.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data.fatal) return;
        // Network and media errors are usually a dropped segment rather than a
        // dead stream, so recover in place before giving up on it.
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          instance.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          instance.recoverMediaError();
        } else {
          setHlsError("This stream is not available right now.");
          instance.destroy();
          if (hlsRef.current === instance) hlsRef.current = null;
        }
      });
    });

    return () => {
      cancelled = true;
      if (prebufferTimer) clearTimeout(prebufferTimer);
      setPrebuffering(false);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src, autoPlay, isLive]);
  const controlsTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = React.useState(false);
  /**
   * Autoplay implies muted, because every browser blocks a sound-on autoplay.
   *
   * This started false, so `video.play()` was rejected and the player sat on a
   * poster with a play button. A viewer arriving at a live broadcast had to
   * click before anything happened, which is not how a channel behaves.
   *
   * Muted autoplay is allowed everywhere, so the picture starts immediately and
   * the viewer turns sound on. The overlay below makes that one click and says
   * so, rather than leaving them to work out why it is silent.
   */
  const [muted, setMuted] = React.useState(autoPlay);
  /** True once the viewer has chosen sound, so the prompt does not return. */
  const [soundChosen, setSoundChosen] = React.useState(!autoPlay);
  const [volume, setVolume] = React.useState(1);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  /**
   * The handle position while dragging.
   *
   * Null when not dragging, and the slider reads `currentTime` as usual. While
   * dragging it is the authority, because `timeupdate` fires about four times a
   * second and would otherwise yank the handle back under the pointer between
   * frames. That fight is what made scrubbing feel like it was resisting.
   */
  const [scrubValue, setScrubValue] = React.useState<number | null>(null);
  /** Ref, not state: the timeupdate listener reads it without re-subscribing. */
  const scrubbingRef = React.useRef(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  /**
   * Banking the opening buffer, before the first frame is shown.
   *
   * Tracked apart from `loading` because the element reports itself ready long
   * before the cushion exists: `canplay` clears `loading`, and without this the
   * player would drop the spinner and offer a centre play button while it was
   * still deliberately holding playback back, which reads as "stuck, click me".
   */
  const [prebuffering, setPrebuffering] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [renditions, setRenditions] = React.useState<Rendition[]>([]);
  /** -1 = auto (let hls.js pick by bandwidth). */
  const [selectedLevel, setSelectedLevel] = React.useState(-1);
  /** Which rendition auto actually landed on, so "Auto" can say 720p. */
  const [activeLevel, setActiveLevel] = React.useState(-1);
  const [captionSelection, setCaptionSelection] =
    React.useState<CaptionSelection>("off");
  const [captionLineIndex, setCaptionLineIndex] = React.useState(0);
  const [speed, setSpeed] = React.useState<number>(1);
  const [showControls, setShowControls] = React.useState(true);

  const captionLangs = React.useMemo(() => listCaptionLanguages(), []);
  const captionsOn = captionSelection !== "off";
  const captionLines = React.useMemo(() => {
    if (!captionsOn) return [];
    const lang: CaptionLang =
      captionSelection === "auto" ? "en" : (captionSelection as CaptionLang);
    return getCaptionPhrasesSync(lang);
  }, [captionsOn, captionSelection]);

  // Cycle the on-screen caption strip every ~3s while captions are on.
  React.useEffect(() => {
    if (!captionsOn || captionLines.length === 0) return;
    const id = window.setInterval(() => {
      setCaptionLineIndex((i) => (i + 1) % captionLines.length);
    }, 3000);
    return () => window.clearInterval(id);
  }, [captionsOn, captionLines.length]);

  // Apply src changes
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    setError(false);
    setLoading(true);
  }, [src]);

  // Wire up video events
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => {
      setCurrentTime(v.currentTime);
      onTimeUpdate?.(v.currentTime);
    };
    const onDur = () => setDuration(v.duration || 0);
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => {
      setLoading(false);
      onReady?.(v);
    };
    const onErr = () => {
      setError(true);
      setLoading(false);
    };
    const onVol = () => {
      setMuted(v.muted);
      setVolume(v.volume);
    };

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onDur);
    v.addEventListener("loadedmetadata", onDur);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("error", onErr);
    v.addEventListener("volumechange", onVol);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onDur);
      v.removeEventListener("loadedmetadata", onDur);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("error", onErr);
      v.removeEventListener("volumechange", onVol);
    };
  }, [onReady, onTimeUpdate]);

  // Apply playback rate
  React.useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  // Fullscreen change listener
  React.useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const togglePlay = React.useCallback(() => {
    const v = videoRef.current;
    if (!v || error) return;
    if (v.paused) v.play().catch(() => setError(true));
    else v.pause();
  }, [error]);

  const toggleMute = React.useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    // Using the normal mute control counts as choosing, so the prompt does not
    // reappear the moment they mute deliberately.
    setSoundChosen(true);
  }, []);

  const adjustVolume = React.useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = Math.min(1, Math.max(0, v.volume + delta));
    if (v.volume > 0) v.muted = false;
  }, []);

  /** Pin a rendition, or -1 to hand the choice back to hls.js. */
  const selectRendition = React.useCallback((index: number) => {
    setSelectedLevel(index);
    const hls = hlsRef.current;
    if (hls) hls.currentLevel = index;
  }, []);

  const seekBy = React.useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    /*
     * Live does not seek at all, from any entry point.
     *
     * The buttons are hidden on live, but the arrow keys reach this too, and a
     * viewer who nudged the left arrow would drop behind the edge with no
     * control offering the way back and no readout saying they had moved. The
     * refusal belongs here rather than at the two call sites, so a third one
     * cannot reintroduce it.
     */
    if (isLive) return;
    /*
     * Clamp to what is actually seekable, not to [0, duration].
     *
     * On a live stream `duration` is Infinity and the seekable range does not
     * start at 0: it starts wherever the DVR window begins, and that start
     * keeps moving forward as old segments age out of the manifest. Clamping
     * to 0 asks for a position the browser cannot reach, and playback either
     * ignores it or stalls.
     */
    const target = v.currentTime + delta;
    if (v.seekable.length > 0) {
      const start = v.seekable.start(0);
      const end = v.seekable.end(v.seekable.length - 1);
      // Stay a beat off the live edge; seeking exactly to it re-buffers.
      v.currentTime = Math.min(Math.max(target, start), Math.max(start, end - 0.5));
      return;
    }
    v.currentTime = Math.max(0, target);
  }, [isLive]);

  const toggleFullscreen = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  const togglePip = React.useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch {
      toast.error("Picture-in-picture not supported");
    }
  }, []);

  // Keyboard shortcuts
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA"))
        return;
      const key = e.key.toLowerCase();
      if (key === " " || key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (key === "m") {
        toggleMute();
      } else if (key === "f") {
        toggleFullscreen();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        seekBy(-10);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        seekBy(10);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        adjustVolume(0.05);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        adjustVolume(-0.05);
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [togglePlay, toggleMute, toggleFullscreen, seekBy, adjustVolume]);

  // Auto-hide controls
  const scheduleHide = React.useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    setShowControls(true);
    controlsTimerRef.current = setTimeout(() => {
      if (playing && !error) setShowControls(false);
    }, 3000);
  }, [playing, error]);

  React.useEffect(() => {
    scheduleHide();
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [scheduleHide]);

  /**
   * Dragging moves the handle only. The seek happens once, on release.
   *
   * Seeking on every drag frame asks the player to flush and refill its buffer
   * dozens of times across one gesture, so the picture stutters and the handle
   * stalls behind the pointer. One seek at the end is both smoother and less
   * work.
   */
  const handleScrub = (values: number[]) => {
    const next = values[0];
    if (typeof next !== "number") return;
    scrubbingRef.current = true;
    setScrubValue(next);
  };

  const handleSeekCommit = (values: number[]) => {
    const v = videoRef.current;
    const next = values[0];
    scrubbingRef.current = false;
    setScrubValue(null);
    if (!v || typeof next !== "number") return;
    // Only reachable on recorded video now, so there is no live edge to keep
    // clear of and the value can be taken as given.
    v.currentTime = next;
    // Reflect it immediately rather than waiting for the next timeupdate, so
    // the handle does not jump back for a frame after release.
    setCurrentTime(next);
  };

  const handleVolume = (values: number[]) => {
    const v = videoRef.current;
    const next = values[0];
    if (v && typeof next === "number") {
      v.volume = next;
      v.muted = next === 0;
    }
  };

  const retry = () => {
    setError(false);
    setLoading(true);
    const v = videoRef.current;
    if (v) {
      v.load();
      v.play().catch(() => setError(true));
    }
  };

  return (
    <div className="w-full">
    <div
      ref={containerRef}
      tabIndex={0}
      onMouseMove={scheduleHide}
      onClick={scheduleHide}
      className={cn(
        "relative w-full bg-black outline-none select-none group",
        "aspect-video overflow-hidden",
        className
      )}
    >
      <video
        ref={(el) => {
          videoRef.current = el;
          setVideoEl(el);
        }}
        /* No `src` here: the effect above assigns it, or hands the element to
           hls.js. Setting both makes the browser fetch the manifest twice and
           race hls.js for the media element. */
        poster={poster}
        /*
         * Live starts itself, from the effect, once it has banked a cushion.
         *
         * The attribute cannot stay on for live: it tells the browser to begin
         * the moment the first bytes are appended, which is precisely what the
         * prebuffer gate exists to prevent, and the element wins because it
         * does not wait to be asked. Measured with the gate's threshold turned
         * up to ten minutes, playback still started at once and `paused` was
         * false with `readyState` 0, which is what gave this away.
         *
         * Recorded video keeps it: there is no live edge to fall off, so
         * starting on the first frame is the right behaviour there.
         */
        autoPlay={autoPlay && !isLive}
        playsInline
        muted={muted}
        className="absolute inset-0 h-full w-full object-contain bg-black"
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
      />

      {/* A fatal playback failure has to say so. Without this the player is a
          black rectangle and the viewer cannot tell it apart from a stream
          that simply has not started. */}
      {hlsError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/90 px-6 text-center">
          <p className="text-sm font-medium text-foreground">{hlsError}</p>
          <p className="text-xs text-muted-foreground">
            Try reloading the page in a moment.
          </p>
        </div>
      )}

      {/* Sound is off because autoplay required it, and the viewer has not
          chosen yet. One tap, and it says what it does: a muted live stream
          with no prompt just looks like broken audio. */}
      {muted && soundChosen === false && !hlsError ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const v = videoRef.current;
            if (v) {
              v.muted = false;
              if (v.volume === 0) v.volume = 1;
            }
            setMuted(false);
            setSoundChosen(true);
          }}
          /*
           * Below the live badge on a phone, beside it from `sm` up.
           *
           * Centring it at `top-4` used to run it straight through the viewer
           * counter at 390px. That counter is gone, but the offset stays: the
           * badge row still starts at the left edge and a centred pill still
           * crowds it on a narrow screen.
           */
          className="absolute left-1/2 top-14 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/80 px-4 py-2 text-sm font-medium text-white hover:bg-black sm:top-4"
        >
          <VolumeX className="size-4" />
          Tap for sound
        </button>
      ) : null}

      {/*
        Live badge.
       *
       * The audience counter that used to sit beside it is gone. Viewers do not
       * get audience numbers at all now, and for the staff who do, "0 watching"
       * over the player is the worst version of the information: it is the
       * number at its least flattering, shown to the one audience that cannot
       * act on it. Staff read the real figures in the live control room.
       */}
      {isLive && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
            <span className="size-2 rounded-full bg-paper" />
            Live
          </div>
        </div>
      )}

      {/* Caption strip (bottom-third) */}
      {captionsOn && captionLines.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-6">
          <div
            key={captionLineIndex}
            className="max-w-2xl rounded bg-black/80 px-3 py-1.5 text-center text-sm text-white animate-in fade-in slide-in-from-bottom-1 duration-300 sm:text-base"
          >
            {captionSelection === "auto" ? (
              <span className="mr-2 rounded bg-amber-500/30 px-1 text-[10px] text-amber-200">
                AUTO
              </span>
            ) : null}
            {captionLines[captionLineIndex]}
          </div>
        </div>
      )}

      {/* Loading spinner */}
      {(loading || prebuffering) && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <Loader2 className="size-10 animate-spin text-white/80" />
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80 text-center px-4">
          <AlertTriangle className="size-10 text-amber-400" />
          <div className="text-sm font-semibold text-white">
            Demo video unavailable
          </div>
          <p className="text-xs text-muted-foreground max-w-xs">
            The sample file could not be loaded. Controls remain interactive for
            preview.
          </p>
          <Button size="sm" variant="secondary" onClick={retry}>
            <RefreshCw className="size-3.5 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* Center play button when paused and not loading */}
      {!playing && !loading && !prebuffering && !error && (
        <button
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 z-10 flex items-center justify-center"
        >
          <div className="size-16 rounded-full bg-black/70 flex items-center justify-center hover:bg-black/85">
            <Play className="size-8 text-white ml-1" fill="white" />
          </div>
        </button>
      )}

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity",
          showControls || !playing ? "opacity-100" : "opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/*
          Scrub bar, on recorded video only.

          A live channel has no meaningful position to show. The bar bound to
          the DVR window instead, which made a broadcast look like a file with a
          beginning and an end, and invited a viewer to drag themselves off the
          live edge for no gain: every second scrubbed back is a second of
          latency they cannot see the value of, and landing near the edge
          re-buffers on arrival. Removing it is also what lets the player hold a
          fixed cushion, because nothing moves the playhead any more.
        */}
        {!isLive && (
          <div className="relative px-1">
            <Slider
              value={[
                scrubValue !== null
                  ? scrubValue
                  : Math.min(currentTime, duration || 0),
              ]}
              min={0}
              max={duration || 1}
              step={0.1}
              onValueChange={handleScrub}
              onValueCommit={handleSeekCommit}
              className="w-full"
              disabled={error}
            />
            {/* Chapter ticks */}
            {chapters && chapters.length > 0 && duration > 0 && (
              <div className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 h-2">
                {chapters.map((c, i) => (
                  <div
                    key={`${c.label}-${i}`}
                    className="absolute top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-amber-300"
                    style={{ left: `${Math.min(100, (c.startSec / duration) * 100)}%` }}
                    title={c.label}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center gap-1.5">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={togglePlay}
            className="text-white hover:bg-white/10"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>

          {/* Skip back and forward, on recorded video only. `seekBy` existed
              but was reachable only from the arrow keys, so on a phone there
              was no way to do it at all.

              These are gone on live for the same reason the scrub bar is, and
              one more: with no "Go live" control left, a viewer who tapped back
              10s would have no way to return to the edge and nothing on screen
              telling them they had left it. */}
          {!isLive && (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => seekBy(-10)}
                className="text-white hover:bg-white/10"
                aria-label="Back 10 seconds"
                title="Back 10s"
              >
                <RotateCcw className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => seekBy(10)}
                className="text-white hover:bg-white/10"
                aria-label="Forward 10 seconds"
                title="Forward 10s"
              >
                <RotateCw className="size-4" />
              </Button>
            </>
          )}

          <Button
            size="icon-sm"
            variant="ghost"
            onClick={toggleMute}
            className="text-white hover:bg-white/10"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted || volume === 0 ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </Button>

          <div className="hidden sm:block w-20">
            <Slider
              value={[muted ? 0 : volume]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={handleVolume}
            />
          </div>

          {/*
            Live says LIVE, and nothing else.

            This used to read "0:26 behind · Go live" whenever the playhead sat
            more than five seconds off the edge. That was accurate and it was
            still wrong to show: the player now deliberately holds a cushion of
            about twenty seconds, so the honest readout was permanently on,
            reporting the fix as though it were a fault and pointing at a button
            whose whole effect was to undo it. Latency on a broadcast is not a
            number a viewer has any use for.

            Falling genuinely far behind is handled by hls.js resyncing, not by
            asking the viewer to notice and press something.
          */}
          <span className="ml-1 text-xs font-mono text-white tabular-nums">
            {isLive ? (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-red-500" />
                LIVE
              </span>
            ) : (
              `${formatTime(currentTime)} / ${formatTime(duration)}`
            )}
          </span>

          <div className="ml-auto flex items-center gap-1">
            {/* Captions menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className={cn(
                    "text-white hover:bg-white/10",
                    captionsOn && "bg-white/10",
                  )}
                  aria-label="Captions"
                >
                  <Captions className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-card text-foreground border-border w-52"
              >
                <DropdownMenuLabel className="text-xs">Subtitles / CC</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    setCaptionSelection("off");
                    toast.message("Captions off");
                  }}
                  className="text-xs"
                >
                  <span
                    className={cn(
                      "mr-2",
                      captionSelection === "off" ? "opacity-100" : "opacity-0",
                    )}
                  >
                    •
                  </span>
                  Off
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setCaptionSelection("auto");
                    toast.message("Auto-translate captions on");
                  }}
                  className="text-xs"
                >
                  <span
                    className={cn(
                      "mr-2",
                      captionSelection === "auto" ? "opacity-100" : "opacity-0",
                    )}
                  >
                    •
                  </span>
                  Auto-translate (beta)
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-muted" />
                <DropdownMenuLabel className="text-xs">Languages</DropdownMenuLabel>
                {captionLangs.map((l) => (
                  <DropdownMenuItem
                    key={l.lang}
                    onClick={() => {
                      setCaptionSelection(l.lang);
                      toast.success(`Captions: ${l.label}`);
                    }}
                    className="text-xs"
                  >
                    <span
                      className={cn(
                        "mr-2",
                        captionSelection === l.lang ? "opacity-100" : "opacity-0",
                      )}
                    >
                      •
                    </span>
                    {l.label}{" "}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {l.native}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  aria-label="Settings"
                >
                  <Settings className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-card text-foreground border-border w-52"
              >
                {/* Only shown when there is a real choice. One rendition is
                    not a quality setting. */}
                {renditions.length > 1 && (
                  <>
                    <DropdownMenuLabel className="text-xs">
                      Quality
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => selectRendition(-1)}
                      className="text-xs"
                    >
                      <span
                        className={cn(
                          "mr-2",
                          selectedLevel === -1 ? "opacity-100" : "opacity-0",
                        )}
                      >
                        •
                      </span>
                      Auto
                      {selectedLevel === -1 && activeLevel >= 0 ? (
                        <span className="ml-1 text-muted-foreground">
                          ({renditions[activeLevel]?.label})
                        </span>
                      ) : null}
                    </DropdownMenuItem>
                    {/* Highest first, the order a viewer expects. */}
                    {[...renditions].reverse().map((r) => (
                      <DropdownMenuItem
                        key={r.index}
                        onClick={() => selectRendition(r.index)}
                        className="text-xs"
                      >
                        <span
                          className={cn(
                            "mr-2",
                            selectedLevel === r.index
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        >
                          •
                        </span>
                        {r.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="bg-muted" />
                  </>
                )}
                <DropdownMenuLabel className="text-xs">Speed</DropdownMenuLabel>
                {SPEEDS.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => setSpeed(s)}
                    className="text-xs"
                  >
                    <span className={cn("mr-2", speed === s ? "opacity-100" : "opacity-0")}>
                      •
                    </span>
                    {s}x
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="icon-sm"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={togglePip}
              aria-label="Picture in picture"
            >
              <PictureInPicture2 className="size-4" />
            </Button>

            <Button
              size="icon-sm"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={toggleFullscreen}
              aria-label="Fullscreen"
            >
              {isFullscreen ? (
                <Minimize className="size-4" />
              ) : (
                <Maximize className="size-4" />
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
    </div>
  );
}
