"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Vod } from "@/lib/types";
import { getVodById, listRelatedVods } from "@/lib/client";
import { useAuth } from "@/components/providers";
import { BackButton } from "@/components/shell/back-button";
import { PremiumPaywallModal } from "@/components/shell/premium-paywall";
import { VodPlayer } from "@/components/vod/vod-player";
import { VodChapters } from "@/components/vod/vod-chapters";
import { VodRelated } from "@/components/vod/vod-related";
import { VodComments } from "@/components/vod/vod-comments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ThumbsUp,
  ThumbsDown,
  Share2,
  BookmarkPlus,
  ArrowLeft,
  Lock,
  Unlock,
  Eye,
} from "@/components/icons";
import { toast } from "sonner";

function relTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function VodPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { role } = useAuth();
  const vodId = params?.id ?? "";

  const [vod, setVod] = React.useState<Vod | null | undefined>(undefined);
  const [related, setRelated] = React.useState<Vod[]>([]);
  const [currentSec, setCurrentSec] = React.useState(0);
  const [likes, setLikes] = React.useState(0);
  const [dislikes, setDislikes] = React.useState(0);
  const [liked, setLiked] = React.useState(false);
  const [disliked, setDisliked] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const seekRef = React.useRef<((sec: number) => void) | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getVodById(vodId).then((v) => {
      if (cancelled) return;
      setVod(v);
      if (v) setLikes(v.likeCount);
    });
    listRelatedVods(vodId, 6).then((rel) => {
      if (!cancelled) setRelated(rel);
    });
    return () => {
      cancelled = true;
    };
  }, [vodId]);

  if (vod === undefined) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="aspect-video w-full rounded-lg bg-card " />
        <div className="mt-4 h-6 w-1/2 bg-card rounded " />
      </div>
    );
  }

  if (vod === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">VOD not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This video may have been removed.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <Button asChild>
            <Link href="/discover">Browse VODs</Link>
          </Button>
        </div>
      </div>
    );
  }

  const paywalled = vod.isPremium && role !== "premium";

  const onLike = () => {
    if (liked) {
      setLiked(false);
      setLikes((v) => Math.max(0, v - 1));
    } else {
      setLiked(true);
      setLikes((v) => v + 1);
      if (disliked) {
        setDisliked(false);
        setDislikes((v) => Math.max(0, v - 1));
      }
      toast.success("Liked");
    }
  };
  const onDislike = () => {
    if (disliked) {
      setDisliked(false);
      setDislikes((v) => Math.max(0, v - 1));
    } else {
      setDisliked(true);
      setDislikes((v) => v + 1);
      if (liked) {
        setLiked(false);
        setLikes((v) => Math.max(0, v - 1));
      }
      toast.message("Feedback recorded");
    }
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
  const onSave = () => {
    setSaved((v) => {
      toast.success(v ? "Removed from library" : "Saved to library");
      return !v;
    });
  };

  const jumpTo = (sec: number) => {
    seekRef.current?.(sec);
    setCurrentSec(sec);
    toast.message(`Jumped to ${formatClock(sec)}`);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <PremiumPaywallModal
        open={paywalled}
        kind="vod"
        title={vod.title}
      />
      <div className="mx-auto max-w-[1600px] grid gap-6 px-3 py-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left column */}
        <div className="min-w-0 space-y-5">
          <div className="flex items-center justify-between">
            <BackButton fallbackHref="/library" />
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-black">
            {paywalled ? (
              <PaywallOverlay
                thumb={vod.thumbnailUrl}
                title={vod.title}
                onUpgrade={() => router.push("/upgrade")}
              />
            ) : (
              <VodPlayer
                vod={vod}
                onTimeUpdate={setCurrentSec}
                seekRef={seekRef}
              />
            )}
          </div>

          {/* Title + meta */}
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight">
              {vod.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="size-3.5" />
                {vod.viewCount.toLocaleString()} views
              </span>
              <span>·</span>
              <span>{relTime(vod.publishedAt)}</span>
              {vod.isPremium && (
                <Badge className="bg-amber-500 text-ink">Premium</Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-full bg-card border border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={onLike}
                className="rounded-full"
              >
                <ThumbsUp
                  className={liked ? "size-4 fill-sky-400 text-sky-400" : "size-4"}
                />
                {likes.toLocaleString()}
              </Button>
              <Separator orientation="vertical" className="h-5 bg-muted" />
              <Button
                variant="ghost"
                size="sm"
                onClick={onDislike}
                className="rounded-full"
              >
                <ThumbsDown
                  className={disliked ? "size-4 fill-red-400 text-red-400" : "size-4"}
                />
                {dislikes > 0 ? dislikes.toLocaleString() : ""}
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={onShare}>
              <Share2 className="size-4" />
              Share
            </Button>
            <Button
              variant={saved ? "default" : "outline"}
              size="sm"
              onClick={onSave}
            >
              <BookmarkPlus className="size-4" />
              {saved ? "Saved" : "Save"}
            </Button>
          </div>

          {/* Description */}
          {vod.description && (
            <div className="rounded-lg border border-border bg-card/50 p-3 text-sm text-foreground/80">
              {vod.description}
            </div>
          )}

          {/* Mobile chapters */}
          <div className="lg:hidden">
            <VodChapters
              chapters={vod.chapters}
              currentSec={currentSec}
              onJump={jumpTo}
            />
          </div>

          <VodRelated vods={related} />

          <Separator className="bg-muted" />

          <VodComments vodId={vod.id} />
        </div>

        {/* Right column */}
        <aside className="hidden lg:block space-y-4">
          <VodChapters
            chapters={vod.chapters}
            currentSec={currentSec}
            onJump={jumpTo}
          />
        </aside>
      </div>
    </div>
  );
}

function formatClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function PaywallOverlay({
  thumb,
  title,
  onUpgrade,
}: {
  thumb: string;
  title: string;
  onUpgrade: () => void;
}) {
  return (
    <div className="relative aspect-video w-full">
      <Image src={thumb} alt={title} fill className="object-cover opacity-40" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 px-6 text-center">
        <Badge className="bg-amber-500 text-ink">
          <Lock className="size-3" />
          Premium VOD
        </Badge>
        <h2 className="text-xl font-bold text-white max-w-md">{title}</h2>
        <p className="text-sm text-foreground/80 max-w-md">
          Unlock archives and deep-dive VODs with EVO Premium.
        </p>
        <Button
          onClick={onUpgrade}
          className="bg-amber-500 text-ink hover:bg-amber-400"
        >
          <Unlock className="size-4" />
          Upgrade with Paystack
        </Button>
      </div>
    </div>
  );
}
