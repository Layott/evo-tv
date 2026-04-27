"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Copy,
  Key,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { listLiveStreams, streams as streamsSource } from "@/lib/mock/streams";
import { listGames, games as gamesSource } from "@/lib/mock/games";
import { events as eventsSource } from "@/lib/mock/events";
import type { Stream } from "@/lib/types";
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
import { formatCompact, hashStreamKey, randomHex, timeAgo } from "./utils";

function resolveGameName(id: string) {
  return gamesSource.find((g) => g.id === id)?.shortName ?? id;
}

function resolveEventTitle(id: string | null) {
  if (!id) return null;
  return eventsSource.find((e) => e.id === id)?.title ?? null;
}

export function StreamsManagerPage() {
  const gamesQ = useQuery({ queryKey: ["admin", "games"], queryFn: listGames });
  const [all, setAll] = React.useState<Stream[]>(() => [...streamsSource]);

  const streamsQ = useQuery({
    queryKey: ["admin", "streams-all"],
    queryFn: async () => {
      await listLiveStreams();
      return all;
    },
  });

  React.useEffect(() => {
    if (streamsQ.data) setAll(streamsQ.data as Stream[]);
  }, [streamsQ.data]);

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
  const [keyReveal, setKeyReveal] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<Stream | null>(null);

  const columns: DataColumn<Stream>[] = [
    {
      key: "thumb",
      header: "Stream",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-16 shrink-0 overflow-hidden rounded bg-neutral-800">
            {}
            <img src={row.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-neutral-100">{row.title}</div>
            <div className="truncate text-xs text-neutral-500">{row.streamerName}</div>
          </div>
        </div>
      ),
    },
    {
      key: "game",
      header: "Game",
      sortable: true,
      accessor: (r) => resolveGameName(r.gameId),
      cell: (row) => <span className="text-sm text-neutral-300">{resolveGameName(row.gameId)}</span>,
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
          <span className="text-xs text-neutral-500">Free</span>
        ),
    },
    {
      key: "viewers",
      header: "Viewers",
      sortable: true,
      accessor: (r) => r.viewerCount,
      cell: (row) => (
        <span className="tabular-nums text-sm text-neutral-300">{formatCompact(row.viewerCount)}</span>
      ),
      className: "text-right",
    },
    {
      key: "started",
      header: "Started",
      sortable: true,
      accessor: (r) => (r.startedAt ? new Date(r.startedAt).getTime() : 0),
      cell: (row) => <span className="text-xs text-neutral-400">{timeAgo(row.startedAt)}</span>,
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
          className="rounded-md p-1.5 text-neutral-400 hover:bg-red-500/10 hover:text-red-400"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
      className: "w-12 text-right",
    },
  ];

  function handleCreate(payload: NewStreamPayload) {
    const id = `stream_new_${Date.now()}`;
    const newStream: Stream = {
      id,
      title: payload.title,
      description: payload.description,
      gameId: payload.gameId,
      eventId: payload.eventId || null,
      streamerType: "official",
      streamerName: payload.streamerName,
      streamerAvatarUrl: "/placeholder.svg?height=80&width=80&text=NEW",
      isLive: false,
      startedAt: null,
      endedAt: null,
      hlsUrl: "/demo/sample.m3u8",
      thumbnailUrl: "/placeholder.svg?height=400&width=720&text=New+Stream",
      viewerCount: 0,
      peakViewerCount: 0,
      language: "en",
      tags: [],
      isPremium: payload.isPremium,
    };
    setAll((prev) => [newStream, ...prev]);
    setCreateOpen(false);
    toast.success("Stream created");
    const key = `sk_live_${randomHex(16)}`;
    setKeyReveal(key);
  }

  function handleRegenerate(row: Stream) {
    const key = `sk_live_${randomHex(16)}`;
    setKeyReveal(key);
    toast.success(`Regenerated stream key for ${row.title}`);
  }

  function handleDelete() {
    if (!confirmDelete) return;
    setAll((prev) => prev.filter((s) => s.id !== confirmDelete.id));
    toast.success(`Deleted "${confirmDelete.title}"`);
    setConfirmDelete(null);
    setSelected(null);
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
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or streamer"
            className="border-neutral-800 bg-neutral-900 pl-8 text-sm"
          />
        </div>

        <Select value={gameFilter} onValueChange={setGameFilter}>
          <SelectTrigger className="w-40 border-neutral-800 bg-neutral-900">
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
          <SelectTrigger className="w-36 border-neutral-800 bg-neutral-900">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto text-xs text-neutral-500">{filtered.length} streams</div>
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
        <SheetContent className="w-full overflow-y-auto border-neutral-800 bg-neutral-950 text-neutral-100 sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>
                  {resolveGameName(selected.gameId)} · {selected.streamerName}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-4">
                <div className="overflow-hidden rounded-lg border border-neutral-800">
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
                  {resolveEventTitle(selected.eventId) ? (
                    <div className="col-span-2">
                      <Info label="Event">{resolveEventTitle(selected.eventId)}</Info>
                    </div>
                  ) : null}
                </div>

                <div>
                  <div className="mb-1 text-xs uppercase tracking-wider text-neutral-500">Description</div>
                  <p className="text-sm text-neutral-300">{selected.description}</p>
                </div>

                <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Key className="h-4 w-4 text-sky-400" />
                    <h4 className="text-sm font-semibold text-neutral-100">OBS / RTMP settings</h4>
                  </div>
                  <div className="space-y-2 text-xs">
                    <Row label="Server">
                      <code className="rounded bg-neutral-950 px-2 py-1 font-mono text-neutral-300">
                        rtmp://localhost:1935/live
                      </code>
                    </Row>
                    <Row label="Stream key">
                      <code className="rounded bg-neutral-950 px-2 py-1 font-mono text-neutral-300">
                        {hashStreamKey(`sk_live_${selected.id.slice(-16).padStart(16, "0")}`)}
                      </code>
                    </Row>
                    <Row label="Video">1080p · 6000 kbps · H.264 · 60 fps</Row>
                    <Row label="Audio">160 kbps · AAC · 48 kHz</Row>
                    <Row label="Keyframe">2 sec</Row>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
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
      />

      {/* Reveal key */}
      <Dialog open={!!keyReveal} onOpenChange={(o) => !o && setKeyReveal(null)}>
        <DialogContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Reveal stream key</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Copy this key now — it will not be shown again. Treat it like a password.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
            Anyone with this key can stream on behalf of the account. Never share publicly or commit to version control.
          </div>
          <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 p-2">
            <code className="flex-1 truncate font-mono text-sm text-sky-300">{keyReveal}</code>
            <Button
              size="sm"
              variant="outline"
              className="border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
              onClick={() => {
                if (keyReveal) {
                  navigator.clipboard?.writeText(keyReveal).catch(() => {});
                  toast.success("Stream key copied");
                }
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setKeyReveal(null)} className="bg-sky-600 hover:bg-sky-500">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Delete stream?</DialogTitle>
            <DialogDescription className="text-neutral-400">
              This will permanently remove "{confirmDelete?.title}". This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
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
      <div className="mb-0.5 text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="text-neutral-200">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-neutral-500">{label}</span>
      <span className="truncate text-neutral-300">{children}</span>
    </div>
  );
}

