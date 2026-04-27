"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Radio, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getStreamById } from "@/lib/mock";
import { listCoStreamTracks, type CoStreamTrack } from "@/lib/mock/co-streams";
import { RICK_ROLL_EMBED_URL } from "@/lib/mock/_media";
import type { Stream } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/shell/back-button";
import { TrackList } from "@/components/co-streams/track-list";
import { NowPlayingBanner } from "@/components/co-streams/now-playing-banner";

export default function CoStreamPage() {
  const params = useParams<{ id: string }>();
  const streamId = params?.id ?? "";

  const [stream, setStream] = React.useState<Stream | null | undefined>(undefined);
  const [tracks, setTracks] = React.useState<CoStreamTrack[]>([]);
  const [tracksLoading, setTracksLoading] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void getStreamById(streamId).then((s) => {
      if (!cancelled) setStream(s);
    });
    return () => {
      cancelled = true;
    };
  }, [streamId]);

  React.useEffect(() => {
    if (!streamId) return;
    let cancelled = false;
    setTracksLoading(true);
    void listCoStreamTracks(streamId).then((t) => {
      if (cancelled) return;
      setTracks(t);
      // Default to the official track (index 0).
      const official = t.find((x) => x.isOfficial) ?? t[0] ?? null;
      if (official) setSelectedId(official.id);
      setTracksLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [streamId]);

  function handleSelect(track: CoStreamTrack) {
    setSelectedId(track.id);
    if (track.isOfficial) {
      toast.message("Switched to official tournament audio");
    } else {
      toast.success(`Switched to commentary by ${track.displayName}`);
    }
  }

  // Loading
  if (stream === undefined) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 h-6 w-24 animate-pulse rounded bg-neutral-900" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="aspect-video animate-pulse rounded-xl bg-neutral-900" />
          <div className="h-[520px] animate-pulse rounded-xl bg-neutral-900" />
        </div>
      </div>
    );
  }

  // 404
  if (stream === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-neutral-100">Stream not found</h1>
        <p className="mt-1 text-sm text-neutral-400">
          The stream may have ended or the link is invalid.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button asChild variant="outline" className="border-neutral-800">
            <Link href="/discover">
              <ArrowLeft className="size-3.5" />
              Back to discover
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const selected = tracks.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-neutral-950">
      <div className="mx-auto grid max-w-[1600px] gap-4 px-3 py-4 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_460px]">
        {/* Left — main feed */}
        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <BackButton fallbackHref={`/stream/${streamId}`} label="Back to stream" />
            <Button asChild size="sm" variant="outline" className="border-neutral-800">
              <Link href={`/stream/${streamId}`}>Standard view</Link>
            </Button>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-black">
            <div className="relative aspect-video w-full">
              <iframe
                src={RICK_ROLL_EMBED_URL}
                title={stream.title}
                className="absolute inset-0 h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded bg-red-600/90 px-2 py-1 text-xs font-bold uppercase tracking-wider text-white">
                <span className="size-1.5 animate-pulse rounded-full bg-white" />
                Live
              </div>
              <div className="pointer-events-none absolute right-3 top-3 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
                {stream.viewerCount.toLocaleString()} watching
              </div>
              <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                <div className="rounded-md bg-black/70 px-2.5 py-1.5 backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-400">
                    Video feed
                  </p>
                  <p className="text-xs font-semibold text-neutral-100">
                    Tournament broadcast
                  </p>
                </div>
                {selected ? (
                  <div className="rounded-md bg-black/70 px-2.5 py-1.5 backdrop-blur-sm">
                    <p className="text-[10px] uppercase tracking-wider text-sky-300">
                      Audio mux
                    </p>
                    <p className="text-xs font-semibold text-neutral-100">
                      {selected.displayName}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {selected ? <NowPlayingBanner track={selected} /> : null}

          <section className="space-y-2">
            <h1 className="text-xl font-bold leading-tight text-neutral-50 md:text-2xl">
              {stream.title}
            </h1>
            <p className="text-sm text-neutral-400">{stream.description}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="bg-neutral-800 text-neutral-100">
                Co-stream mode
              </Badge>
              <Badge variant="outline" className="text-[10px] uppercase">
                {stream.language}
              </Badge>
              {stream.tags.slice(0, 4).map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-xs text-neutral-300">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 size-4 text-sky-400" />
              <div>
                <p className="font-semibold text-neutral-100">How co-stream works</p>
                <p className="mt-1 text-neutral-400">
                  The video feed stays the same — you swap audio between the official
                  tournament call and creator commentary in real time. Try a few until
                  you find your vibe.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Right — creator picker */}
        <aside className="rounded-xl border border-neutral-800 bg-neutral-950">
          <div className="border-b border-neutral-800 p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
                <Radio className="size-4 text-sky-400" />
                Commentary tracks
              </h2>
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                {tracks.length} live
              </span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">
              Pick a creator's audio to play over this match.
            </p>
          </div>
          <div className="p-3">
            {tracksLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[68px] animate-pulse rounded-xl bg-neutral-900"
                  />
                ))}
              </div>
            ) : tracks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/30 p-6 text-center text-xs text-neutral-500">
                No co-streams available for this match.
              </div>
            ) : (
              <TrackList tracks={tracks} selectedId={selectedId} onSelect={handleSelect} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
