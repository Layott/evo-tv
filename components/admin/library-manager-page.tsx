"use client";

import * as React from "react";
import { Loader2, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminCreateClip,
  adminCreateVod,
  adminUpdateVod,
  adminDeleteClip,
  adminDeleteVod,
  adminListClips,
  adminListGames,
  adminListShows,
  adminListVods,
  adminRestoreClip,
  adminRestoreVod,
  type AdminClip,
  type AdminShow,
  type MaturityRating,
  type ShowPillar,
} from "@/lib/client";
import type { Vod } from "@/lib/types";
import { hasMinRole } from "@/lib/auth/role-catalog";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type DataColumn } from "./data-table";
import { PageHeader } from "./page-header";
import { MediaUpload } from "./media-upload";
import { formatDate } from "./utils";

/**
 * The library: uploaded videos, and the clips cut from them.
 *
 * Both endpoints have existed since the admin API was built and neither had a
 * screen. `/api/admin/vods` could create a video that nothing in the dashboard
 * could see, and `/api/admin/clips` was read-only in every sense: no route
 * wrote a clip at all, so the clips rail on the site could only ever be empty.
 *
 * A clip is attached to what it was cut from - a video, a show, or one episode
 * of a show - which is the link the site needs to show "more from this series"
 * and the reason migration 0037 exists.
 */

const PILLARS: ShowPillar[] = ["esports", "anime", "lifestyle"];
const MATURITY: MaturityRating[] = ["kids", "pg", "teen", "mature"];