interface NewStreamPayload {
  title: string;
  description: string;
  gameId: string;
  eventId: string;
  streamerName: string;
  isPremium: boolean;
}

function CreateStreamDrawer({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (payload: NewStreamPayload) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [gameId, setGameId] = React.useState(gamesSource[0]?.id ?? "");
  const [eventId, setEventId] = React.useState<string>("none");
  const [streamerName, setStreamerName] = React.useState("EVO TV Official");
  const [isPremium, setIsPremium] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setGameId(gamesSource[0]?.id ?? "");
      setEventId("none");
      setStreamerName("EVO TV Official");
      setIsPremium(false);
    }
  }, [open]);

  const disabled = !title.trim() || !gameId;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-neutral-800 bg-neutral-950 text-neutral-100 sm:max-w-lg">
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
              placeholder="EVO Finals — Grand Final LIVE"
              className="border-neutral-800 bg-neutral-900"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this stream about?"
              className="min-h-[80px] border-neutral-800 bg-neutral-900"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Game</Label>
              <Select value={gameId} onValueChange={setGameId}>
                <SelectTrigger className="w-full border-neutral-800 bg-neutral-900">
                  <SelectValue placeholder="Select game" />
                </SelectTrigger>
                <SelectContent>
                  {gamesSource.map((g) => (
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
                <SelectTrigger className="w-full border-neutral-800 bg-neutral-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No event</SelectItem>
                  {eventsSource.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="streamer">Streamer</Label>
            <Input
              id="streamer"
              value={streamerName}
              onChange={(e) => setStreamerName(e.target.value)}
              className="border-neutral-800 bg-neutral-900"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
            <div>
              <div className="text-sm font-medium text-neutral-100">Premium only</div>
              <div className="text-xs text-neutral-400">Restrict access to premium subscribers.</div>
            </div>
            <Switch checked={isPremium} onCheckedChange={setIsPremium} />
          </div>
        </div>
        <SheetFooter>
          <Button
            variant="outline"
            className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
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
                gameId,
                eventId: eventId === "none" ? "" : eventId,
                streamerName: streamerName.trim() || "EVO TV Official",
                isPremium,
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
