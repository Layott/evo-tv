"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bookmark,
  Clock,
  Download,
  HardDriveDownload,
  History,
  Loader2,
  Play,
} from "lucide-react";
import { listVods } from "@/lib/mock";
import { listDownloads, type OfflineDownload } from "@/lib/mock/downloads";
import type { Vod } from "@/lib/types";
import { useMockAuth } from "@/components/providers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { DownloadRow } from "@/components/downloads/download-row";
import {
  deleteDownload,
  pauseDownload,
  resumeDownload,
} from "@/lib/mock/downloads";
import { toast } from "sonner";
import { relativeTime } from "@/components/profile/ngn";

function seedHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function VodCard({ vod, progress }: { vod: Vod; progress?: number }) {
  return (
    <Link
      href={`/vod/${vod.id}`}
      className="group overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 transition hover:border-sky-500/40"
    >
      <div className="relative aspect-video bg-neutral-800">
        <Image src={vod.thumbnailUrl} alt={vod.title} fill className="object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
          <Play className="size-10 text-white" />
        </span>
        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-neutral-100">
          {Math.floor(vod.durationSec / 60)}m
        </span>
        {typeof progress === "number" ? (
          <div className="absolute inset-x-0 bottom-0">
            <Progress value={progress} className="h-1 rounded-none bg-neutral-800" />
          </div>
        ) : null}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-semibold text-neutral-100">{vod.title}</p>
        <p className="mt-1 text-xs text-neutral-500">{relativeTime(vod.publishedAt)}</p>
      </div>
    </Link>
  );
}

function groupByDay(vods: Vod[]) {
  const now = Date.now();
  const day = 86_400_000;
  const buckets: Record<string, Vod[]> = {
    Today: [],
    Yesterday: [],
    "This week": [],
    Earlier: [],
  };
  for (const v of vods) {
    const age = now - new Date(v.publishedAt).getTime();
    if (age < day) buckets.Today!.push(v);
    else if (age < 2 * day) buckets.Yesterday!.push(v);
    else if (age < 7 * day) buckets["This week"]!.push(v);
    else buckets.Earlier!.push(v);
  }
  return buckets;
}

export default function LibraryPage() {
  const { user, role } = useMockAuth();
  const [vods, setVods] = React.useState<Vod[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [downloads, setDownloads] = React.useState<OfflineDownload[]>([]);

  const refreshDownloads = React.useCallback(async () => {
    if (!user) return;
    const list = await listDownloads(user.id);
    setDownloads(list);
  }, [user]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await listVods({ limit: 30 });
      if (!cancelled) {
        setVods(all);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    void refreshDownloads();
  }, [refreshDownloads]);

  const continueVods = vods.slice(0, 6);
  const saved = vods.slice(6, 14);
  const history = vods;
  const buckets = groupByDay(history);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <h1 className="mb-4 text-xl font-bold text-neutral-50">Library</h1>
      <Tabs defaultValue="continue">
        <TabsList className="bg-neutral-900/60">
          <TabsTrigger value="continue">
            <Play className="size-4" />
            Continue
          </TabsTrigger>
          <TabsTrigger value="saved">
            <Bookmark className="size-4" />
            Saved
          </TabsTrigger>
          <TabsTrigger value="downloads">
            <Download className="size-4" />
            Downloads
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="size-4" />
            History
          </TabsTrigger>
        </TabsList>
        <TabsContent value="continue" className="mt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {continueVods.map((v) => {
              const progress = 10 + (seedHash(v.id) % 80);
              return <VodCard key={v.id} vod={v} progress={progress} />;
            })}
          </div>
        </TabsContent>
        <TabsContent value="saved" className="mt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((v) => (
              <VodCard key={v.id} vod={v} />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="downloads" className="mt-4">
          {role !== "premium" && role !== "admin" ? (
            <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-10 text-center">
              <HardDriveDownload className="mx-auto size-10 text-amber-300" />
              <p className="mt-3 text-sm font-semibold text-neutral-200">
                Offline downloads are a Premium feature
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Save VODs for travel and low-data days.
              </p>
              <Button
                asChild
                className="mt-4 bg-amber-500 text-black hover:bg-amber-500/90"
              >
                <Link href="/upgrade">Upgrade to Premium</Link>
              </Button>
            </div>
          ) : downloads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-10 text-center">
              <Download className="mx-auto size-10 text-neutral-600" />
              <p className="mt-3 text-sm font-semibold text-neutral-200">
                Nothing downloaded yet
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Tap "Download for offline" on any VOD page.
              </p>
              <Button
                asChild
                variant="outline"
                className="mt-4 border-neutral-800"
              >
                <Link href="/discover">Browse VODs</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-500">
                  Showing {Math.min(downloads.length, 4)} of {downloads.length}
                </p>
                <Button asChild variant="outline" size="sm" className="border-neutral-800">
                  <Link href="/library/downloads">
                    View all
                  </Link>
                </Button>
              </div>
              {downloads.slice(0, 4).map((d) => (
                <DownloadRow
                  key={d.id}
                  download={d}
                  onResume={async (id) => {
                    await resumeDownload(id);
                    toast.success("Download resumed");
                    void refreshDownloads();
                  }}
                  onPause={async (id) => {
                    await pauseDownload(id);
                    toast.message("Download paused");
                    void refreshDownloads();
                  }}
                  onDelete={async (id) => {
                    await deleteDownload(id);
                    toast.success("Removed from offline library");
                    void refreshDownloads();
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="history" className="mt-4 space-y-6">
          {Object.entries(buckets).map(([label, list]) =>
            list.length ? (
              <section key={label}>
                <h3 className="mb-2 text-sm font-semibold text-neutral-300">
                  <Clock className="mr-1 inline size-4 text-neutral-500" />
                  {label}
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((v) => (
                    <VodCard key={v.id} vod={v} />
                  ))}
                </div>
              </section>
            ) : null
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
