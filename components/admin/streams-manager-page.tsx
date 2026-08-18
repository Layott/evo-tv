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
  Edit,
} from "@/components/icons";
import { toast } from "sonner";
import {
  adminCreateStream,
  adminDeleteStream,
  adminListEvents,
  adminListGames,
  adminListStreams,
  adminRegenerateStreamKey,
  adminRestoreStream,
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
import { MediaUpload, THUMBNAIL_SPEC } from "@/components/admin/media-upload";
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

  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  // Admin sees every stream, live or not, unlike the public list.
  const streamsQ = useQuery({
    queryKey: ["admin", "streams-all", statusFilter === "deleted"],
    /*
     * Deleted rows are a different query, not a filter over the same list: the
     * API excludes them by default and returns them only when asked. Without
     * this the web admin had no way to see a deleted stream at all, so the
     * restore endpoint that already existed was unreachable, while the app's
     * admin could do it.
     */
    queryFn: () =>
      adminListStreams(
        statusFilter === "deleted"
          ? { limit: 200, deleted: "only" as const }
          : { limit: 200 },
      ),
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
    // "deleted" is served by the query above, so nothing is filtered here.
    return rows;
  }, [all, search, gameFilter, statusFilter]);

  const [selected, setSelected] = React.useState<Stream | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  /** The stream open in the edit form, or null when not editing. */
  const [editing, setEditing] = React.useState<Stream | null>(null);
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

  /**
   * One key per rung of the quality ladder, for the self-hosted RTMP path.
   *
   * The rungs are the same credential with a suffix on the publish name, so
   * they are derived here rather than stored: there is no second secret to
   * manage and no way for this screen to drift out of step with the
   * `hls_variant` lines nginx is configured with.
   *
   * The suffix goes before the query string, because the name is what nginx
   * matches a variant on and the key rides in `?key=`. Appending to the whole
   * string would produce `...?key=secret_low`, which is a broken key rather
   * than a rung, and it would fail authentication rather than fail visibly.
   *
   * Cloudflare ingest gets nothing here: it builds its own ladder server side,
   * so a single key remains correct there.
   */
  const ladderKeys = React.useMemo(() => {
    const key = ingestReveal?.streamKey;
    if (!key || ingestReveal?.kind !== "rtmp") return null;
    const q = key.indexOf("?");
    const name = q === -1 ? key : key.slice(0, q);
    const query = q === -1 ? "" : key.slice(q);
    return [
      { label: "high", hint: "1280x720 · 2200 kbps", value: `${name}_hi${query}` },
      { label: "mid", hint: "854x480 · 900 kbps", value: `${name}_mid${query}` },
      { label: "low", hint: "640x360 · 400 kbps", value: `${name}_low${query}` },
    ];
  }, [ingestReveal]);

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
        thumbnailUrl: payload.thumbnailUrl,
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

  const editMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: NewStreamPayload }) =>
      adminUpdateStream(id, {
        title: payload.title,
        description: payload.description,
        gameId: payload.gameId,
        pillar: payload.pillar,
        eventId: payload.eventId || null,
        streamerName: payload.streamerName,
        isPremium: payload.isPremium,
        thumbnailUrl: payload.thumbnailUrl,
      }),
    onSuccess: async (_res, vars) => {
      setEditing(null);
      toast.success("Stream updated");
      await queryClient.invalidateQueries({ queryKey: ["admin", "streams-all"] });
      /*
       * Re-read the row rather than trusting the response body.
       *
       * `adminUpdateStream` is typed as returning `{ stream }` and the route
       * actually answers a flat `{ ok, streamId, ... }`, so reading `res.stream`
       * here would have quietly left the sheet showing the values the operator
       * had just replaced. The list is the source of truth and has just been
       * invalidated, so this takes the row from there.
       */
      const fresh = await adminListStreams().catch(() => null);
      const row = fresh?.streams.find((r) => r.id === vars.id) ?? null;
      if (row) setSelected((cur) => (cur && cur.id === row.id ? row : cur));
    },
    onError: (err: Error) => toast.error(err.message || "Could not save the changes"),
  });

  function handleEdit(payload: NewStreamPayload) {
    if (!editing) return;
    editMut.mutate({ id: editing.id, payload });
  }

  /*
   * Controls the app's admin has had and this one did not.
   *
   * The two screens run the same platform, so an operator on a laptop could not
   * do things they could do on a phone: force-end a broadcast that was stuck
   * live, set a maturity rating, point a stream at a playout file, or bring
   * back one they had deleted. All four were already accepted by the API; only
   * the web UI was missing.
   */
  const patchMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Parameters<typeof adminUpdateStream>[1];
    }) => adminUpdateStream(id, patch),
    onSuccess: async (_res, vars) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "streams-all"] });
      const fresh = await adminListStreams().catch(() => null);
      const row = fresh?.streams.find((r) => r.id === vars.id) ?? null;
      if (row) setSelected((cur) => (cur && cur.id === row.id ? row : cur));
    },
    onError: (err: Error) => toast.error(err.message || "Could not save that"),
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => adminRestoreStream(id),
    onSuccess: async () => {
      toast.success("Stream restored");
      await queryClient.invalidateQueries({ queryKey: ["admin", "streams-all"] });
    },
    onError: (err: Error) => toast.error(err.message || "Could not restore it"),
  });

  function endBroadcast(row: Stream) {
    patchMut.mutate(
      { id: row.id, patch: { isLive: false, endedAt: new Date().toISOString() } },
      { onSuccess: () => toast.success("Broadcast ended") },
    );
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
            <SelectItem value="deleted">Deleted</SelectItem>
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
                  <div className="mb-1 text-xs text-muted-foreground">Description</div>
                  <p className="text-sm text-foreground/80">{selected.description}</p>
                </div>

                {/*
                  Ratings and playout, both of which the app's admin has had and
                  this screen did not. The API already accepted them; only the
                  web UI was missing, so an operator on a laptop could not do
                  what they could do on a phone.
                */}
                <div className="space-y-1.5">
                  <Label>Maturity rating</Label>
                  <Select
                    value={selected.maturityRating ?? "pg"}
                    onValueChange={(v) =>
                      patchMut.mutate(
                        { id: selected.id, patch: { maturityRating: v as "kids" | "pg" | "teen" | "mature" } },
                        { onSuccess: () => toast.success("Rating updated") },
                      )
                    }
                  >
                    <SelectTrigger className="w-full border-border bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kids">Kids</SelectItem>
                      <SelectItem value="pg">PG</SelectItem>
                      <SelectItem value="teen">Teen</SelectItem>
                      <SelectItem value="mature">Mature</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Drives the parental controls a viewer sets on their account.
                  </p>
                </div>

                {/*
                  How long the broadcast survives losing its feed.

                  Before this, the first disconnect ended the stream outright,
                  so a blip on the encoder's uplink took the channel off air and
                  it stayed off: `on_publish` only fires on connect, so a feed
                  that came back on a connection which never dropped left the
                  stream dead until somebody noticed.
                */}
                <div className="space-y-1.5">
                  <Label>If the feed drops</Label>
                  <Select
                    value={String(
                      (selected as Stream & { reconnectWindowSec?: number })
                        .reconnectWindowSec ?? 300,
                    )}
                    onValueChange={(v) =>
                      patchMut.mutate(
                        { id: selected.id, patch: { reconnectWindowSec: Number(v) } },
                        { onSuccess: () => toast.success("Reconnect window updated") },
                      )
                    }
                  >
                    <SelectTrigger className="w-full border-border bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">End the stream immediately</SelectItem>
                      <SelectItem value="60">Wait 1 minute for it to come back</SelectItem>
                      <SelectItem value="300">Wait 5 minutes</SelectItem>
                      <SelectItem value="900">Wait 15 minutes</SelectItem>
                      <SelectItem value="3600">Wait an hour</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Viewers keep their place while the encoder reconnects. Past
                    the window the broadcast ends for real.
                  </p>
                </div>

                <PlayoutFileField
                  stream={selected}
                  onSave={(path) =>
                    patchMut.mutate(
                      { id: selected.id, patch: { playoutFilePath: path || null } },
                      { onSuccess: () => toast.success("Playout file updated") },
                    )
                  }
                />

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
                          ? "bg-sky-500/25 text-sky-100 hover:bg-sky-500/25"
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
                    {/* Force-end a broadcast. The app's admin has always had
                        this; on the web a stream stuck live could only be
                        cleared by deleting it. */}
                    {selected.isLive ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-card text-foreground hover:bg-accent"
                        onClick={() => endBroadcast(selected)}
                      >
                        <Radio className="h-3.5 w-3.5" />
                        End broadcast
                      </Button>
                    ) : null}
                    {/* Correcting a stream used to mean deleting it and
                        starting again, which issues a new key and means
                        reconfiguring the encoder over a typo. */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-card text-foreground hover:bg-accent"
                      onClick={() => setEditing(selected)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Edit details
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
                {/* Deleting is a soft delete, so a stream removed by mistake is
                    recoverable. The endpoint has always existed; the web admin
                    had no way to reach it because deleted rows were never
                    listed, which the Deleted filter now fixes. */}
                {(selected as Stream & { deletedAt?: string | null }).deletedAt ? (
                  <Button
                    className="bg-sky-600 text-white hover:bg-sky-500"
                    onClick={() => {
                      restoreMut.mutate(selected.id);
                      setSelected(null);
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Restore stream
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    className="bg-red-600 text-white hover:bg-red-500"
                    onClick={() => setConfirmDelete(selected)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete stream
                  </Button>
                )}
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

      {/* The same form, correcting an existing stream. Keyed on the id so the
          fields re-seed when a different stream is opened. */}
      <CreateStreamDrawer
        key={editing?.id ?? "edit"}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSubmit={handleEdit}
        games={games}
        events={events}
        initial={editing}
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
              <span className="text-foreground">Custom</span>, then paste the
              server and a stream key.
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
              {ladderKeys ? (
                <>
                  {/*
                    Three keys, because the channel goes out as three qualities.
                    This screen used to hand over one key, which was right until
                    the ladder existed and actively misleading afterwards: an
                    operator pasted the single key into OBS, got one rendition,
                    and every viewer who could not hold 2.7 Mbps stalled with no
                    lower rung to fall to. The rungs are the same key with a
                    suffix on the name, so there is nothing extra to store and
                    nothing that can drift out of step with the server.
                  */}
                  {ladderKeys.map((rung) => (
                    <CopyField
                      key={rung.label}
                      label={`Stream Key · ${rung.label} (${rung.hint})`}
                      value={rung.value}
                      empty="Not shown again. Regenerate to get a new one."
                      secret
                    />
                  ))}
                </>
              ) : (
                <CopyField
                  label="Stream Key"
                  value={ingestReveal?.streamKey ?? ""}
                  empty="Not shown again. Regenerate to get a new one."
                  secret
                />
              )}
              {ingestReveal?.srtUrl ? (
                <CopyField label="SRT (optional)" value={ingestReveal.srtUrl} />
              ) : null}
            </div>
          )}

          {/* A flat fill, not a 5% wash held together by a ring. The ring
              survived the border token going transparent because it names a
              colour outright, which is how a hairline was still being drawn
              around the one box on this screen that most needs reading. */}
          {!ingestReveal?.keyRetrievable && ingestReveal?.streamKey ? (
            <div className="rounded-lg bg-amber-500/25 p-3 text-xs text-amber-100">
              Copy the key now. Only a hash is stored, so it cannot be shown
              again. Anyone holding it can broadcast as this stream, so treat it
              like a password and never commit it.
            </div>
          ) : null}

          {ladderKeys ? (
            <div className="rounded-lg bg-card/60 p-3 text-xs text-muted-foreground">
              Publish all three. The <span className="text-foreground">high</span>{" "}
              rung goes in OBS itself; the other two go in a multi-output plugin,
              each with its own resolution and bitrate. Set a{" "}
              <span className="text-foreground">keyframe interval of 2</span> on
              every rung: segments are only cut on a keyframe, and rungs whose
              keyframes do not line up cannot be switched between cleanly, so the
              picture stutters at every quality change.
              <br />
              <br />
              Publishing only one rung works, and gives every viewer that single
              quality. Anyone whose connection cannot carry it will stall with
              nothing to fall back to.
            </div>
          ) : (
            <div className="rounded-lg bg-card/60 p-3 text-xs text-muted-foreground">
              Recommended output: 1280x720, 30fps, CBR 2500 kbps, and a{" "}
              <span className="text-foreground">keyframe interval of 2</span>.
              Segments can only be cut on a keyframe, so leaving it on auto gives
              long segments and a slow start.
            </div>
          )}

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
      <div className="mb-0.5 text-[10px] text-muted-foreground">{label}</div>
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

/**
 * Where the scheduled playout reads this programme's file from.
 *
 * Held locally and saved on demand rather than on every keystroke: a path is
 * typed, not picked, and firing a PATCH per character would write dozens of
 * half-finished paths to a live row.
 */
function PlayoutFileField({
  stream,
  onSave,
}: {
  stream: Stream & { playoutFilePath?: string | null };
  onSave: (path: string) => void;
}) {
  const saved = stream.playoutFilePath ?? "";
  const [value, setValue] = React.useState(saved);
  React.useEffect(() => setValue(saved), [saved, stream.id]);
  const dirty = value.trim() !== saved.trim();

  return (
    <div className="space-y-1.5">
      <Label htmlFor="playout">Playout file</Label>
      <div className="flex gap-2">
        <Input
          id="playout"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="/media/shows/episode-01.mp4"
          className="border-border bg-card"
        />
        <Button
          variant="outline"
          className="bg-card hover:bg-accent"
          disabled={!dirty}
          onClick={() => onSave(value.trim())}
        >
          Save
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        The file the scheduler plays for this slot. Leave empty for a live
        broadcast, which comes from the encoder instead.
      </p>
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
  thumbnailUrl: string;
}

/**
 * One form, for creating a stream and for correcting one.
 *
 * Everything here was fixed at creation and had no way back, so a typo in a
 * programme title stayed on air and the only remedy was deleting the stream,
 * which issues a new key and means reconfiguring the encoder over a spelling
 * mistake. Rather than write a second form that would drift from this one, the
 * same fields serve both and `initial` decides which job it is doing.
 */
function CreateStreamDrawer({
  open,
  onOpenChange,
  onSubmit,
  games,
  events,
  initial = null,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (payload: NewStreamPayload) => void;
  games: Game[];
  events: EsportsEvent[];
  /** The stream being edited, or null when creating a new one. */
  initial?: Stream | null;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  // "none" rather than the first game. Defaulting to CoD Mobile silently filed
  // every programme as an esports broadcast, including anime and podcasts.
  const [gameId, setGameId] = React.useState<string>("none");
  const [thumbnailUrl, setThumbnailUrl] = React.useState("");
  const [eventId, setEventId] = React.useState<string>("none");
  const [streamerName, setStreamerName] = React.useState("EVO TV Official");
  const [isPremium, setIsPremium] = React.useState(false);
  const [pillar, setPillar] =
    React.useState<NewStreamPayload["pillar"]>("esports");

  // Seeded from the stream when correcting one, blank when creating. Keyed on
  // `open` so reopening always reflects the row as it stands, not what was
  // typed and abandoned last time.
  React.useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setGameId(initial?.gameId ?? "none");
    setThumbnailUrl(initial?.thumbnailUrl ?? "");
    setEventId(initial?.eventId ?? "none");
    setStreamerName(initial?.streamerName ?? "EVO TV Official");
    setIsPremium(initial?.isPremium ?? false);
    setPillar(
      (initial?.pillar as NewStreamPayload["pillar"] | undefined) ?? "esports",
    );
  }, [open, initial]);

  // Only the title is genuinely required. A game is meaningless for two of the
  // three pillars, so requiring it blocked entering them at all.
  const disabled = !title.trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-border bg-background text-foreground sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{initial ? "Edit stream" : "New stream"}</SheetTitle>
          <SheetDescription>
            {initial
              ? "Changes apply immediately, everywhere this stream is listed. The stream key and the public link are untouched."
              : "Configure an official broadcast. A stream key will be generated."}
          </SheetDescription>
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
          {/*
            Artwork, which had no field at all. The create route hardcoded an
            empty thumbnail, so every stream made here showed a blank tile on
            the schedule and on every card listing it, and the only way to give
            it a poster was to edit the row afterwards.
          */}
          <MediaUpload
            label="Thumbnail"
            value={thumbnailUrl}
            onChange={setThumbnailUrl}
            kind="image"
            folder="streams"
            hint="16:9. Shown on the schedule, the channel page and every card before the stream goes live."
            spec={THUMBNAIL_SPEC}
          />
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
                thumbnailUrl,
              })
            }
          >
            {initial ? "Save changes" : "Create stream"}
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