function formatDuration(sec: number): string {
  if (!sec) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface VodDraft {
  /** Null when publishing. Set when configuring one that already exists. */
  id: string | null;
  title: string;
  description: string;
  gameId: string;
  mp4Url: string;
  hlsUrl: string;
  thumbnailUrl: string;
  durationMin: string;
  pillar: ShowPillar;
  maturityRating: MaturityRating;
  isPremium: boolean;
}

interface ClipDraft {
  title: string;
  gameId: string;
  mp4Url: string;
  thumbnailUrl: string;
  durationSec: string;
  creatorHandle: string;
  pillar: ShowPillar;
  maturityRating: MaturityRating;
  /** "none" | "vod:<id>" | "show:<id>" | "episode:<id>" */
  source: string;
}

const emptyVod: VodDraft = {
  id: null,
  title: "",
  description: "",
  gameId: "",
  mp4Url: "",
  hlsUrl: "",
  thumbnailUrl: "",
  durationMin: "",
  pillar: "esports",
  maturityRating: "teen",
  isPremium: false,
};

const emptyClip: ClipDraft = {
  title: "",
  gameId: "",
  mp4Url: "",
  thumbnailUrl: "",
  durationSec: "",
  creatorHandle: "",
  pillar: "esports",
  maturityRating: "teen",
  source: "none",
};

export function LibraryManagerPage() {
  const queryClient = useQueryClient();
  // Moderators can open this page to see what is published; publishing and
  // pulling are admin verbs on the API. Showing them the buttons anyway would
  // be a screen full of controls that answer 403.
  const { role } = useAuth();
  const canPublish = hasMinRole(role, "admin");
  const [tab, setTab] = React.useState<"videos" | "clips">("videos");
  const [search, setSearch] = React.useState("");
  const [showBin, setShowBin] = React.useState(false);

  const vodsQ = useQuery({
    queryKey: ["admin", "vods", { showBin }],
    queryFn: () => adminListVods({ deleted: showBin ? "include" : undefined }),
  });
  const clipsQ = useQuery({
    queryKey: ["admin", "clips", { showBin }],
    queryFn: () => adminListClips({ deleted: showBin ? "include" : undefined }),
  });
  const gamesQ = useQuery({
    queryKey: ["admin", "games"],
    queryFn: () => adminListGames(),
  });
  const showsQ = useQuery({
    queryKey: ["admin", "shows", "for-clips"],
    queryFn: () => adminListShows({ limit: 200 }),
  });

  const games = gamesQ.data ?? [];
  const shows: AdminShow[] = showsQ.data?.shows ?? [];
  const vods = vodsQ.data?.vods ?? [];
  const clips = clipsQ.data?.clips ?? [];

  const showById = React.useMemo(
    () => new Map(shows.map((s) => [s.id, s])),
    [shows],
  );

  const filteredVods = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? vods.filter((v) => v.title.toLowerCase().includes(q)) : vods;
  }, [vods, search]);

  const filteredClips = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? clips.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.creatorHandle.toLowerCase().includes(q),
        )
      : clips;
  }, [clips, search]);

  const [vodDraft, setVodDraft] = React.useState<VodDraft | null>(null);
  const [clipDraft, setClipDraft] = React.useState<ClipDraft | null>(null);
  const [confirm, setConfirm] = React.useState<
    { kind: "vod" | "clip"; id: string; label: string } | null
  >(null);

  const refresh = React.useCallback(
    async (key: "vods" | "clips") => {
      await queryClient.invalidateQueries({ queryKey: ["admin", key] });
    },
    [queryClient],
  );

  const saveVod = useMutation({
    mutationFn: (input: VodDraft) => {
      const payload = {
        title: input.title.trim(),
        description: input.description.trim(),
        gameId: input.gameId,
        mp4Url: input.mp4Url.trim(),
        hlsUrl: input.hlsUrl.trim(),
        thumbnailUrl: input.thumbnailUrl.trim(),
        durationSec: Math.max(1, Math.round(Number(input.durationMin || 0) * 60)),
        pillar: input.pillar,
        maturityRating: input.maturityRating,
        isPremium: input.isPremium,
      };
      // Editing sends the same shape. Replacing `mp4Url` swaps what viewers
      // watch on the next play; the old object stays in the bucket, which is
      // the safe direction to be wrong in.
      return input.id ? adminUpdateVod(input.id, payload) : adminCreateVod(payload);
    },
    onSuccess: async (_vod, input) => {
      toast.success(input.id ? "Video saved" : "Video published");
      setVodDraft(null);
      await refresh("vods");
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not save the video"),
  });

  /** Open an existing video in the same sheet that publishes one. */
  function configureVod(vod: Vod) {
    setVodDraft({
      id: vod.id,
      title: vod.title,
      description: vod.description ?? "",
      gameId: vod.gameId ?? "",
      mp4Url: vod.mp4Url ?? "",
      hlsUrl: vod.hlsUrl ?? "",
      thumbnailUrl: vod.thumbnailUrl ?? "",
      durationMin: vod.durationSec ? String(Math.round(vod.durationSec / 60)) : "",
      pillar: (vod.pillar as ShowPillar) ?? "esports",
      maturityRating: (vod.maturityRating as MaturityRating) ?? "teen",
      isPremium: Boolean(vod.isPremium),
    });
  }

  const saveClip = useMutation({
    mutationFn: (input: ClipDraft) => {
      const [kind, id] = input.source.split(":");
      return adminCreateClip({
        title: input.title.trim(),
        gameId: input.gameId,
        mp4Url: input.mp4Url.trim(),
        thumbnailUrl: input.thumbnailUrl.trim(),
        durationSec: Math.max(1, Math.round(Number(input.durationSec || 0))),
        creatorHandle: input.creatorHandle.trim().replace(/^@/, ""),
        pillar: input.pillar,
        maturityRating: input.maturityRating,
        vodId: kind === "vod" ? id : null,
        showId: kind === "show" ? id : null,
        episodeId: kind === "episode" ? id : null,
      });
    },
    onSuccess: async () => {
      toast.success("Clip published");
      setClipDraft(null);
      await refresh("clips");
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not publish the clip"),
  });

  const pull = useMutation({
    mutationFn: ({ kind, id }: { kind: "vod" | "clip"; id: string }) =>
      kind === "vod" ? adminDeleteVod(id) : adminDeleteClip(id),
    onSuccess: async (_r, v) => {
      toast.success(v.kind === "vod" ? "Video pulled" : "Clip pulled");
      setConfirm(null);
      await refresh(v.kind === "vod" ? "vods" : "clips");
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not pull it"),
  });

  const restore = useMutation({
    mutationFn: ({ kind, id }: { kind: "vod" | "clip"; id: string }) =>
      kind === "vod" ? adminRestoreVod(id) : adminRestoreClip(id),
    onSuccess: async (_r, v) => {
      toast.success("Back on the site");
      await refresh(v.kind === "vod" ? "vods" : "clips");
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not restore it"),
  });

  const vodColumns: DataColumn<Vod>[] = [
    {
      key: "title",
      header: "Video",
      sortable: true,
      accessor: (row) => row.title,
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          {row.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-entered URL
            <img
              src={row.thumbnailUrl}
              alt=""
              className="h-9 w-16 shrink-0 rounded object-cover"
            />
          ) : (
            <div className="h-9 w-16 shrink-0 rounded bg-muted" />
          )}
          <p className="truncate font-medium text-foreground">{row.title}</p>
        </div>
      ),
    },
    {
      key: "duration",
      header: "Length",
      sortable: true,
      accessor: (row) => row.durationSec,
      cell: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {formatDuration(row.durationSec)}
        </span>
      ),
    },
    {
      key: "published",
      header: "Published",
      sortable: true,
      accessor: (row) => new Date(row.publishedAt).getTime(),
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.publishedAt)}</span>
      ),
    },
    {
      key: "access",
      header: "Access",
      cell: (row) => (
        <Badge variant={row.isPremium ? "default" : "secondary"}>
          {row.isPremium ? "Paid" : "Free"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => {
        const deleted = Boolean((row as Vod & { deletedAt?: string | null }).deletedAt);
        if (!canPublish) return null;
        return (
          <div className="flex justify-end gap-1">
            {deleted ? null : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => configureVod(row)}
              >
                Configure
              </Button>
            )}
            {deleted ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => restore.mutate({ kind: "vod", id: row.id })}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Pull ${row.title}`}
                onClick={() =>
                  setConfirm({ kind: "vod", id: row.id, label: row.title })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const clipColumns: DataColumn<AdminClip>[] = [
    {
      key: "title",
      header: "Clip",
      sortable: true,
      accessor: (row) => row.title,
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          {row.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-entered URL
            <img
              src={row.thumbnailUrl}
              alt=""
              className="h-9 w-16 shrink-0 rounded object-cover"
            />
          ) : (
            <div className="h-9 w-16 shrink-0 rounded bg-muted" />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.title}</p>
            <p className="truncate text-xs text-muted-foreground">@{row.creatorHandle}</p>
          </div>
        </div>
      ),
    },
    {
      key: "source",
      header: "Cut from",
      cell: (row) => {
        const show = row.showId ? showById.get(row.showId) : null;
        if (show) {
          return (
            <span className="text-xs text-muted-foreground">
              {show.title}
              {row.episodeId ? " · one episode" : ""}
            </span>
          );
        }
        if (row.vodId) return <span className="text-xs text-muted-foreground">A video</span>;
        if (row.streamId) return <span className="text-xs text-muted-foreground">A stream</span>;
        return <span className="text-xs text-muted-foreground">Standalone</span>;
      },
    },
    {
      key: "duration",
      header: "Length",
      sortable: true,
      accessor: (row) => row.durationSec,
      cell: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {formatDuration(row.durationSec)}
        </span>
      ),
    },
    {
      key: "created",
      header: "Added",
      sortable: true,
      accessor: (row) => new Date(row.createdAt).getTime(),
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) =>
        !canPublish ? null : (
        <div className="flex justify-end">
          {row.deletedAt ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => restore.mutate({ kind: "clip", id: row.id })}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Pull ${row.title}`}
              onClick={() => setConfirm({ kind: "clip", id: row.id, label: row.title })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const gameSelect = (value: string, onChange: (v: string) => void, id: string) => (
    <div className="space-y-2">
      <Label htmlFor={id}>Game</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Pick a game" />
        </SelectTrigger>
        <SelectContent>
          {games.map((game) => (
            <SelectItem key={game.id} value={game.id}>
              {game.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {games.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No games in the catalogue yet. Add one under Content first.
        </p>
      ) : null}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Library"
        description="Uploaded videos and the clips cut from them. Everything here is on the site the moment it saves."
        actions={
          canPublish ? (
            <Button
              type="button"
              onClick={() =>
                tab === "videos" ? setVodDraft({ ...emptyVod }) : setClipDraft({ ...emptyClip })
              }
            >
              <Plus className="h-4 w-4" />
              {tab === "videos" ? "New video" : "New clip"}
            </Button>
          ) : null
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "videos" | "clips")}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <TabsList>
            <TabsTrigger value="videos">Videos ({vods.length})</TabsTrigger>
            <TabsTrigger value="clips">Clips ({clips.length})</TabsTrigger>
          </TabsList>

          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search titles"
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch id="library-bin" checked={showBin} onCheckedChange={setShowBin} />
            <Label htmlFor="library-bin" className="text-sm text-muted-foreground">
              Include pulled
            </Label>
          </div>
        </div>

        <TabsContent value="videos">
          <DataTable
            data={filteredVods}
            columns={vodColumns}
            rowKey={(row) => row.id}
            loading={vodsQ.isLoading}
            emptyMessage="No videos yet. Upload one and it appears on the site."
          />
        </TabsContent>

        <TabsContent value="clips">
          <DataTable
            data={filteredClips}
            columns={clipColumns}
            rowKey={(row) => row.id}
            loading={clipsQ.isLoading}
            emptyMessage="No clips yet."
          />
        </TabsContent>
      </Tabs>

      {/* New video */}
      <Sheet open={vodDraft !== null} onOpenChange={(open) => !open && setVodDraft(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>New video</SheetTitle>
            <SheetDescription>
              An upload, not a stream recording. Recordings appear here on their own
              when a broadcast ends.
            </SheetDescription>
          </SheetHeader>

          {vodDraft ? (
            <div className="space-y-4 px-4 pb-8">
              <div className="space-y-2">
                <Label htmlFor="vod-title">Title</Label>
                <Input
                  id="vod-title"
                  value={vodDraft.title}
                  onChange={(e) => setVodDraft({ ...vodDraft, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vod-description">Description</Label>
                <Textarea
                  id="vod-description"
                  rows={3}
                  value={vodDraft.description}
                  onChange={(e) =>
                    setVodDraft({ ...vodDraft, description: e.target.value })
                  }
                />
              </div>

              {gameSelect(
                vodDraft.gameId,
                (v) => setVodDraft({ ...vodDraft, gameId: v }),
                "vod-game",
              )}

              <MediaUpload
                label="Video file"
                kind="video"
                folder="vods"
                value={vodDraft.mp4Url}
                onChange={(url) => setVodDraft({ ...vodDraft, mp4Url: url })}
                hint="The MP4. Required."
              />

              <MediaUpload
                label="HLS playlist"
                kind="video"
                folder="vods"
                value={vodDraft.hlsUrl}
                onChange={(url) => setVodDraft({ ...vodDraft, hlsUrl: url })}
                hint="Optional. The player falls back to the MP4 without it."
              />

              <MediaUpload
                label="Thumbnail"
                kind="image"
                folder="vods"
                value={vodDraft.thumbnailUrl}
                onChange={(url) => setVodDraft({ ...vodDraft, thumbnailUrl: url })}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vod-duration">Length, minutes</Label>
                  <Input
                    id="vod-duration"
                    inputMode="numeric"
                    value={vodDraft.durationMin}
                    onChange={(e) =>
                      setVodDraft({ ...vodDraft, durationMin: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vod-pillar">Pillar</Label>
                  <Select
                    value={vodDraft.pillar}
                    onValueChange={(v) =>
                      setVodDraft({ ...vodDraft, pillar: v as ShowPillar })
                    }
                  >
                    <SelectTrigger id="vod-pillar">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PILLARS.map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vod-maturity">Maturity</Label>
                  <Select
                    value={vodDraft.maturityRating}
                    onValueChange={(v) =>
                      setVodDraft({ ...vodDraft, maturityRating: v as MaturityRating })
                    }
                  >
                    <SelectTrigger id="vod-maturity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MATURITY.map((m) => (
                        <SelectItem key={m} value={m} className="uppercase">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label htmlFor="vod-premium" className="text-sm">
                  Behind the paywall
                </Label>
                <Switch
                  id="vod-premium"
                  checked={vodDraft.isPremium}
                  onCheckedChange={(v) => setVodDraft({ ...vodDraft, isPremium: v })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setVodDraft(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    vodDraft.title.trim().length < 3 ||
                    !vodDraft.gameId ||
                    !vodDraft.mp4Url.trim() ||
                    !vodDraft.thumbnailUrl.trim() ||
                    saveVod.isPending
                  }
                  onClick={() => saveVod.mutate(vodDraft)}
                >
                  {saveVod.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {vodDraft.id ? "Save video" : "Publish video"}
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* New clip */}
      <Sheet open={clipDraft !== null} onOpenChange={(open) => !open && setClipDraft(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>New clip</SheetTitle>
            <SheetDescription>
              A short cut. Attaching it to a show or a video is what makes it show up
              next to that programme.
            </SheetDescription>
          </SheetHeader>

          {clipDraft ? (
            <div className="space-y-4 px-4 pb-8">
              <div className="space-y-2">
                <Label htmlFor="clip-title">Title</Label>
                <Input
                  id="clip-title"
                  value={clipDraft.title}
                  onChange={(e) => setClipDraft({ ...clipDraft, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clip-source">Cut from</Label>
                <Select
                  value={clipDraft.source}
                  onValueChange={(v) => setClipDraft({ ...clipDraft, source: v })}
                >
                  <SelectTrigger id="clip-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nothing, it stands alone</SelectItem>
                    {shows.length > 0 ? (
                      <>
                        {shows.map((show) => (
                          <SelectItem key={show.id} value={`show:${show.id}`}>
                            Show: {show.title}
                          </SelectItem>
                        ))}
                      </>
                    ) : null}
                    {vods.map((vod) => (
                      <SelectItem key={vod.id} value={`vod:${vod.id}`}>
                        Video: {vod.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {gameSelect(
                clipDraft.gameId,
                (v) => setClipDraft({ ...clipDraft, gameId: v }),
                "clip-game",
              )}

              <div className="space-y-2">
                <Label htmlFor="clip-creator">Creator handle</Label>
                <Input
                  id="clip-creator"
                  value={clipDraft.creatorHandle}
                  onChange={(e) =>
                    setClipDraft({ ...clipDraft, creatorHandle: e.target.value })
                  }
                  placeholder="evotv"
                />
              </div>

              <MediaUpload
                label="Clip file"
                kind="video"
                folder="clips"
                value={clipDraft.mp4Url}
                onChange={(url) => setClipDraft({ ...clipDraft, mp4Url: url })}
              />

              <MediaUpload
                label="Thumbnail"
                kind="image"
                folder="clips"
                value={clipDraft.thumbnailUrl}
                onChange={(url) => setClipDraft({ ...clipDraft, thumbnailUrl: url })}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="clip-duration">Length, seconds</Label>
                  <Input
                    id="clip-duration"
                    inputMode="numeric"
                    value={clipDraft.durationSec}
                    onChange={(e) =>
                      setClipDraft({ ...clipDraft, durationSec: e.target.value })
                    }
                    placeholder="45"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clip-pillar">Pillar</Label>
                  <Select
                    value={clipDraft.pillar}
                    onValueChange={(v) =>
                      setClipDraft({ ...clipDraft, pillar: v as ShowPillar })
                    }
                  >
                    <SelectTrigger id="clip-pillar">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PILLARS.map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setClipDraft(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    clipDraft.title.trim().length < 3 ||
                    !clipDraft.gameId ||
                    !clipDraft.mp4Url.trim() ||
                    !clipDraft.thumbnailUrl.trim() ||
                    !clipDraft.creatorHandle.trim() ||
                    !Number(clipDraft.durationSec) ||
                    saveClip.isPending
                  }
                  onClick={() => saveClip.mutate(clipDraft)}
                >
                  {saveClip.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Publish clip
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pull this from the site?</DialogTitle>
            <DialogDescription>
              {confirm
                ? `"${confirm.label}" stops being reachable. The row is kept and it can be restored from here.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pull.isPending}
              onClick={() => confirm && pull.mutate({ kind: confirm.kind, id: confirm.id })}
            >
              Pull it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
