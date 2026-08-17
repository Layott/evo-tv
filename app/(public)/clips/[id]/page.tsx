"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Clip } from "@/lib/types";
import { getClipById, listTrendingClips } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  AlertTriangle,
  RefreshCw,
} from "@/components/icons";
import { toast } from "sonner";
import { FollowButton } from "@/components/stream/follow-button";
import { cn } from "@/lib/utils";

function relTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function ClipDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clipId = params?.id ?? "";

  const [clip, setClip] = React.useState<Clip | null | undefined>(undefined);
  const [feed, setFeed] = React.useState<Clip[]>([]);
  const [muted, setMuted] = React.useState(true);
  const [playing, setPlaying] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [likeCount, setLikeCount] = React.useState(0);
  const [liked, setLiked] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Load current + feed
  React.useEffect(() => {
    let cancelled = false;
    getClipById(clipId).then((c) => {
      if (cancelled) return;
      setClip(c);
      if (c) setLikeCount(c.likeCount);
    });
    listTrendingClips(24).then((list) => {
      if (!cancelled) setFeed(list);
    });
    return () => {
      cancelled = true;
    };
  }, [clipId]);

  const idx = React.useMemo(
    () => feed.findIndex((c) => c.id === clipId),
    [feed, clipId]
  );
  const prev = idx > 0 ? feed[idx - 1] : null;
  const next = idx >= 0 && idx < feed.length - 1 ? feed[idx + 1] : null;

  const go = React.useCallback(
    (dir: "prev" | "next") => {
      const target = dir === "prev" ? prev : next;
      if (target) router.push(`/clips/${target.id}`);
    },
    [prev, next, router]
  );

  // Keyboard navigation
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        go("prev");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        go("next");
      } else if (e.key === " ") {
        e.preventDefault();
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) v.play().catch(() => setError(true));
        else v.pause();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [go]);

  // Swipe
  const touchY = React.useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchY.current = e.touches[0]?.clientY ?? null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchY.current == null) return;
    const endY = e.changedTouches[0]?.clientY ?? touchY.current;
    const dy = endY - touchY.current;
    touchY.current = null;
    if (dy < -60) go("next");
    else if (dy > 60) go("prev");
  };

  // Wire up video
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    setError(false);
    setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onErr = () => {
      setError(true);
      setLoading(false);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("error", onErr);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("error", onErr);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [clip?.mp4Url]);

  if (clip === undefined) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-ink">
        <div className="h-full aspect-[9/16] rounded-xl bg-card " />
      </div>
    );
  }

  if (clip === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Clip not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This clip may have been removed.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <Button asChild>
            <Link href="/clips">Browse clips</Link>
          </Button>
        </div>
      </div>
    );
  }

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v || error) return;
    if (v.paused) v.play().catch(() => setError(true));
    else v.pause();
  };

  const toggleMute = () => setMuted((v) => !v);

  const toggleLike = () => {
    setLiked((prev) => {
      setLikeCount((c) => (prev ? Math.max(0, c - 1) : c + 1));
      toast[prev ? "message" : "success"](prev ? "Like removed" : "Liked");
      return !prev;
    });
  };

  const onShare = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.clipboard && url) {
      navigator.clipboard
        .writeText(url)
        .then(() => toast.success("Link copied"))
        .catch(() => toast.error("Could not copy"));
    } else {
      toast.message("Share unavailable");
    }
  };

  const creatorId = `streamer_${clip.creatorHandle}`;

  return (
    <div
      className="relative mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center bg-ink"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Back button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 left-3 z-40 text-white hover:bg-white/10"
        onClick={() => router.back()}
        aria-label="Back"
      >
        <ArrowLeft className="size-5" />
      </Button>

      {/* Prev/Next controls */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2">
        <Button
          variant="secondary"
          size="icon"
          disabled={!prev}
          onClick={() => go("prev")}
          aria-label="Previous clip"
          className="rounded-full bg-black/60 text-white hover:bg-black/80"
        >
          <ChevronUp className="size-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          disabled={!next}
          onClick={() => go("next")}
          aria-label="Next clip"
          className="rounded-full bg-black/60 text-white hover:bg-black/80"
        >
          <ChevronDown className="size-5" />
        </Button>
      </div>

      {/* Video stage */}
      <div className="relative aspect-[9/16] h-[calc(100vh-5rem)] max-h-[920px] w-auto max-w-[100vw] overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          src={clip.mp4Url}
          poster={clip.thumbnailUrl}
          autoPlay
          playsInline
          loop
          muted={muted}
          onClick={togglePlay}
          className="absolute inset-0 h-full w-full object-cover bg-black cursor-pointer"
        />

        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="size-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
            <AlertTriangle className="size-10 text-amber-400" />
            <div className="text-sm font-semibold text-white">
              Demo video unavailable
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setError(false);
                setLoading(true);
                videoRef.current?.load();
              }}
            >
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          </div>
        )}

        {!playing && !loading && !error && (
          <button
            aria-label="Play"
            onClick={togglePlay}
            className="absolute inset-0 z-10 flex items-center justify-center"
          >
            <div className="size-16 rounded-full bg-black/70 flex items-center justify-center">
              <Play className="size-8 text-white ml-1" fill="white" />
            </div>
          </button>
        )}

        {/* Top-right controls */}
        <div className="absolute top-3 right-3 z-20 flex gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-white bg-black/50 hover:bg-black/70 rounded-full"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-white bg-black/50 hover:bg-black/70 rounded-full"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
        </div>

        {/* Creator overlay */}
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/70 to-transparent p-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Avatar className="size-9">
                  <AvatarImage
                    src={clip.creatorAvatarUrl}
                    alt={clip.creatorHandle}
                  />
                  <AvatarFallback>
                    {clip.creatorHandle.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    @{clip.creatorHandle}
                  </div>
                  <div className="text-[11px] text-foreground/80">
                    {relTime(clip.createdAt)}
                  </div>
                </div>
                <FollowButton
                  targetType="streamer"
                  targetId={creatorId}
                  targetLabel={`@${clip.creatorHandle}`}
                  className="ml-2"
                />
              </div>
              <p className="mt-2 text-sm text-white line-clamp-3">
                {clip.title}
              </p>
            </div>
          </div>
        </div>

        {/* Action rail */}
        <div className="absolute bottom-24 right-3 z-20 flex flex-col items-center gap-3">
          <ActionButton
            label={likeCount.toLocaleString()}
            active={liked}
            activeClass="text-red-400"
            onClick={toggleLike}
          >
            <Heart className={cn("size-6", liked && "fill-red-400")} />
          </ActionButton>
          <ActionButton
            label="Comment"
            onClick={() => toast.message("Comments opened")}
          >
            <MessageCircle className="size-6" />
          </ActionButton>
          <ActionButton label="Share" onClick={onShare}>
            <Share2 className="size-6" />
          </ActionButton>
          <ActionButton
            label={saved ? "Saved" : "Save"}
            active={saved}
            activeClass="text-amber-300"
            onClick={() => {
              setSaved((v) => !v);
              toast.success(saved ? "Removed from saved" : "Saved");
            }}
          >
            <Bookmark className={cn("size-6", saved && "fill-amber-300")} />
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  label,
  onClick,
  active,
  activeClass,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  activeClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 text-white"
    >
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-full bg-black/60 hover:bg-black/80 transition",
          active && activeClass
        )}
      >
        {children}
      </span>
      <span className="text-[10px] font-medium text-white">{label}</span>
    </button>
  );
}
