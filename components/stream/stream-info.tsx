"use client";

import * as React from "react";
import type { Stream, Game } from "@/lib/types";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Share2, Flag, Users, Loader2, Radio, Languages, Headphones, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { FollowButton } from "./follow-button";
import { reportStream } from "@/lib/client";
import {
  listCommentaryTracks,
  type CommentaryTrack,
} from "@/lib/client/player-features";
import { cn } from "@/lib/utils";

function streamerHandleFromStream(s: Stream): string {
  return s.streamerName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

interface StreamInfoProps {
  stream: Stream;
  game?: Game | null;
}

function streamerIdFromStream(s: Stream): string {
  return `streamer_${s.streamerName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
}

export function StreamInfo({ stream, game }: StreamInfoProps) {
  const streamerId = streamerIdFromStream(stream);
  const watchParty = Math.max(12, Math.floor(stream.viewerCount / 40));
  const [reporting, setReporting] = React.useState(false);

  // Multi-language commentary track state
  const [tracks, setTracks] = React.useState<CommentaryTrack[] | null>(null);
  const [tracksOpen, setTracksOpen] = React.useState(false);
  const [activeTrackId, setActiveTrackId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    listCommentaryTracks(stream.id).then((list) => {
      if (cancelled) return;
      setTracks(list);
      // Default to the largest official track that matches stream language
      const defaultTrack =
        list.find((t) => t.language === stream.language && t.isOfficial) ??
        list.find((t) => t.isOfficial) ??
        list[0] ??
        null;
      setActiveTrackId(defaultTrack?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [stream.id, stream.language]);

  const activeTrack = tracks?.find((t) => t.id === activeTrackId) ?? null;

  function handleSelectTrack(track: CommentaryTrack) {
    setActiveTrackId(track.id);
    setTracksOpen(false);
    toast.success(`Switched to ${track.languageLabel} commentary`);
  }

  async function handleReport() {
    if (reporting) return;
    setReporting(true);
    try {
      const { ticketId } = await reportStream(stream.id, "user-reported");
      toast.message(`Report submitted to moderators. Ticket: ${ticketId}`);
    } catch {
      toast.error("Could not submit report");
    } finally {
      setReporting(false);
    }
  }

  const share = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      navigator
        .share({ title: stream.title, url })
        .catch(() => toast.message("Share cancelled"));
    } else if (url && navigator.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() => toast.success("Link copied"))
        .catch(() => toast.error("Could not copy"));
    } else {
      toast.message("Share unavailable");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-neutral-50 leading-tight">
          {stream.title}
        </h1>
        {activeTrack ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
            <Headphones className="size-3 text-sky-400" />
            <span>
              Audio:{" "}
              <span className="font-medium text-neutral-100">
                {activeTrack.languageLabel}
              </span>
              <span className="ml-1 text-neutral-500">
                · @{activeTrack.casterHandle}
              </span>
            </span>
          </p>
        ) : null}
        <p className="mt-1 text-sm text-neutral-400 line-clamp-2">
          {stream.description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-10 ring-2 ring-sky-500/60">
            <AvatarImage
              src={stream.streamerAvatarUrl}
              alt={stream.streamerName}
            />
            <AvatarFallback>{stream.streamerName.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-semibold text-neutral-100">
              {stream.streamerName}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-neutral-500">
              {stream.streamerType} streamer
            </div>
          </div>
        </div>

        <FollowButton
          targetType="streamer"
          targetId={streamerId}
          targetLabel={stream.streamerName}
        />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Dialog open={tracksOpen} onOpenChange={setTracksOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
              >
                <Languages className="size-3.5" />
                Languages
                {tracks ? (
                  <span className="ml-1 rounded bg-neutral-900/70 px-1 text-[10px] font-medium tabular-nums">
                    {tracks.length}
                  </span>
                ) : null}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Choose commentary language</DialogTitle>
                <DialogDescription>
                  Pick the audio track. Switching keeps the same video stream.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                {tracks ? (
                  tracks.length === 0 ? (
                    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-6 text-center text-sm text-neutral-500">
                      No commentary tracks available for this stream.
                    </div>
                  ) : (
                    tracks.map((track) => {
                      const active = track.id === activeTrackId;
                      return (
                        <button
                          key={track.id}
                          type="button"
                          onClick={() => handleSelectTrack(track)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition",
                            active
                              ? "border-sky-500/40 bg-sky-500/10"
                              : "border-neutral-800 bg-neutral-900/40 hover:border-neutral-700",
                          )}
                        >
                          <Avatar className="size-9 shrink-0">
                            <AvatarImage
                              src={track.casterAvatarUrl}
                              alt={track.casterHandle}
                            />
                            <AvatarFallback>
                              {track.casterHandle.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-semibold text-neutral-100">
                                {track.languageLabel}
                              </span>
                              {track.isOfficial ? (
                                <BadgeCheck className="size-3.5 text-sky-400" />
                              ) : null}
                            </div>
                            <div className="truncate text-xs text-neutral-400">
                              @{track.casterHandle}
                            </div>
                          </div>
                          <div className="text-right text-xs">
                            <div className="font-mono tabular-nums text-neutral-200">
                              {track.viewerCount.toLocaleString()}
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                              listeners
                            </div>
                          </div>
                          {active ? (
                            <span className="ml-1 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                              Active
                            </span>
                          ) : null}
                        </button>
                      );
                    })
                  )
                ) : (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-14 rounded-lg border border-neutral-800 bg-neutral-900/40 animate-pulse"
                    />
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Button asChild variant="outline" size="sm">
            <Link href={`/stream/${stream.id}/co-stream`}>
              <Radio className="size-3.5" />
              Co-stream
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={share}>
            <Share2 className="size-3.5" />
            Share
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReport}
            disabled={reporting}
          >
            {reporting ? <Loader2 className="size-3.5 animate-spin" /> : <Flag className="size-3.5" />}
            Report
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {game && (
          <Badge variant="secondary" className="bg-neutral-800 text-neutral-100">
            {game.shortName}
          </Badge>
        )}
        <Badge variant="outline" className="uppercase text-[10px]">
          {stream.language}
        </Badge>
        {stream.isPremium && (
          <Badge className="bg-amber-500 text-black">Premium</Badge>
        )}
        {stream.tags.slice(0, 5).map((t) => (
          <Badge key={t} variant="outline" className="text-[10px]">
            {t}
          </Badge>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-neutral-400">
          <Users className="size-3.5" />
          {watchParty} watch parties
        </div>
      </div>
    </div>
  );
}
