"use client";

import * as React from "react";
import Link from "next/link";
import { Calendar, Download, HardDriveDownload, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMockAuth } from "@/components/providers";
import {
  enqueueDownload,
  formatBytes,
  listDownloads,
  type OfflineDownload,
} from "@/lib/mock/downloads";
import { vods } from "@/lib/mock/vods";

interface Props {
  vodId: string;
  /** estimated file size — fall back to the mock helper when not provided */
  sizeBytes?: number;
  className?: string;
}

export function DownloadButton({ vodId, sizeBytes, className }: Props) {
  const { user, role } = useMockAuth();
  const [open, setOpen] = React.useState(false);
  const [premiumDialog, setPremiumDialog] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [existing, setExisting] = React.useState<OfflineDownload | null>(null);

  const isPremium = role === "premium" || role === "admin";

  React.useEffect(() => {
    let cancelled = false;
    if (!user) {
      setExisting(null);
      return;
    }
    listDownloads(user.id).then((list) => {
      if (cancelled) return;
      setExisting(list.find((d) => d.vodId === vodId) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [user, vodId]);

  const vodMeta = vods.find((v) => v.id === vodId);
  const size =
    sizeBytes ??
    (existing
      ? existing.sizeBytes
      : (() => {
          let h = 0;
          for (let i = 0; i < vodId.length; i++) h = (h * 31 + vodId.charCodeAt(i)) >>> 0;
          return (320 + (h % 631)) * 1024 * 1024;
        })());

  function open30dDate() {
    return new Date(Date.now() + 30 * 86_400_000).toLocaleDateString();
  }

  function handleClick() {
    if (!isPremium) {
      setPremiumDialog(true);
      return;
    }
    setOpen(true);
  }

  async function confirm() {
    if (!user) return;
    setBusy(true);
    try {
      const dl = await enqueueDownload(vodId, user.id);
      setExisting(dl);
      toast.success("Download started", {
        description: "Track progress in Library → Downloads.",
      });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to enqueue download");
    } finally {
      setBusy(false);
    }
  }

  // Already downloaded → show subtle indicator
  if (existing && existing.status === "ready") {
    return (
      <Button
        asChild
        variant="outline"
        size="sm"
        className={className}
      >
        <Link href="/library/downloads">
          <HardDriveDownload className="size-4 text-emerald-300" />
          Saved offline
        </Link>
      </Button>
    );
  }
  if (
    existing &&
    (existing.status === "downloading" ||
      existing.status === "queued" ||
      existing.status === "paused")
  ) {
    return (
      <Button
        asChild
        variant="outline"
        size="sm"
        className={className}
      >
        <Link href="/library/downloads">
          <Loader2 className="size-4 animate-spin text-sky-400" />
          {existing.status === "paused" ? "Paused" : "Downloading…"}
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        className={className}
      >
        <Download className="size-4" />
        Download
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Download for offline?</DialogTitle>
            <DialogDescription className="text-neutral-400">
              {vodMeta?.title ?? "This VOD"} will save to this device for offline playback.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-neutral-400">Estimated size</span>
              <span className="font-semibold tabular-nums text-neutral-100">
                {formatBytes(size)}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-neutral-400">Quality</span>
              <span className="text-neutral-100">720p · adaptive</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-neutral-400">Auto-deletes on</span>
              <span className="inline-flex items-center gap-1 text-neutral-100">
                <Calendar className="size-3.5 text-neutral-500" />
                {open30dDate()}
              </span>
            </li>
          </ul>
          <p className="text-xs text-neutral-500">
            Files older than 30 days are removed automatically. You can re-download anytime
            you're back online.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              className="bg-sky-500 text-black hover:bg-sky-500/90"
              onClick={confirm}
              disabled={busy}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {busy ? "Starting…" : "Start download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={premiumDialog} onOpenChange={setPremiumDialog}>
        <DialogContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Premium feature</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Offline downloads are part of EVO TV Premium. Watch on the train, on long flights,
              or whenever Wi-Fi is patchy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
              onClick={() => setPremiumDialog(false)}
            >
              Maybe later
            </Button>
            <Button
              asChild
              className="bg-amber-500 text-black hover:bg-amber-500/90"
            >
              <Link href="/upgrade">
                <Sparkles className="size-4" />
                Upgrade to Premium
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
