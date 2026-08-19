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
import { FillerScreen } from "@/components/stream/filler-screen";
import { ChannelBreaks } from "@/components/stream/channel-breaks";
import { useStreamHeartbeat } from "@/hooks/use-stream-heartbeat";
import { LiveChat } from "@/components/stream/live-chat";
import { LivePolls } from "@/components/stream/live-polls";
import { InStreamShop } from "@/components/stream/in-stream-shop";
import { StreamInfo } from "@/components/stream/stream-info";
import { Button } from "@/components/ui/button";
import { MediaImage } from "@/components/ui/media-image";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Lock, ArrowLeft, Unlock, SkipForward } from "@/components/icons";
import { BackButton } from "@/components/shell/back-button";
import { PremiumPaywallModal } from "@/components/shell/premium-paywall";

export default function StreamPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { role, isPremium } = useAuth();
  const streamId = params?.id ?? "";

  const [stream, setStream] = React.useState<Stream | null | undefined>(undefined);
  const [game, setGame] = React.useState<Game | null>(null);
  const [ad, setAd] = React.useState<Ad | null>(null);
  const [adTimeLeft, setAdTimeLeft] = React.useState(5);
  const [adSkippable, setAdSkippable] = React.useState(false);
  const [adDone, setAdDone] = React.useState(false);

  // Fetch stream + game
  /**
   * The API withholds the manifest from a signed-out caller and says so. Read
   * that rather than checking `role === "guest"` here: the server made the
   * decision, and duplicating it in the client is how the two drift apart.
   */
  const requiresAuth = Boolean(
    (stream as (Stream & { requiresAuth?: boolean }) | null)?.requiresAuth,
  );

  // Counts this viewer while the stream is live and the tab is visible.
  useStreamHeartbeat(streamId, Boolean(stream?.isLive));

  /*
   * On air, off air, without a refresh.
   *
   * This page read the stream once and never again, so starting the encoder
   * changed nothing on a tab that was already open: the viewer sat on "Not
   * currently live" until they reloaded, which is not how a live channel is
   * allowed to behave. The home page already listens to this feed; the watch
   * page, which is where "Watch now" sends everyone, did not.
   *
   * `/api/sse/channel` carries the nudge and has no presence side effects, so
   * subscribing here does not touch the viewer count that `useStreamHeartbeat`
   * owns. The event is a nudge: the refetch decides what is true.
   *
   * The poll is the floor. A proxy that buffers or drops the stream would
   * otherwise leave the page exactly as stale as it was before.
   */
  React.useEffect(() => {
    if (!streamId) return;
    let cancelled = false;

    const refetch = () => {
      void getStreamById(streamId).then((s) => {
        if (!cancelled) setStream(s);
      });
    };

    const poll = setInterval(refetch, 30_000);
    if (typeof EventSource === "undefined") return () => clearInterval(poll);

    const source = new EventSource("/api/sse/channel");
    const nudge = (event: MessageEvent) => {
      if (typeof event.data === "string" && event.data.includes('"hello"')) return;
      refetch();
    };
    source.addEventListener("message", nudge);
    source.addEventListener("error", () => {});

    return () => {
      cancelled = true;
      clearInterval(poll);
      source.removeEventListener("message", nudge);
      source.close();
    };
  }, [streamId]);

  React.useEffect(() => {
    let cancelled = false;
    getStreamById(streamId).then((s) => {
      if (cancelled) return;
      setStream(s);
      // Anime, lifestyle and podcast programmes carry no game.
      if (s?.gameId) {
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
    if (isPremium) {
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
        <div className="aspect-video w-full rounded-lg bg-card " />
        <div className="mt-4 h-6 w-1/2 bg-card rounded " />
      </div>
    );
  }

  // 404
  if (stream === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Stream not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
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

  const showPaywall = stream.isPremium && !isPremium;
  const showAd = !showPaywall && ad && !adDone;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
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
          <div className="relative overflow-hidden rounded-xl border border-border bg-black">
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
              /*
               * The always-on channel gets breaks, the on-air card and filler
               * here as well as on the home page. Watching the channel from
               * /stream is the same act as watching it from the hero, and only
               * one of the two behaved like a channel.
               */
              stream.isMainChannel ? (
                <ChannelBreaks nowNext={null}>
                  <VideoPlayer
                    src={stream.hlsUrl}
                    poster={stream.thumbnailUrl}
                    autoPlay
                    isLive
                    mediaId={stream.id}
                  />
                </ChannelBreaks>
              ) : (
                <VideoPlayer
                  src={stream.hlsUrl}
                  poster={stream.thumbnailUrl}
                  autoPlay={stream.isLive}
                  isLive={stream.isLive}
                  mediaId={stream.id}
                />
              )
            ) : requiresAuth ? (
              /*
               * A guest with the link. The API withholds the manifest URL from
               * a signed-out caller, so there is nothing to play and this says
               * why rather than showing an empty box.
               *
               * The poster still renders behind it, and the title, streamer and
               * schedule are all still on the page, because the point is to ask
               * someone to sign in, not to hide that anything exists.
               */
              <div className="relative flex aspect-video w-full items-center justify-center bg-background">
                {stream.thumbnailUrl ? (
                  <MediaImage
                    src={stream.thumbnailUrl}
                    alt=""
                    seed={stream.id}
                    className="absolute inset-0 h-full w-full object-cover opacity-30"
                  />
                ) : null}
                <div className="relative flex flex-col items-center gap-3 px-6 text-center">
                  <Lock className="size-6 text-muted-foreground" />
                  <p className="text-base font-semibold text-foreground">
                    Sign in to watch
                  </p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {stream.isLive
                      ? "This broadcast is live now. Free to watch with an account."
                      : "Create a free account to watch when this goes live."}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                    <Button asChild className="bg-sky-600 hover:bg-sky-500">
                      <Link href={`/login?next=/stream/${streamId}`}>Sign in</Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="bg-card text-foreground hover:bg-accent"
                    >
                      <Link href={`/signup?next=/stream/${streamId}`}>
                        Create an account
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /*
               * Nothing to play. On the always-on channel that is exactly what
               * the filler exists for, and until now this said "Not currently
               * live" instead: the filler was mounted on the home page hero
               * only, and only for a feed that dropped while still marked live.
               */
              <FillerScreen>
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-background text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {stream.isLive ? "This stream has no video source yet" : "Not currently live"}
                  </p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    {stream.isLive
                      ? "An admin needs to set the playback URL on this stream."
                      : "Check the schedule for what is on next."}
                  </p>
                </div>
              </FillerScreen>
            )}
          </div>

          <StreamInfo stream={stream} game={game} />

          {/* Mobile-only social tabs below player */}
          <div className="lg:hidden">
            <SocialTabs streamId={streamId} />
          </div>
        </div>

        {/* Right column - desktop social panel */}
        <aside className="hidden lg:block h-[calc(100vh-5rem)] sticky top-16 rounded-xl border border-border bg-background overflow-hidden">
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
      <div className="border-b border-border px-2 py-2">
        <TabsList className="bg-card">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="polls">Polls</TabsTrigger>
          <TabsTrigger value="shop">Shop</TabsTrigger>
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
      {/* The Odds tab is gone. It held a betting-partner widget fed by the mock
          layer; once that went, the tab opened onto an empty panel, which is a
          worse answer than not offering it. */}
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
      <MediaImage src={thumb} alt={title} className="absolute inset-0 size-full object-cover opacity-40" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 px-6 text-center">
        <Badge className="bg-amber-500 text-ink">
          <Lock className="size-3" />
          Premium content
        </Badge>
        <h2 className="text-xl font-bold text-white max-w-md">{title}</h2>
        <p className="text-sm text-foreground/80 max-w-md">
          Upgrade to EVO Premium to unlock film rooms, ad-free streams, and
          exclusive analysis.
        </p>
        <Button onClick={onUpgrade} className="bg-amber-500 text-ink hover:bg-amber-400">
          <Unlock className="size-4" />
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
      <MediaImage src={ad.mediaUrl} alt={ad.advertiser} className="absolute inset-0 size-full object-cover" />
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
