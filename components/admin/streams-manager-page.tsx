"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Key,
  Plus,
  RefreshCw,
  Radio,
  Pin,
  Search,
  Trash2,
} from "@/components/icons";
import { toast } from "sonner";
import {
  adminCreateStream,
  adminDeleteStream,
  adminListEvents,
  adminListGames,
  adminListStreams,
  adminRegenerateStreamKey,
  adminGetStreamIngest,
  type IngestDetails,
  adminUpdateStream,
} from "@/lib/client";
import type { EsportsEvent, Game, Stream } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  SheetFooter,
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
import { StatusBadge } from "./status-badge";
import { formatCompact, timeAgo } from "./utils";

function resolveGameName(games: Game[], id: string | null | undefined) {
  // A stream in the anime or lifestyle pillar has no game.
  if (!id) return "-";
  return games.find((g) => g.id === id)?.shortName ?? id;
}

function resolveEventTitle(events: EsportsEvent[], id: string | null) {
  if (!id) return null;
  return events.find((e) => e.id === id)?.title ?? null;
}

export function StreamsManagerPage() {
  const queryClient = useQueryClient();

  const gamesQ = useQuery({
    queryKey: ["admin", "games"],
    queryFn: () => adminListGames(),
  });
  const eventsQ = useQuery({
    queryKey: ["admin", "events"],
    queryFn: () => adminListEvents(),
  });

  // Admin sees every stream, live or not, unlike the public list.
  const streamsQ = useQuery({
    queryKey: ["admin", "streams-all"],
    queryFn: () => adminListStreams({ limit: 200 }),
  });

  const games = gamesQ.data ?? [];
  const events = eventsQ.data ?? [];
  const all = streamsQ.data?.streams ?? [];

  const refreshStreams = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["admin", "streams-all"] }),
    [queryClient],
  );

  const [search, setSearch] = React.useState("");
  const [gameFilter, setGameFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const filtered = React.useMemo(() => {
    let rows = all;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (s) => s.title.toLowerCase().includes(q) || s.streamerName.toLowerCase().includes(q),
      );
    }
    if (gameFilter !== "all") rows = rows.filter((s) => s.gameId === gameFilter);
    if (statusFilter === "live") rows = rows.filter((s) => s.isLive);
    if (statusFilter === "offline") rows = rows.filter((s) => !s.isLive);
    return rows;
  }, [all, search, gameFilter, statusFilter]);

  const [selected, setSelected] = React.useState<Stream | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  /**
   * OBS settings to show. Was a bare key string, which is half of what OBS
   * needs: without the Server URL an operator cannot configure anything, and
   * the RTMPS endpoint differs per ingest.
   */
  const [ingestReveal, setIngestReveal] = React.useState<IngestDetails | null>(
    null,
  );
  /** Ingest details for the stream in the detail panel. */
  const [selectedIngest, setSelectedIngest] =
    React.useState<IngestDetails | null>(null);

  React.useEffect(() => {
    if (!selected) {
      setSelectedIngest(null);
      return;
    }
    let cancelled = false;
    setSelectedIngest(null);
    void adminGetStreamIngest(selected.id).then((ing) => {
      if (!cancelled) setSelectedIngest(ing);
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);
  const [confirmDelete, setConfirmDelete] = React.useState<Stream | null>(null);

  const columns: DataColumn<Stream>[] = [
    {
      key: "thumb",
      header: "Stream",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-16 shrink-0 overflow-hidden rounded bg-muted">
            {}
            <img src={row.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{row.title}</div>
            <div className="truncate text-xs text-muted-foreground">{row.streamerName}</div>
          </div>
        </div>
      ),
    },
    {
      key: "game",
      header: "Game",
      sortable: true,
      accessor: (r) => resolveGameName(games, r.gameId ?? undefined),
      cell: (row) => <span className="text-sm text-foreground/80">{resolveGameName(games, row.gameId ?? undefined)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (r) => (r.isLive ? 1 : 0),
      cell: (row) =>
        row.isLive ? (
          <StatusBadge tone="red" dot>
            LIVE
          </StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Offline</StatusBadge>
        ),
    },
    {
      key: "premium",
      header: "Tier",
      sortable: true,
      accessor: (r) => (r.isPremium ? 1 : 0),
      cell: (row) =>
        row.isPremium ? (
          <StatusBadge tone="amber">Premium</StatusBadge>
        ) : (
          <span className="text-xs text-muted-foreground">Free</span>
        ),
    },
    {
      key: "viewers",
      header: "Viewers",
      sortable: true,
      accessor: (r) => r.viewerCount,
      cell: (row) => (
        <span className="tabular-nums text-sm text-foreground/80">{formatCompact(row.viewerCount)}</span>
      ),
      className: "text-right",
    },
    {
      key: "started",
      header: "Started",
      sortable: true,
      accessor: (r) => (r.startedAt ? new Date(r.startedAt).getTime() : 0),
      cell: (row) => <span className="text-xs text-muted-foreground">{timeAgo(row.startedAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmDelete(row);
          }}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
      className: "w-12 text-right",
    },
  ];

  const createMut = useMutation({
    mutationFn: (payload: NewStreamPayload) =>
      adminCreateStream({
        title: payload.title,
        description: payload.description,
        gameId: payload.gameId,
        pillar: payload.pillar,
        eventId: payload.eventId || null,
        streamerName: payload.streamerName,
        isPremium: payload.isPremium,
      }),
    onSuccess: async (res) => {
      setCreateOpen(false);
      toast.success("Stream created");
      // Shown once and never again; the server stores only a hash.
      if (res.ingestError) {
        toast.error(`Ingest not provisioned: ${res.ingestError}`);
      }
      // Shown once for the self-hosted path; the server stores only a hash.
      if (res.ingest) setIngestReveal(res.ingest);
      await refreshStreams();
    },
    onError: (err: Error) => toast.error(err.message || "Could not create the stream"),
  });

  const regenerateMut = useMutation({
    mutationFn: (row: Stream) => adminRegenerateStreamKey(row.id),
    onSuccess: (res, row) => {
      // Regenerate returns the key alone. Pair it with the server URL so the
      // dialog is still something an operator can act on.
      setIngestReveal({
        kind: "rtmp",
        server: null,
        streamKey: res.streamKey,
        hlsUrl: "",
        keyRetrievable: false,
      });
      void adminGetStreamIngest(row.id).then((ing) => {
        if (ing?.server) {
          setIngestReveal((cur) =>
            cur ? { ...cur, kind: ing.kind, server: ing.server } : cur,
          );
        }
      });
      toast.success("Stream key regenerated");
    },
    onError: (err: Error) => toast.error(err.message || "Could not regenerate the key"),
  });

  const mainChannelMut = useMutation({
    mutationFn: ({ row, value }: { row: Stream; value: boolean }) =>
      adminUpdateStream(row.id, { isMainChannel: value }),
    onSuccess: async (_res, vars) => {
      toast.success(
        vars.value
          ? "This is now the main channel"
          : "No longer the main channel",
      );
      setSelected(null);
      await refreshStreams();
    },
    onError: (err: Error) =>
      toast.error(err.message || "Could not change the main channel"),
  });

  const deleteMut = useMutation({
    mutationFn: (row: Stream) => adminDeleteStream(row.id),
    onSuccess: async () => {
      toast.success("Stream deleted");
      setConfirmDelete(null);
      setSelected(null);
      await refreshStreams();
    },
    onError: (err: Error) => toast.error(err.message || "Could not delete the stream"),
  });

  /**
   * Taking a stream live. Nothing else can do this for an externally originated
   * channel: the RTMP callback only fires for encoders publishing to our own
   * ingest, and a Cloudflare-hosted channel never calls back.
   */
  const liveMut = useMutation({
    mutationFn: ({ row, isLive }: { row: Stream; isLive: boolean }) =>
      adminUpdateStream(row.id, { isLive }),
    onSuccess: async (_res, vars) => {
      toast.success(vars.isLive ? "Stream is live" : "Stream ended");
      await refreshStreams();
    },
    onError: (err: Error) => toast.error(err.message || "Could not change the stream state"),
  });

  function handleCreate(payload: NewStreamPayload) {
    createMut.mutate(payload);
  }

  /**
   * Re-open the OBS settings for an existing stream.
   *
   * Only reachable at creation before this, so closing that dialog meant
   * regenerating the key just to see the server URL again, which invalidates
   * the encoder already configured with the old one.
   */
  function handleShowIngest(row: Stream) {
    void adminGetStreamIngest(row.id).then((ing) => {
      if (!ing) {
        toast.error("Could not load the broadcast settings");
        return;
      }
      setIngestReveal(ing);
    });
  }

  function handleRegenerate(row: Stream) {
    regenerateMut.mutate(row);
  }

  function handleDelete() {
    if (!confirmDelete) return;
    deleteMut.mutate(confirmDelete);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Streams"
        description="Manage live broadcasts, stream keys and OBS settings."
        actions={
          <Button className="bg-sky-600 text-white hover:bg-sky-500" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New stream
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or streamer"
            className="border-border bg-card pl-8 text-sm"
          />
        </div>

        <Select value={gameFilter} onValueChange={setGameFilter}>
          <SelectTrigger className="w-40 border-border bg-card">
            <SelectValue placeholder="All games" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All games</SelectItem>
            {(gamesQ.data ?? []).map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.shortName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 border-border bg-card">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto text-xs text-muted-foreground">{filtered.length} streams</div>
      </div>

      <DataTable<Stream>
        data={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setSelected(r)}
        loading={streamsQ.isLoading}
        emptyMessage="No streams match these filters."
      />

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto border-border bg-background text-foreground sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>
                  {resolveGameName(games, selected.gameId ?? undefined)} · {selected.streamerName}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-4">
                <div className="overflow-hidden rounded-lg border border-border">
                  {}
                  <img src={selected.thumbnailUrl} alt="" className="w-full object-cover" />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Status">
                    {selected.isLive ? (
                      <StatusBadge tone="red" dot>
                        LIVE
                      </StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">Offline</StatusBadge>
                    )}
                  </Info>
                  <Info label="Tier">
                    {selected.isPremium ? (
                      <StatusBadge tone="amber">Premium</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">Free</StatusBadge>
                    )}
                  </Info>
                  <Info label="Viewers">
                    <span className="tabular-nums">{selected.viewerCount.toLocaleString()}</span>
                  </Info>
                  <Info label="Peak">
                    <span className="tabular-nums">{selected.peakViewerCount.toLocaleString()}</span>
                  </Info>
                  <Info label="Started">{timeAgo(selected.startedAt)}</Info>
                  <Info label="Language">{selected.language.toUpperCase()}</Info>
                  {resolveEventTitle(events, selected.eventId) ? (
                    <div className="col-span-2">
                      <Info label="Event">{resolveEventTitle(events, selected.eventId)}</Info>
                    </div>
                  ) : null}
                </div>

                <div>
                  <div className="mb-1 text-xs r text-muted-foreground">Description</div>
                  <p className="text-sm text-foreground/80">{selected.description}</p>
                </div>

                <div className="rounded-lg border border-border bg-card/40 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Key className="h-4 w-4 text-sky-400" />
                    <h4 className="text-sm font-semibold text-foreground">OBS / RTMP settings</h4>
                  </div>
                  <div className="space-y-2 text-xs">
                    {/* Read from the server, not written here.
                        This was a hardcoded "rtmp://localhost:1935/live", so
                        production showed every operator their own machine as
                        the ingest. Pasted into OBS it fails with "could not
                        access the specified channel or stream key", which reads
                        like a bad key and is not. */}
                    <Row label="Server">
                      {selectedIngest?.server ? (
                        <code className="rounded bg-background px-2 py-1 font-mono text-foreground/80">
                          {selectedIngest.server}
                        </code>
                      ) : (
                        <span className="text-muted-foreground">
                          {selectedIngest ? "No ingest configured" : "Loading…"}
                        </span>
                      )}
                    </Row>
                    {/* The server stores only a hash, so a key can never be
                        shown again. This used to render one derived from the
                        stream id, which looked real and was not: pasting it into
                        OBS would have failed to authenticate. */}
                    <Row label="Stream key">
                      <span className="text-muted-foreground">
                        Shown once on creation. Regenerate to get a new one.
                      </span>
                    </Row>
                    {/* These read as facts about the stream but nothing
                        measures them: they were a hardcoded 1080p/6000kbps/60fps
                        claim on a stream that might be anything. They are
                        recommendations, so they say so, and the numbers now
                        match what the self-hosted path actually handles. */}
                    <Row label="Recommended video">
                      720p · 2500 kbps · H.264 · 30 fps
                    </Row>
                    <Row label="Recommended audio">128 kbps · AAC</Row>
                    <Row label="Keyframe interval">
                      2 sec (required, not optional)
                    </Row>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {/* The flagship. Exactly one stream can hold it; the API
                        demotes the incumbent, so this is a plain toggle rather
                        than a two-step the operator has to remember. */}
                    <Button
                      variant="outline"
                      size="sm"
                      className={
                        (selected as Stream & { isMainChannel?: boolean })
                          .isMainChannel
                          ? "border-sky-500/60 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
                          : "bg-card text-foreground hover:bg-accent"
                      }
                      onClick={() =>
                        mainChannelMut.mutate({
                          row: selected,
                          value: !(selected as Stream & { isMainChannel?: boolean })
                            .isMainChannel,
                        })
                      }
                    >
                      <Pin className="h-3.5 w-3.5" />
                      {(selected as Stream & { isMainChannel?: boolean })
                        .isMainChannel
                        ? "Main channel"
                        : "Make main channel"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-card text-foreground hover:bg-accent"
                      onClick={() => handleShowIngest(selected)}
                    >
                      <Radio className="h-3.5 w-3.5" />
                      Broadcast settings
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-card text-foreground hover:bg-accent"
                      onClick={() => handleRegenerate(selected)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Regenerate key
                    </Button>
                  </div>
                </div>
              </div>
              <SheetFooter>
                <Button
                  variant="destructive"
                  className="bg-red-600 text-white hover:bg-red-500"
                  onClick={() => setConfirmDelete(selected)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete stream
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Create sheet */}
      <CreateStreamDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        games={games}
        events={events}
      />

      {/* Reveal key */}
      {/* OBS setup */}
      <Dialog
        open={!!ingestReveal}
        onOpenChange={(o) => !o && setIngestReveal(null)}
      >
        <DialogContent className="border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Broadcast settings</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              In OBS: Settings, Stream, Service{" "}
              <span className="text-foreground">Custom</span>, then paste these
              two fields.
            </DialogDescription>
          </DialogHeader>

          {ingestReveal?.kind === "manual" ? (
            <div className="rounded-lg border border-border bg-card/60 p-3 text-xs text-foreground/80">
              No ingest is provisioned for this stream. Set a playback URL by
              hand, or configure an ingest and create the stream again.
            </div>
          ) : (
            <div className="space-y-3">
              <CopyField
                label="Server"
                value={ingestReveal?.server ?? ""}
                empty="Not available"
              />
              <CopyField
                label="Stream Key"
                value={ingestReveal?.streamKey ?? ""}
                empty="Not shown again. Regenerate to get a new one."
                secret
              />
              {ingestReveal?.srtUrl ? (
                <CopyField label="SRT (optional)" value={ingestReveal.srtUrl} />
              ) : null}
            </div>
          )}

          {!ingestReveal?.keyRetrievable && ingestReveal?.streamKey ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
              Copy the key now. Only a hash is stored, so it cannot be shown
              again. Anyone holding it can broadcast as this stream, so treat it
              like a password and never commit it.
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-card/40 p-3 text-xs text-muted-foreground">
            Recommended output: 1280x720, 30fps, CBR 2500 kbps, and a{" "}
            <span className="text-foreground">keyframe interval of 2</span>.
            Segments can only be cut on a keyframe, so leaving it on auto gives
            long segments and a slow start.
          </div>

          <DialogFooter>
            <Button
              onClick={() => setIngestReveal(null)}
              className="bg-sky-600 hover:bg-sky-500"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Delete stream?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This will permanently remove "{confirmDelete?.title}". This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="bg-card hover:bg-accent"
              onClick={() => setConfirmDelete(null)}
            >
              Cancel
            </Button>
            <Button className="bg-red-600 text-white hover:bg-red-500" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-[10px] r text-muted-foreground">{label}</div>
      <div className="text-foreground">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-foreground/80">{children}</span>
    </div>
  );
}

interface NewStreamPayload {
  title: string;
  description: string;
  /** Null for anime, lifestyle and podcast programmes, which have no game. */
  gameId: string | null;
  eventId: string;
  streamerName: string;
  isPremium: boolean;
  pillar: "esports" | "anime" | "lifestyle";
}

function CreateStreamDrawer({
  open,
  onOpenChange,
  onSubmit,
  games,
  events,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (payload: NewStreamPayload) => void;
  games: Game[];
  events: EsportsEvent[];
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  // "none" rather than the first game. Defaulting to CoD Mobile silently filed
  // every programme as an esports broadcast, including anime and podcasts.
  const [gameId, setGameId] = React.useState<string>("none");
  const [eventId, setEventId] = React.useState<string>("none");
  const [streamerName, setStreamerName] = React.useState("EVO TV Official");
  const [isPremium, setIsPremium] = React.useState(false);
  const [pillar, setPillar] =
    React.useState<NewStreamPayload["pillar"]>("esports");

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setGameId("none");
      setEventId("none");
      setStreamerName("EVO TV Official");
      setIsPremium(false);
      setPillar("esports");
    }
  }, [open]);

  // Only the title is genuinely required. A game is meaningless for two of the
  // three pillars, so requiring it blocked entering them at all.
  const disabled = !title.trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-border bg-background text-foreground sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>New stream</SheetTitle>
          <SheetDescription>Configure an official broadcast. A stream key will be generated.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="EVO Finals - Grand Final LIVE"
              className="border-border bg-card"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this stream about?"
              className="min-h-[80px] border-border bg-card"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Game (optional)</Label>
              <Select value={gameId} onValueChange={setGameId}>
                <SelectTrigger className="w-full border-border bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No game</SelectItem>
                  {games.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.shortName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Event (optional)</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger className="w-full border-border bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No event</SelectItem>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Pillar</Label>
            <Select
              value={pillar}
              onValueChange={(v) => setPillar(v as NewStreamPayload["pillar"])}
            >
              <SelectTrigger className="w-full border-border bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="esports">Esports</SelectItem>
                <SelectItem value="anime">Anime</SelectItem>
                <SelectItem value="lifestyle">Lifestyle</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              What the programme is. Drives the filters on the schedule and the
              week grid.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="streamer">Streamer</Label>
            <Input
              id="streamer"
              value={streamerName}
              onChange={(e) => setStreamerName(e.target.value)}
              className="border-border bg-card"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-3">
            <div>
              <div className="text-sm font-medium text-foreground">Premium only</div>
              <div className="text-xs text-muted-foreground">Restrict access to premium subscribers.</div>
            </div>
            <Switch checked={isPremium} onCheckedChange={setIsPremium} />
          </div>
        </div>
        <SheetFooter>
          <Button
            variant="outline"
            className="bg-card hover:bg-accent"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-sky-600 text-white hover:bg-sky-500"
            disabled={disabled}
            onClick={() =>
              onSubmit({
                title: title.trim(),
                description: description.trim(),
                gameId: gameId === "none" ? null : gameId,
                eventId: eventId === "none" ? "" : eventId,
                streamerName: streamerName.trim() || "EVO TV Official",
                isPremium,
                pillar,
              })
            }
          >
            Create stream
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * One labelled, copyable value.
 *
 * The old dialog rendered a single bare `<code>` and one Copy button, so the
 * server URL had nowhere to go. Labels match OBS exactly so there is no
 * guessing about which box a value belongs in.
 */
function CopyField({
  label,
  value,
  empty,
  secret,
}: {
  label: string;
  value: string;
  empty?: string;
  secret?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
          <code
            className={`flex-1 truncate font-mono text-sm ${
              secret ? "text-sky-300" : "text-foreground"
            }`}
          >
            {value}
          </code>
          <Button
            size="sm"
            variant="outline"
            className="bg-card text-foreground hover:bg-accent"
            onClick={() => {
              navigator.clipboard?.writeText(value).catch(() => {});
              toast.success(`${label} copied`);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-card/50 p-2 text-xs text-muted-foreground">
          {empty ?? "Not available"}
        </div>
      )}
    </div>
  );
}
