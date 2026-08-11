"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Stream, Game, Ad } from "@/lib/types";
import {
  getStreamById,
  getGameById,
  pickAd,
} from "@/lib/client";
import { useAuth } from "@/components/providers";
import { VideoPlayer } from "@/components/stream/video-player";
import { LiveChat } from "@/components/stream/live-chat";
import { LivePolls } from "@/components/stream/live-polls";
import { InStreamShop } from "@/components/stream/in-stream-shop";
import { StreamInfo } from "@/components/stream/stream-info";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Lock, ArrowLeft, Sparkles, SkipForward } from "lucide-react";
import { BackButton } from "@/components/shell/back-button";
import { PremiumPaywallModal } from "@/components/shell/premium-paywall";

export default function StreamPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { role } = useAuth();
  const streamId = params?.id ?? "";

  const [stream, setStream] = React.useState<Stream | null | undefined>(undefined);
  const [game, setGame] = React.useState<Game | null>(null);
  const [ad, setAd] = React.useState<Ad | null>(null);
  const [adTimeLeft, setAdTimeLeft] = React.useState(5);
  const [adSkippable, setAdSkippable] = React.useState(false);
  const [adDone, setAdDone] = React.useState(false);

  // Fetch stream + game
  React.useEffect(() => {
    let cancelled = false;
    getStreamById(streamId).then((s) => {
      if (cancelled) return;
      setStream(s);
      if (s) {
        getGameById(s.gameId).then((g) => {
          if (!cancelled) setGame(g);
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [streamId]);

  // Preroll ad
  React.useEffect(() => {
    if (role === "premium") {
      setAdDone(true);
      return;
    }
    if (!stream) return;
    if (stream.isPremium) {
      // Paywall will be shown; skip ad
      setAdDone(true);
      return;
    }
    let cancelled = false;
    pickAd("stream_preroll").then((a: Ad | null) => {
      if (!cancelled) setAd(a);
    });
    return () => {
      cancelled = true;
    };
  }, [stream, role]);

  // Countdown ad
  React.useEffect(() => {
    if (adDone || !ad) return;
    const interval = setInterval(() => {
      setAdTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setAdDone(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    const skipTimer = setTimeout(() => setAdSkippable(true), 3000);
    return () => {
      clearInterval(interval);
      clearTimeout(skipTimer);
    };
  }, [ad, adDone]);

  // Loading
  if (stream === undefined) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="aspect-video w-full rounded-lg bg-neutral-900 animate-pulse" />
        <div className="mt-4 h-6 w-1/2 bg-neutral-900 rounded animate-pulse" />
      </div>
    );
  }

  // 404
  if (stream === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-neutral-100">Stream not found</h1>
        <p className="mt-2 text-sm text-neutral-400">
          This stream may have ended or the link is invalid.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <Button asChild>
            <Link href="/discover">Discover live streams</Link>
          </Button>
        </div>
      </div>
    );
  }

  const showPaywall = stream.isPremium && role !== "premium";
  const showAd = !showPaywall && ad && !adDone;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-neutral-950">
      <PremiumPaywallModal
        open={showPaywall}
        kind="stream"
        title={stream.title}
        subtitle="This stream is reserved for Premium subscribers. Upgrade to tune in ad-free."
      />
      <div className="mx-auto grid max-w-[1600px] gap-4 px-3 py-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Left column */}
        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <BackButton fallbackHref="/discover" />
          </div>
          <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-black">
            {showPaywall ? (
              <PaywallOverlay
                thumb={stream.thumbnailUrl}
                title={stream.title}
                onUpgrade={() => router.push("/upgrade")}
              />
            ) : showAd && ad ? (
              <PrerollAd
                ad={ad}
                timeLeft={adTimeLeft}
                skippable={adSkippable}
                onSkip={() => setAdDone(true)}
              />
            ) : stream.hlsUrl ? (
              /*
               * The real manifest. A live stream used to embed a YouTube
               * rickroll here, and an offline one played /demo/sample.mp4, so
               * the single most important screen in the product never showed
               * the actual broadcast. The URL is whatever an admin set on the
               * stream: a Cloudflare .m3u8, or a path served by our own origin.
               */
              <VideoPlayer
                src={stream.hlsUrl}
                poster={stream.thumbnailUrl}
                autoPlay={stream.isLive}
                isLive={stream.isLive}
                viewerCount={stream.viewerCount}
                mediaId={stream.id}
                gameId={stream.gameId}
              />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-neutral-950 text-center">
                <p className="text-sm font-semibold text-neutral-200">
                  {stream.isLive ? "This stream has no video source yet" : "Not currently live"}
                </p>
                <p className="max-w-sm text-xs text-neutral-500">
                  {stream.isLive
                    ? "An admin needs to set the playback URL on this stream."
                    : "Check the schedule for what is on next."}
                </p>
              </div>
            )}
          </div>

          <StreamInfo stream={stream} game={game} />

          {/* Mobile-only social tabs below player */}
          <div className="lg:hidden">
            <SocialTabs streamId={streamId} />
          </div>
        </div>

        {/* Right column - desktop social panel */}
        <aside className="hidden lg:block h-[calc(100vh-5rem)] sticky top-16 rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden">
          <SocialTabs streamId={streamId} fill />
        </aside>
      </div>
    </div>
  );
}

function SocialTabs({
  streamId,
  fill = false,
}: {
  streamId: string;
  fill?: boolean;
}) {
  return (
    <Tabs
      defaultValue="chat"
      className={fill ? "flex h-full flex-col" : "flex flex-col"}
    >
      <div className="border-b border-neutral-800 px-2 py-2">
        <TabsList className="bg-neutral-900">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="polls">Polls</TabsTrigger>
          <TabsTrigger value="shop">Shop</TabsTrigger>
          <TabsTrigger value="odds">Odds</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent
        value="chat"
        className={fill ? "flex-1 min-h-0 mt-0" : "h-[520px] mt-0"}
      >
        <LiveChat streamId={streamId} />
      </TabsContent>
      <TabsContent
        value="polls"
        className={fill ? "flex-1 min-h-0 mt-0 overflow-hidden" : "h-[520px] mt-0 overflow-hidden"}
      >
        <LivePolls streamId={streamId} />
      </TabsContent>
      <TabsContent
        value="shop"
        className={fill ? "flex-1 min-h-0 mt-0 overflow-hidden" : "h-[520px] mt-0 overflow-hidden"}
      >
        <InStreamShop />
      </TabsContent>
      <TabsContent
        value="odds"
        className={fill ? "flex-1 min-h-0 mt-0 overflow-hidden" : "h-[520px] mt-0 overflow-hidden"}
      >
      </TabsContent>
    </Tabs>
  );
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
        <Badge className="bg-amber-500 text-black">
          <Lock className="size-3" />
          Premium content
        </Badge>
        <h2 className="text-xl font-bold text-white max-w-md">{title}</h2>
        <p className="text-sm text-neutral-300 max-w-md">
          Upgrade to EVO Premium to unlock film rooms, ad-free streams, and
          exclusive analysis.
        </p>
        <Button onClick={onUpgrade} className="bg-amber-500 text-black hover:bg-amber-400">
          <Sparkles className="size-4" />
          Upgrade with Paystack
        </Button>
      </div>
    </div>
  );
}

function PrerollAd({
  ad,
  timeLeft,
  skippable,
  onSkip,
}: {
  ad: Ad;
  timeLeft: number;
  skippable: boolean;
  onSkip: () => void;
}) {
  return (
    <div className="relative aspect-video w-full bg-black">
      <Image src={ad.mediaUrl} alt={ad.advertiser} fill className="object-cover" />
      <div className="absolute top-3 left-3 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white">
        Ad · {ad.advertiser}
      </div>
      <div className="absolute bottom-3 right-3">
        {skippable ? (
          <Button size="sm" onClick={onSkip} className="bg-black/80 text-white hover:bg-black">
            <SkipForward className="size-4" />
            Skip ad
          </Button>
        ) : (
          <div className="rounded bg-black/70 px-3 py-1.5 text-xs text-white">
            Skip in {Math.max(0, 3 - (5 - timeLeft))}s
          </div>
        )}
      </div>
      <div className="absolute bottom-3 left-3 rounded bg-black/70 px-2 py-1 text-xs text-white">
        Resumes in {timeLeft}s
      </div>
    </div>
  );
}
