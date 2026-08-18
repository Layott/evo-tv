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
  DialogFooter,
} from "@/components/ui/dialog";
import { Share2, Flag, Loader2, Languages, Headphones, BadgeCheck } from "@/components/icons";
import { toast } from "sonner";
import { FollowButton } from "./follow-button";
import { Textarea } from "@/components/ui/textarea";
import {
  reportStream,
  REPORT_REASONS,
  type ReportReason,
} from "@/lib/client";
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
  const [reporting, setReporting] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [reason, setReason] = React.useState<ReportReason | null>(null);
  const [reportDetails, setReportDetails] = React.useState("");
  /** Set only when both share and clipboard failed, so the URL can be copied by hand. */
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);

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

  /**
   * Report, with a reason.
   *
   * The button used to file the report immediately, always as "other", so a
   * viewer could not say what was wrong and a moderator could not tell
   * harassment from a copyright claim. It now opens a dialog and asks.
   *
   * What was on air is not collected here. The server reads it from the
   * schedule when the report arrives, which is both harder to falsify and more
   * likely to be right: this page shows a player, not a schedule.
   */
  async function submitReport() {
    if (reporting || !reason) return;
    setReporting(true);
    try {
      const { reportId } = await reportStream(stream.id, reason, reportDetails);
      setReportOpen(false);
      setReason(null);
      setReportDetails("");
      toast.success(`Report sent to moderators. Reference ${reportId}`);
    } catch {
      toast.error("Could not submit report");
    } finally {
      setReporting(false);
    }
  }

  /**
   * Share, with a fallback for every way it can fail.
   *
   * The old version treated `navigator.share` as either present and working or
   * absent. It is neither: on desktop it exists and commonly rejects with
   * NotAllowedError, which was caught and reported as "Share cancelled", so the
   * button appeared to do nothing and blamed the user for it.
   *
   * Order is deliberate. Native share first, because on a phone it is the
   * better experience. AbortError means they genuinely dismissed the sheet, so
   * stop. Any other rejection is the API failing, so fall through to the
   * clipboard, and if that fails too, show the URL so it can be copied by hand.
   * The one outcome not allowed is nothing happening.
   */
  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) return;

    /*
     * Native share on a phone, clipboard on a desktop.
     *
     * `navigator.share` exists on desktop Chrome for Windows, so the old check
     * sent a laptop into the OS share flyout. Dismissing that raises AbortError,
     * which is correctly treated as a deliberate choice and returns silently,
     * and the result is a Share button that looks broken on the machine most
     * likely to be testing it. Nobody on a desktop wanted the OS sheet anyway;
     * they wanted the link.
     *
     * A coarse pointer is the honest test for "this is a phone or tablet",
     * where the share sheet genuinely is the better route.
     */
    const isTouchDevice =
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)").matches;

    if (isTouchDevice && navigator.share) {
      try {
        await navigator.share({ title: stream.title, url });
        return;
      } catch (err) {
        // The user closed the sheet. That is a choice, not a failure.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Anything else: the API is unavailable in practice. Keep going.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
      return;
    } catch {
      // Clipboard can be blocked by permissions or a non-secure context.
    }

    setShareUrl(url);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight">
          {stream.title}
        </h1>
        {activeTrack ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Headphones className="size-3 text-sky-400" />
            <span>
              Audio:{" "}
              <span className="font-medium text-foreground">
                {activeTrack.languageLabel}
              </span>
              <span className="ml-1 text-muted-foreground">
                · @{activeTrack.casterHandle}
              </span>
            </span>
          </p>
        ) : null}
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
          {stream.description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-10">
            <AvatarImage
              src={stream.streamerAvatarUrl}
              alt={stream.streamerName}
            />
            <AvatarFallback>{stream.streamerName.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-semibold text-foreground">
              {stream.streamerName}
            </div>
            <div className="text-[11px] text-muted-foreground">
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
          {/* The Languages picker and the Co-stream link are gone.
              Alternate commentary tracks have no backend, so the button read
              "Languages 0" and opened an empty dialog. Co-stream is a stubbed
              route. Both were controls on a page real viewers are watching that
              could only disappoint them. Restore each when its feature exists. */}
          <Button variant="outline" size="sm" onClick={share}>
            <Share2 className="size-3.5" />
            Share
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReportOpen(true)}
            disabled={reporting}
          >
            {reporting ? <Loader2 className="size-3.5 animate-spin" /> : <Flag className="size-3.5" />}
            Report
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {game && (
          <Badge variant="secondary" className="bg-muted text-foreground">
            {game.shortName}
          </Badge>
        )}
        <Badge variant="outline" className="uppercase text-[10px]">
          {stream.language}
        </Badge>
        {stream.isPremium && (
          <Badge className="bg-amber-500 text-ink">Premium</Badge>
        )}
        {stream.tags.slice(0, 5).map((t) => (
          <Badge key={t} variant="outline" className="text-[10px]">
            {t}
          </Badge>
        ))}
        {/* "N watch parties" was Math.max(12, viewerCount / 40): a number with
            no watch party behind it, and never fewer than twelve, on a stream
            nobody had started one for. Watch parties have no backend, so there
            is nothing honest to put here. */}
      </div>

      {/*
        Report, with a reason.

        The reasons are worded for a viewer rather than named after the enum
        they map to: nobody watching a broadcast thinks "impersonation", they
        think "that is not who they say they are". The values still line up with
        what `/api/reports` accepts, so the moderation queue can sort by them.
      */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Report this stream</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              What is wrong with it? Moderators see your answer along with
              whatever was on air when you reported it.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  reason === r.value
                    ? "bg-sky-500/25 text-sky-100"
                    : "bg-card/60 text-foreground/80 hover:bg-card",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="report-details" className="text-xs text-muted-foreground">
              Anything else? Optional.
            </label>
            <Textarea
              id="report-details"
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              maxLength={2000}
              placeholder="What did you see, and roughly when?"
              className="min-h-[80px] border-border bg-card"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitReport}
              disabled={!reason || reporting}
              className="bg-sky-600 hover:bg-sky-500"
            >
              {reporting ? <Loader2 className="size-4 animate-spin" /> : null}
              Send report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Last resort. Reached only when the share sheet and the clipboard both
          refused, which is rare but leaves the button doing nothing otherwise. */}
      <Dialog open={!!shareUrl} onOpenChange={(o) => !o && setShareUrl(null)}>
        <DialogContent className="border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Share this stream</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Your browser blocked the copy. Select the link and copy it.
            </DialogDescription>
          </DialogHeader>
          <input
            readOnly
            value={shareUrl ?? ""}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm text-foreground"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
