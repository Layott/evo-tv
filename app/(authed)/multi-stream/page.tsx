"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Grid2x2,
  Layers,
  RefreshCw,
  Volume2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { listLiveStreams } from "@/lib/client";
import type { Stream } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/shell/back-button";
import { SelectableCard } from "@/components/multi-stream/selectable-card";
import { StreamTile } from "@/components/multi-stream/stream-tile";
import { cn } from "@/lib/utils";

const MAX_STREAMS = 4;

export default function MultiStreamPage() {
  const [streams, setStreams] = React.useState<Stream[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [audioId, setAudioId] = React.useState<string | null>(null);
  const [view, setView] = React.useState<"browse" | "watch">("browse");
  const [gameFilter, setGameFilter] = React.useState<string>("all");

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listLiveStreams().then((s) => {
      if (!cancelled) {
        setStreams(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = React.useMemo(
    () =>
      selectedIds
        .map((id) => streams.find((s) => s.id === id))
        .filter((s): s is Stream => Boolean(s)),
    [selectedIds, streams],
  );

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        // If we removed the audio source, fall back to first remaining tile.
        if (audioId === id) {
          setAudioId(next[0] ?? null);
        }
        return next;
      }
      if (prev.length >= MAX_STREAMS) {
        toast.error(`Stadium mode caps at ${MAX_STREAMS} streams. Remove one first.`);
        return prev;
      }
      const next = [...prev, id];
      // If this is the first selection, make it the audio source by default.
      if (prev.length === 0) {
        setAudioId(id);
      }
      return next;
    });
  }

  function removeFromGrid(id: string) {
    setSelectedIds((prev) => {
      const next = prev.filter((x) => x !== id);
      if (audioId === id) setAudioId(next[0] ?? null);
      if (next.length === 0) setView("browse");
      return next;
    });
    toast.message("Removed from grid");
  }

  function activateAudio(id: string) {
    setAudioId(id);
    const s = streams.find((x) => x.id === id);
    if (s) toast.success(`Audio: ${s.streamerName}`);
  }

  function clearAll() {
    if (selectedIds.length === 0) return;
    setSelectedIds([]);
    setAudioId(null);
    setView("browse");
    toast.message("Stadium cleared");
  }

  function startWatching() {
    if (selectedIds.length === 0) {
      toast.error("Pick at least one stream first");
      return;
    }
    setView("watch");
  }

  // --- Browse mode ---------------------------------------------------------

  const filteredStreams = React.useMemo(() => {
    if (gameFilter === "all") return streams;
    return streams.filter((s) => s.gameId === gameFilter);
  }, [streams, gameFilter]);

  const games = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const s of streams) {
      if (!map.has(s.gameId)) map.set(s.gameId, s.tags[0] ?? s.gameId);
    }
    return Array.from(map.keys());
  }, [streams]);

  if (view === "watch" && selected.length > 0) {
    return (
      <WatchView
        streams={selected}
        audioId={audioId}
        onActivateAudio={activateAudio}
        onRemove={removeFromGrid}
        onBackToBrowse={() => setView("browse")}
        onClear={clearAll}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <div className="mb-4">
        <BackButton fallbackHref="/discover" />
      </div>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-neutral-50">
            <Grid2x2 className="size-6 text-sky-400" />
            Stadium mode
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Watch up to {MAX_STREAMS} live streams in a grid. Pick which one drives audio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-neutral-800"
            onClick={clearAll}
            disabled={selectedIds.length === 0}
          >
            <RefreshCw className="size-4" />
            Clear
          </Button>
          <Button
            type="button"
            className="bg-sky-500 text-black hover:bg-sky-400"
            onClick={startWatching}
            disabled={selectedIds.length === 0}
          >
            <Layers className="size-4" />
            Watch ({selectedIds.length}/{MAX_STREAMS})
          </Button>
        </div>
      </header>

      {/* Sticky tray of currently selected streams */}
      <div className="sticky top-16 z-20 mb-5 -mx-4 border-y border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">
            Selected
          </span>
          {selected.length === 0 ? (
            <span className="text-xs text-neutral-500">
              Tick streams below to add them to the stadium.
            </span>
          ) : (
            selected.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSelected(s.id)}
                className="group flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-200 hover:border-red-500/60 hover:text-red-300"
                title="Click to remove"
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-black">
                  {i + 1}
                </span>
                <span className="line-clamp-1 max-w-[180px]">{s.streamerName}</span>
                <span className="text-neutral-500 group-hover:text-red-300">×</span>
              </button>
            ))
          )}
          <span className="ml-auto text-[10px] text-neutral-500">
            {selected.length} / {MAX_STREAMS}
          </span>
        </div>
      </div>

      {/* Game filter */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-neutral-500">Game:</span>
        <button
          type="button"
          onClick={() => setGameFilter("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            gameFilter === "all"
              ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
              : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700",
          )}
        >
          All
        </button>
        {games.map((g) => {
          const label = streams.find((s) => s.gameId === g)?.tags[0] ?? g;
          return (
            <button
              key={g}
              type="button"
              onClick={() => setGameFilter(g)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                gameFilter === g
                  ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
                  : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3"
            >
              <div className="aspect-video animate-pulse rounded-lg bg-neutral-900" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-900" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-900" />
            </div>
          ))}
        </div>
      ) : filteredStreams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-12 text-center">
          <Sparkles className="mx-auto size-10 text-neutral-600" />
          <p className="mt-3 text-sm font-semibold text-neutral-200">
            No live streams match this filter
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Try a different game or come back later.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStreams.map((s) => (
            <SelectableCard
              key={s.id}
              stream={s}
              selected={selectedIds.includes(s.id)}
              disabled={selectedIds.length >= MAX_STREAMS}
              onToggle={() => toggleSelected(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Watch view (1–4 selected → grid of iframes)
// ─────────────────────────────────────────────────────────────────────────────

function WatchView({
  streams,
  audioId,
  onActivateAudio,
  onRemove,
  onBackToBrowse,
  onClear,
}: {
  streams: Stream[];
  audioId: string | null;
  onActivateAudio: (id: string) => void;
  onRemove: (id: string) => void;
  onBackToBrowse: () => void;
  onClear: () => void;
}) {
  // Layout decision: 1 → 1col, 2 → 2col, 3 → 2col with 3rd spanning, 4 → 2x2
  const count = streams.length;
  const gridClass =
    count === 1
      ? "grid-cols-1"
      : count === 2
      ? "grid-cols-1 md:grid-cols-2"
      : "grid-cols-1 md:grid-cols-2";

  const audioStream = streams.find((s) => s.id === audioId) ?? null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-neutral-800"
            onClick={onBackToBrowse}
          >
            <ArrowLeft className="size-3.5" />
            Pick more
          </Button>
          <h1 className="flex items-center gap-2 text-lg font-bold text-neutral-50 sm:text-xl">
            <Grid2x2 className="size-5 text-sky-400" />
            Stadium ({count})
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/60 px-3 py-1 text-xs text-neutral-300 sm:flex">
            <Volume2 className="size-3.5 text-sky-400" />
            Audio:{" "}
            <span className="ml-1 font-semibold text-sky-300">
              {audioStream?.streamerName ?? "Muted"}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-neutral-800"
            onClick={onClear}
          >
            <RefreshCw className="size-3.5" />
            Reset
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="border-neutral-800"
          >
            <Link href="/discover">Exit</Link>
          </Button>
        </div>
      </div>

      <div className={cn("grid gap-3", gridClass)}>
        {streams.map((s) => (
          <StreamTile
            key={s.id}
            stream={s}
            isAudioActive={audioId === s.id}
            onActivateAudio={() => onActivateAudio(s.id)}
            onRemove={() => onRemove(s.id)}
          />
        ))}
        {/* Phantom slots to remind users they can add more */}
        {count < MAX_STREAMS
          ? Array.from({ length: MAX_STREAMS - count }).map((_, i) => (
              <button
                key={`empty_${i}`}
                type="button"
                onClick={onBackToBrowse}
                className="group flex aspect-video items-center justify-center rounded-xl border border-dashed border-neutral-800 bg-neutral-900/30 text-xs text-neutral-500 transition-colors hover:border-sky-500/40 hover:text-sky-300"
              >
                <span className="flex flex-col items-center gap-1">
                  <Layers className="size-5" />
                  Add another stream
                </span>
              </button>
            ))
          : null}
      </div>

      <p className="mt-5 text-center text-[11px] text-neutral-500">
        Tap the speaker on a tile to switch audio. Only one tile can be unmuted at a time.
      </p>
    </div>
  );
}
