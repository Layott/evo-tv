"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  HardDriveDownload,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DownloadRow } from "@/components/downloads/download-row";
import {
  deleteDownload,
  formatBytes,
  listDownloads,
  pauseDownload,
  resumeDownload,
  type DownloadStatus,
  type OfflineDownload,
} from "@/lib/mock/downloads";

const ACTIVE_STATUSES: DownloadStatus[] = ["downloading", "queued", "paused"];
const READY_STATUSES: DownloadStatus[] = ["ready"];
const ARCHIVE_STATUSES: DownloadStatus[] = ["expired", "failed"];

export default function DownloadsPage() {
  const { user, role, ready } = useAuth();
  const [downloads, setDownloads] = React.useState<OfflineDownload[] | null>(null);
  const [search, setSearch] = React.useState("");

  const refresh = React.useCallback(async () => {
    if (!user) return;
    const list = await listDownloads(user.id);
    setDownloads(list);
  }, [user]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-fetch every 1.5s while there's any active download so progress moves visibly
  React.useEffect(() => {
    if (!downloads) return;
    const hasActive = downloads.some((d) => d.status === "downloading");
    if (!hasActive) return;
    const id = window.setInterval(() => {
      void refresh();
    }, 1_500);
    return () => window.clearInterval(id);
  }, [downloads, refresh]);

  const filtered = React.useMemo(() => {
    if (!downloads) return null;
    const q = search.trim().toLowerCase();
    if (!q) return downloads;
    return downloads.filter((d) => d.title.toLowerCase().includes(q));
  }, [downloads, search]);

  const buckets = React.useMemo(() => {
    if (!filtered) return null;
    return {
      active: filtered.filter((d) => ACTIVE_STATUSES.includes(d.status)),
      ready: filtered.filter((d) => READY_STATUSES.includes(d.status)),
      archive: filtered.filter((d) => ARCHIVE_STATUSES.includes(d.status)),
    };
  }, [filtered]);

  async function handleResume(id: string) {
    await resumeDownload(id);
    toast.success("Download resumed");
    void refresh();
  }
  async function handlePause(id: string) {
    await pauseDownload(id);
    toast.message("Download paused");
    void refresh();
  }
  async function handleDelete(id: string) {
    await deleteDownload(id);
    toast.success("Removed from offline library");
    void refresh();
  }

  // Premium-only feature gate. `ready` first: role is "guest" until the
  // session resolves, which would flash the paywall at a paying member.
  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-neutral-500">
        Checking your plan…
      </div>
    );
  }

  if (role !== "premium" && role !== "admin") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30">
          <HardDriveDownload className="size-7" />
        </div>
        <h1 className="text-xl font-bold text-neutral-50">Offline downloads are Premium</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-400">
          Save VODs, episodes and clips for offline playback during travel or low-data days.
          Files auto-delete after 30 days to keep your phone tidy.
        </p>
        <Button
          asChild
          size="lg"
          className="mt-6 bg-amber-500 text-black hover:bg-amber-500/90"
        >
          <Link href="/upgrade">
            <Sparkles className="size-4" />
            Upgrade to Premium
          </Link>
        </Button>
      </div>
    );
  }

  const totalReadyBytes = (buckets?.ready ?? []).reduce(
    (sum, d) => sum + d.sizeBytes,
    0
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <Link
        href="/library"
        className="mb-3 inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200"
      >
        <ArrowLeft className="size-4" /> Back to library
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-50">Offline downloads</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Watch without Wi-Fi. Files auto-expire after 30 days.
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            Stored on this device
          </p>
          <p className="text-sm font-semibold text-neutral-100 tabular-nums">
            {formatBytes(totalReadyBytes)}
          </p>
        </div>
      </header>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-neutral-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search saved VODs"
          className="bg-neutral-900 pl-8"
        />
      </div>

      <Tabs defaultValue="active">
        <TabsList className="bg-neutral-900/60">
          <TabsTrigger value="active">
            <Loader2 className="size-4" />
            Active ({buckets?.active.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="ready">
            <HardDriveDownload className="size-4" />
            Ready ({buckets?.ready.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="archive">
            <Download className="size-4" />
            Archive ({buckets?.archive.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {downloads === null || !buckets ? (
          <div className="mt-5 grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-32 w-full rounded-2xl bg-neutral-800/60"
              />
            ))}
          </div>
        ) : (
          <>
            <TabsContent value="active" className="mt-5">
              <DownloadList
                items={buckets.active}
                emptyTitle="No active downloads"
                emptyDescription="Downloads in progress, queued, or paused will appear here."
                onResume={handleResume}
                onPause={handlePause}
                onDelete={handleDelete}
              />
            </TabsContent>
            <TabsContent value="ready" className="mt-5">
              <DownloadList
                items={buckets.ready}
                emptyTitle="Nothing saved yet"
                emptyDescription="Tap 'Download for offline' on any VOD page to start saving it here."
                onResume={handleResume}
                onPause={handlePause}
                onDelete={handleDelete}
              />
            </TabsContent>
            <TabsContent value="archive" className="mt-5">
              <DownloadList
                items={buckets.archive}
                emptyTitle="Archive empty"
                emptyDescription="Expired and failed downloads land here so you can re-add them quickly."
                onResume={handleResume}
                onPause={handlePause}
                onDelete={handleDelete}
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

function DownloadList({
  items,
  emptyTitle,
  emptyDescription,
  onResume,
  onPause,
  onDelete,
}: {
  items: OfflineDownload[];
  emptyTitle: string;
  emptyDescription: string;
  onResume: (id: string) => void;
  onPause: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-10 text-center">
        <Download className="mx-auto size-9 text-neutral-600" />
        <p className="mt-3 text-sm font-semibold text-neutral-200">{emptyTitle}</p>
        <p className="mt-1 text-xs text-neutral-500">{emptyDescription}</p>
        <Button
          asChild
          variant="outline"
          className="mt-4 border-neutral-800"
        >
          <Link href="/discover">Browse VODs</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {items.map((d) => (
        <DownloadRow
          key={d.id}
          download={d}
          onResume={onResume}
          onPause={onPause}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
