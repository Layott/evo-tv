"use client";

import * as React from "react";
import Link from "next/link";
import {
  Clock,
  HardDriveDownload,
  Loader2,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/admin/status-badge";
import { cn } from "@/lib/utils";
import { formatBytes, type OfflineDownload } from "@/lib/mock/downloads";

function statusBadge(d: OfflineDownload) {
  switch (d.status) {
    case "ready":
      return <StatusBadge tone="emerald">Ready offline</StatusBadge>;
    case "queued":
      return <StatusBadge tone="neutral">Queued</StatusBadge>;
    case "downloading":
      return (
        <StatusBadge tone="blue">
          Downloading {d.progressPct}%
        </StatusBadge>
      );
    case "paused":
      return <StatusBadge tone="amber">Paused</StatusBadge>;
    case "expired":
      return <StatusBadge tone="red">Expired</StatusBadge>;
    case "failed":
      return <StatusBadge tone="red">Failed</StatusBadge>;
  }
}

function expiresHelp(d: OfflineDownload, now: number): string {
  const t = new Date(d.expiresAt).getTime();
  const diff = t - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86_400_000);
  if (days >= 1) return `Expires in ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 1) return `Expires in ${hours} hour${hours === 1 ? "" : "s"}`;
  const mins = Math.max(1, Math.floor(diff / 60_000));
  return `Expires in ${mins} min`;
}

export function DownloadRow({
  download,
  onResume,
  onPause,
  onDelete,
}: {
  download: OfflineDownload;
  onResume: (id: string) => void;
  onPause: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const now = Date.now();
  const isActive = download.status === "downloading";
  const isReady = download.status === "ready";
  const isPaused = download.status === "paused";
  const isQueued = download.status === "queued";
  const isExpired = download.status === "expired";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-neutral-900/40 p-4 transition sm:flex-row sm:items-center",
        isExpired
          ? "border-neutral-800 opacity-60"
          : "border-neutral-800 hover:border-neutral-700"
      )}
    >
      <div
        className={cn(
          "relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-neutral-800 sm:w-40",
          isExpired ? "grayscale" : ""
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={download.thumbnailUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        {isActive ? (
          <span className="absolute inset-x-0 bottom-0 h-1.5 bg-neutral-900/70">
            <span
              className="block h-full bg-sky-400 transition-[width]"
              style={{ width: `${download.progressPct}%` }}
            />
          </span>
        ) : null}
        {isReady ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
            <HardDriveDownload className="size-3" />
            Offline
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-semibold text-neutral-50">
              {download.title}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-400">
              <span>{formatBytes(download.sizeBytes)}</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" /> {expiresHelp(download, now)}
              </span>
            </p>
          </div>
          {statusBadge(download)}
        </div>

        {isActive || isPaused ? (
          <Progress
            value={download.progressPct}
            className="h-1.5 bg-neutral-800"
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {isReady ? (
            <Button
              asChild
              size="sm"
              className="bg-sky-500 text-black hover:bg-sky-500/90"
            >
              <Link href={`/vod/${download.vodId}`}>
                <Play className="size-3.5" />
                Play
              </Link>
            </Button>
          ) : null}
          {isActive ? (
            <Button
              variant="outline"
              size="sm"
              className="border-neutral-800"
              onClick={() => onPause(download.id)}
            >
              <Pause className="size-3.5" />
              Pause
            </Button>
          ) : null}
          {(isPaused || isQueued) && !isExpired ? (
            <Button
              variant="outline"
              size="sm"
              className="border-neutral-800"
              onClick={() => onResume(download.id)}
            >
              {isQueued ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              {isQueued ? "Start" : "Resume"}
            </Button>
          ) : null}
          {isExpired ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-neutral-800"
            >
              <Link href={`/vod/${download.vodId}`}>Re-download</Link>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="text-neutral-400 hover:bg-red-500/10 hover:text-red-300 ml-auto"
            onClick={() => onDelete(download.id)}
            aria-label="Delete download"
          >
            <Trash2 className="size-3.5" />
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
