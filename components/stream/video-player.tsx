"use client";

import * as React from "react";
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
  Sparkles,
} from "lucide-react";
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
import {
} from "@/lib/client/player-features";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  isLive?: boolean;
  viewerCount?: number;
  chapters?: { label: string; startSec: number }[];
  onTimeUpdate?: (currentSec: number) => void;
  onReady?: (video: HTMLVideoElement) => void;
  className?: string;
  /** id used for captions/AI track lookup; uses src if omitted */
  mediaId?: string;
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

export function VideoPlayer({
  src,
  poster,
  autoPlay,
  isLive,
  viewerCount,
  chapters,
  onTimeUpdate,
  onReady,
  className,
  mediaId,
}: VideoPlayerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
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
        // Sit ~12s behind the edge instead of ~6s.
        liveSyncDurationCount: 6,
        /*
         * How far behind hls.js tolerates before it seeks the viewer forward.
         *
         * This is counted in fragments, so at 2s fragments the value of 20 it
         * held meant a 40 second ceiling: scrubbing further back than that was
         * silently undone within a couple of seconds, which is exactly what
         * "the slider does not work" looked like. Measured on the live stream,
         * 20s and 35s back held and 60s and 150s were both dragged back to
         * about 13s behind.
         *
         * nginx keeps a 300s DVR window, which is 150 fragments, so anything
         * below that fights the scrub bar. 200 clears the whole window with
         * headroom, and being behind is then the viewer's choice rather than
         * something the player overrides. The "Go live" control is how they
         * come back.
         *
         * Keep this above `hls_playlist_length / hls_fragment` whenever either
         * of those changes in nginx.conf.
         */
        liveMaxLatencyDurationCount: 200,
        // Buffer ahead aggressively when bandwidth allows.
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        /*
         * Keep the whole DVR window behind the playhead, not part of it.
         *
         * This was 90s while nginx serves a 300s window, so hls.js evicted
         * everything older than 90 seconds and a seek further back than that
         * landed on data it no longer held. Offering five minutes of rewind
         * while retaining ninety seconds of it is the kind of mismatch that
         * makes a scrub bar feel arbitrary: near seeks work, far ones do not.
         *
         * Memory cost is bounded by the window, and the window is bounded by
         * hls_playlist_length. At 2.8 Mbps, 300s is roughly 105 MB, which is
         * acceptable for a tab that is deliberately watching a broadcast.
         */
        backBufferLength: 300,
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
        if (autoPlay) {
          void videoRef.current?.play().catch(() => {
            const v = videoRef.current;
            if (!v) return;
            v.muted = true;
            setMuted(true);
            void v.play().catch(() => {});
          });
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
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src, autoPlay]);
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
   * The DVR window: what a live stream can actually be scrubbed across.
   *
   * `duration` is Infinity while live, so the scrub bar had nothing to bind to
   * and was simply disabled. nginx now keeps a five minute playlist, so there
   * is a real window to move around in, and it moves forward continuously as
   * old segments age out.
   */
  const [seekStart, setSeekStart] = React.useState(0);
  const [seekEnd, setSeekEnd] = React.useState(0);
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
      // Frozen while dragging. The live window slides forward continuously, so
      // updating min and max mid-gesture moves the whole scale under the
      // pointer and the handle appears to drift on its own.
      if (v.seekable.length > 0 && !scrubbingRef.current) {
        setSeekStart(v.seekable.start(0));
        setSeekEnd(v.seekable.end(v.seekable.length - 1));
      }
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
  }, []);

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

  /** Seconds behind the live edge. Zero when watching live or not live. */
  const behindLiveSec = isLive && seekEnd > 0 ? Math.max(0, seekEnd - currentTime) : 0;

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
    // Never land exactly on the live edge: that position has no buffered data
    // yet, so it re-buffers immediately and looks like a failed seek.
    const max = isLive && seekEnd > 0 ? Math.max(seekStart, seekEnd - 0.5) : next;
    const target = isLive ? Math.min(next, max) : next;
    v.currentTime = target;
    // Reflect it immediately rather than waiting for the next timeupdate, so
    // the handle does not jump back for a frame after release.
    setCurrentTime(target);
  };

  /** Jump back to the live edge after scrubbing into the DVR window. */
  const goLive = React.useCallback(() => {
    const v = videoRef.current;
    if (!v || v.seekable.length === 0) return;
    v.currentTime = Math.max(0, v.seekable.end(v.seekable.length - 1) - 0.5);
    void v.play().catch(() => {});
  }, []);

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
        ref={videoRef}
        /* No `src` here: the effect above assigns it, or hands the element to
           hls.js. Setting both makes the browser fetch the manifest twice and
           race hls.js for the media element. */
        poster={poster}
        autoPlay={autoPlay}
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
          <p className="text-sm font-medium text-neutral-200">{hlsError}</p>
          <p className="text-xs text-neutral-500">
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
          className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-black/90"
        >
          <VolumeX className="size-4" />
          Tap for sound
        </button>
      ) : null}

      {/* Live badge + viewers + AI badge */}
      {isLive && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
            <span className="size-2 rounded-full bg-white animate-pulse" />
            Live
          </div>
          {typeof viewerCount === "number" && (
            <div className="rounded-md bg-black/70 backdrop-blur px-2 py-0.5 text-xs text-white">
              {viewerCount.toLocaleString()} watching
            </div>
          )}
        </div>
      )}

      {/* Caption strip (bottom-third) */}
      {captionsOn && captionLines.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-6">
          <div
            key={captionLineIndex}
            className="max-w-2xl rounded bg-black/75 px-3 py-1.5 text-center text-sm text-white shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-1 duration-300 sm:text-base"
          >
            {captionSelection === "auto" ? (
              <span className="mr-2 rounded bg-amber-500/30 px-1 text-[10px] uppercase tracking-wider text-amber-200">
                AUTO
              </span>
            ) : null}
            {captionLines[captionLineIndex]}
          </div>
        </div>
      )}

      {/* Loading spinner */}
      {loading && !error && (
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
          <p className="text-xs text-neutral-400 max-w-xs">
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
      {!playing && !loading && !error && (
        <button
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 z-10 flex items-center justify-center"
        >
          <div className="size-16 rounded-full bg-white/15 backdrop-blur flex items-center justify-center hover:bg-white/25 transition">
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
        {/* Scrub bar */}
        <div className="relative px-1">
          {/* Bound to the DVR window when live, to duration otherwise.
              This was `disabled={error || isLive}`: correct when the playlist
              held ten seconds and there was nothing to scrub, wrong now that it
              holds five minutes. Dragging did nothing at all. */}
          <Slider
            value={[
              scrubValue !== null
                ? scrubValue
                : isLive
                  ? Math.min(Math.max(currentTime, seekStart), seekEnd || seekStart + 1)
                  : Math.min(currentTime, duration || 0),
            ]}
            min={isLive ? seekStart : 0}
            max={isLive ? seekEnd || seekStart + 1 : duration || 1}
            step={0.1}
            onValueChange={handleScrub}
            onValueCommit={handleSeekCommit}
            className="w-full"
            disabled={error || (isLive && seekEnd - seekStart < 5)}
          />
          {/* Chapter ticks */}
          {chapters && chapters.length > 0 && duration > 0 && (
            <div className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 h-2">
              {chapters.map((c, i) => (
                <div
                  key={`${c.label}-${i}`}
                  className="absolute top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-amber-300 ring-1 ring-black"
                  style={{ left: `${Math.min(100, (c.startSec / duration) * 100)}%` }}
                  title={c.label}
                />
              ))}
            </div>
          )}
        </div>

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

          {/* Skip back and forward. `seekBy` existed but was reachable only
              from the arrow keys, so on a phone there was no way to do it at
              all. On a live stream these move inside the DVR window the
              manifest retains; at the live edge, forward simply does nothing. */}
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

          <span className="ml-1 text-xs font-mono text-white tabular-nums">
            {isLive ? (
              /* Behind the edge after scrubbing back, this says so and offers
                 the way back. A static "LIVE" while watching two minutes in the
                 past is simply untrue. */
              behindLiveSec > 5 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goLive();
                  }}
                  className="flex items-center gap-1.5 text-neutral-300 transition-colors hover:text-white"
                >
                  <span className="size-1.5 rounded-full bg-neutral-500" />
                  {formatTime(behindLiveSec)} behind
                  <span className="ml-1 underline underline-offset-2">
                    Go live
                  </span>
                </button>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-red-500" />
                  LIVE
                </span>
              )
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
                className="bg-neutral-900 text-neutral-100 border-neutral-800 w-52"
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
                <DropdownMenuSeparator className="bg-neutral-800" />
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
                    <span className="ml-auto text-[10px] text-neutral-500">
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
                className="bg-neutral-900 text-neutral-100 border-neutral-800 w-52"
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
                        <span className="ml-1 text-neutral-500">
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
                    <DropdownMenuSeparator className="bg-neutral-800" />
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
