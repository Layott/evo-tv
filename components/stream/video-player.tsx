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
import { toast } from "sonner";
import {
  getCaptionPhrasesSync,
  listCaptionLanguages,
  type CaptionLang,
} from "@/lib/mock/captions";
import {
  getAiCommentaryConfig,
  setAiCommentaryConfig,
  getCommentaryLines,
  type AiCommentaryConfig,
} from "@/lib/mock/ai-commentary";

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
  /** game id for AI commentary line cycling */
  gameId?: string;
}

const QUALITIES = ["auto", "1080p", "720p", "480p", "360p"] as const;
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
  gameId,
}: VideoPlayerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const controlsTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [volume, setVolume] = React.useState(1);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [quality, setQuality] = React.useState<(typeof QUALITIES)[number]>("auto");
  const [captionSelection, setCaptionSelection] =
    React.useState<CaptionSelection>("off");
  const [captionLineIndex, setCaptionLineIndex] = React.useState(0);
  const [speed, setSpeed] = React.useState<number>(1);
  const [showControls, setShowControls] = React.useState(true);
  const [aiCommentaryOn, setAiCommentaryOn] = React.useState(false);
  const [aiConfig, setAiConfig] = React.useState<AiCommentaryConfig | null>(null);
  const [aiLineIndex, setAiLineIndex] = React.useState(0);
  const [aiLineKey, setAiLineKey] = React.useState(0);

  const captionLangs = React.useMemo(() => listCaptionLanguages(), []);
  const captionsOn = captionSelection !== "off";
  const captionLines = React.useMemo(() => {
    if (!captionsOn) return [];
    const lang: CaptionLang =
      captionSelection === "auto" ? "en" : (captionSelection as CaptionLang);
    return getCaptionPhrasesSync(lang);
  }, [captionsOn, captionSelection]);
  const aiLines = React.useMemo(
    () => getCommentaryLines(gameId ?? "game_freefire"),
    [gameId],
  );

  // Cycle the on-screen caption strip every ~3s while captions are on.
  React.useEffect(() => {
    if (!captionsOn || captionLines.length === 0) return;
    const id = window.setInterval(() => {
      setCaptionLineIndex((i) => (i + 1) % captionLines.length);
    }, 3000);
    return () => window.clearInterval(id);
  }, [captionsOn, captionLines.length]);

  // Hydrate AI config (preserves user's voice/language choices from settings).
  React.useEffect(() => {
    let cancelled = false;
    const id = mediaId ?? null;
    getAiCommentaryConfig(id).then((cfg) => {
      if (!cancelled) {
        setAiConfig(cfg);
        if (cfg.enabled) setAiCommentaryOn(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mediaId]);

  // Cycle AI commentary lines every ~4s when enabled.
  React.useEffect(() => {
    if (!aiCommentaryOn || aiLines.length === 0) return;
    const id = window.setInterval(() => {
      setAiLineIndex((i) => (i + 1) % aiLines.length);
      setAiLineKey((k) => k + 1);
    }, 4000);
    return () => window.clearInterval(id);
  }, [aiCommentaryOn, aiLines.length]);

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
  }, []);

  const adjustVolume = React.useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = Math.min(1, Math.max(0, v.volume + delta));
    if (v.volume > 0) v.muted = false;
  }, []);

  const seekBy = React.useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(v.duration || 0, Math.max(0, v.currentTime + delta));
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

  const handleSeek = (values: number[]) => {
    const v = videoRef.current;
    const next = values[0];
    if (v && typeof next === "number") v.currentTime = next;
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
        ref={videoRef}
        src={src}
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
          {aiCommentaryOn && (
            <div className="flex items-center gap-1 rounded-md bg-violet-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white animate-pulse">
              <Sparkles className="size-2.5" />
              AI
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
          <Slider
            value={[Math.min(currentTime, duration || 0)]}
            min={0}
            max={duration || 1}
            step={0.1}
            onValueChange={handleSeek}
            className="w-full"
            disabled={error || isLive}
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
            {isLive ? "LIVE" : `${formatTime(currentTime)} / ${formatTime(duration)}`}
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
                  className={cn(
                    "text-white hover:bg-white/10",
                    aiCommentaryOn && "bg-white/10",
                  )}
                  aria-label="Settings"
                >
                  <Settings className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-neutral-900 text-neutral-100 border-neutral-800 w-52"
              >
                <DropdownMenuLabel className="text-xs">Quality</DropdownMenuLabel>
                {QUALITIES.map((q) => (
                  <DropdownMenuItem
                    key={q}
                    onClick={() => setQuality(q)}
                    className="text-xs"
                  >
                    <span className={cn("mr-2", quality === q ? "opacity-100" : "opacity-0")}>
                      •
                    </span>
                    {q}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-neutral-800" />
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
                <DropdownMenuSeparator className="bg-neutral-800" />
                <DropdownMenuCheckboxItem
                  checked={aiCommentaryOn}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(checked) => {
                    const next = Boolean(checked);
                    setAiCommentaryOn(next);
                    setAiConfig((prev) => (prev ? { ...prev, enabled: next } : prev));
                    setAiCommentaryConfig({ enabled: next }, mediaId ?? null).catch(
                      () => {},
                    );
                    toast.message(
                      next
                        ? "AI Commentary on (beta) — settings: Settings → Playback"
                        : "AI Commentary off",
                    );
                  }}
                  className="text-xs"
                >
                  <Sparkles className="mr-2 size-3.5 text-violet-400" />
                  AI Commentary (beta)
                </DropdownMenuCheckboxItem>
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
      {aiCommentaryOn ? (
        <div className="flex items-start gap-2 border-x border-b border-violet-500/30 bg-gradient-to-r from-violet-950/50 via-neutral-950 to-violet-950/50 px-3 py-2 text-xs text-neutral-200">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-violet-400 animate-pulse" />
          <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
            AI · {aiConfig?.voicePreset === "hype-male" ? "Hype" : "Analyst"}
          </span>
          <span
            key={aiLineKey}
            className="min-w-0 flex-1 truncate animate-in fade-in slide-in-from-left-2 duration-500"
          >
            {aiLines[aiLineIndex] ?? "Listening to the match…"}
          </span>
        </div>
      ) : null}
    </div>
  );
}
