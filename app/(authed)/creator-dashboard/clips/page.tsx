"use client";

import * as React from "react";
import Image from "next/image";
import { Check, CheckCircle2, Film, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import {
  approveClip,
  discardClip,
  listClipDrafts,
  publishClip,
  type CreatorClipDraft,
  type ClipStatus,
} from "@/lib/mock/creators";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DashboardShell } from "@/components/creators/dashboard-shell";
import { relativeTime } from "@/components/profile/ngn";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<ClipStatus, { label: string; className: string }> = {
  pending: { label: "Awaiting review", className: "border-amber-500/40 bg-amber-500/10 text-amber-200" },
  approved: { label: "Approved", className: "border-sky-500/40 bg-sky-500/10 text-sky-200" },
  published: { label: "Published", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" },
  discarded: { label: "Discarded", className: "border-neutral-700 bg-neutral-800 text-neutral-400" },
};

export default function CreatorClipsPage() {
  const { user } = useMockAuth();
  const [clips, setClips] = React.useState<CreatorClipDraft[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const list = await listClipDrafts(user.id);
      if (!cancelled) {
        setClips(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleAction(id: string, action: "approve" | "publish" | "discard") {
    setBusyId(id);
    if (action === "approve") {
      await approveClip(id);
      setClips((prev) => prev.map((c) => (c.id === id ? { ...c, status: "approved" } : c)));
      toast.success("Clip approved", { description: "It's queued to publish in your next batch." });
    } else if (action === "publish") {
      await publishClip(id);
      setClips((prev) => prev.map((c) => (c.id === id ? { ...c, status: "published" } : c)));
      toast.success("Clip published");
    } else {
      await discardClip(id);
      setClips((prev) => prev.map((c) => (c.id === id ? { ...c, status: "discarded" } : c)));
      toast.message("Clip discarded");
    }
    setBusyId(null);
  }

  function filterClips(status: "all" | ClipStatus) {
    if (status === "all") return clips;
    return clips.filter((c) => c.status === status);
  }

  const counts = clips.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<ClipStatus, number>,
  );

  return (
    <DashboardShell
      title="Auto-clipper queue"
      description="Highlights extracted from your last stream — approve, publish, or discard."
    >
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl bg-neutral-900" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList className="bg-neutral-900/60">
            <TabsTrigger value="pending">Pending ({counts.pending ?? 0})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({counts.approved ?? 0})</TabsTrigger>
            <TabsTrigger value="published">Published ({counts.published ?? 0})</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          {(["pending", "approved", "published", "all"] as const).map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <ClipGrid clips={filterClips(tab)} busyId={busyId} onAction={handleAction} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </DashboardShell>
  );
}

function ClipGrid({
  clips,
  busyId,
  onAction,
}: {
  clips: CreatorClipDraft[];
  busyId: string | null;
  onAction: (id: string, action: "approve" | "publish" | "discard") => void;
}) {
  if (clips.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-10 text-center">
        <Film className="mx-auto size-10 text-neutral-600" />
        <p className="mt-3 text-sm font-semibold text-neutral-200">No clips here yet.</p>
        <p className="mt-1 text-xs text-neutral-500">
          Auto-clipper queues highlights at the end of every stream. Go live to fill this list.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clips.map((c) => (
        <article
          key={c.id}
          className={cn(
            "group overflow-hidden rounded-2xl border bg-neutral-900/40 transition",
            c.status === "discarded" ? "border-neutral-800/60 opacity-50" : "border-neutral-800 hover:border-sky-500/40",
          )}
        >
          <div className="relative aspect-video bg-neutral-950">
            <Image src={c.thumbnailUrl} alt={c.title} fill className="object-cover" />
            <div className="absolute left-2 top-2 flex flex-wrap gap-1">
              <Badge variant="outline" className={STATUS_LABEL[c.status].className}>
                {STATUS_LABEL[c.status].label}
              </Badge>
            </div>
            <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-neutral-100 tabular-nums">
              {c.durationSec}s
            </div>
            <div className="absolute bottom-2 left-2 rounded bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950">
              <Sparkles className="mr-0.5 inline size-3" />
              {c.highlightScore}/100
            </div>
          </div>
          <div className="space-y-3 p-4">
            <div>
              <h3 className="line-clamp-2 text-sm font-semibold text-neutral-100">{c.title}</h3>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                from {c.vodSourceTitle} · {relativeTime(c.capturedAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {c.status === "pending" ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => onAction(c.id, "approve")}
                    disabled={busyId === c.id}
                    className="flex-1 bg-sky-600 hover:bg-sky-500"
                  >
                    {busyId === c.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAction(c.id, "discard")}
                    disabled={busyId === c.id}
                    className="border-neutral-700"
                  >
                    <Trash2 className="size-3.5" />
                    Discard
                  </Button>
                </>
              ) : c.status === "approved" ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => onAction(c.id, "publish")}
                    disabled={busyId === c.id}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                  >
                    {busyId === c.id ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                    Publish
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAction(c.id, "discard")}
                    disabled={busyId === c.id}
                    className="border-neutral-700"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              ) : c.status === "published" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                  <CheckCircle2 className="size-3.5" />
                  Live on your channel
                </span>
              ) : (
                <span className="text-xs text-neutral-500">Discarded — won&apos;t publish.</span>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
