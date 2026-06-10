"use client";

import * as React from "react";
import { Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { games as gamesSource } from "@/lib/mock/games";
import { teams as teamsSource } from "@/lib/mock/teams";
import { players as playersSource } from "@/lib/mock/players";
import { events as eventsSource } from "@/lib/mock/events";
import type {
  EsportsEvent,
  EventStatus,
  EventTier,
  Game,
  Player,
  Team,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { formatDate, formatNgn, formatNumber } from "./utils";

type ContentTab = "games" | "teams" | "players" | "events";

export function ContentManagerPage() {
  const [tab, setTab] = React.useState<ContentTab>("games");

  const [games, setGames] = React.useState<Game[]>(() => [...gamesSource]);
  const [teams, setTeams] = React.useState<Team[]>(() => [...teamsSource]);
  const [players, setPlayers] = React.useState<Player[]>(() => [...playersSource]);
  const [events, setEvents] = React.useState<EsportsEvent[]>(() => [...eventsSource]);

  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState<
    | { kind: "game"; row: Game | null }
    | { kind: "team"; row: Team | null }
    | { kind: "player"; row: Player | null }
    | { kind: "event"; row: EsportsEvent | null }
    | null
  >(null);
  const [confirmDelete, setConfirmDelete] = React.useState<{ kind: ContentTab; id: string; label: string } | null>(
    null,
  );

  const handleSaveGame = (row: Game) => {
    setGames((prev) => {
      const exists = prev.some((g) => g.id === row.id);
      return exists ? prev.map((g) => (g.id === row.id ? row : g)) : [row, ...prev];
    });
    toast.success(editing?.row ? "Game updated" : "Game created");
    setEditing(null);
  };
  const handleSaveTeam = (row: Team) => {
    setTeams((prev) => {
      const exists = prev.some((g) => g.id === row.id);
      return exists ? prev.map((g) => (g.id === row.id ? row : g)) : [row, ...prev];
    });
    toast.success(editing?.row ? "Team updated" : "Team created");
    setEditing(null);
  };
  const handleSavePlayer = (row: Player) => {
    setPlayers((prev) => {
      const exists = prev.some((g) => g.id === row.id);
      return exists ? prev.map((g) => (g.id === row.id ? row : g)) : [row, ...prev];
    });
    toast.success(editing?.row ? "Player updated" : "Player created");
    setEditing(null);
  };
  const handleSaveEvent = (row: EsportsEvent) => {
    setEvents((prev) => {
      const exists = prev.some((g) => g.id === row.id);
      return exists ? prev.map((g) => (g.id === row.id ? row : g)) : [row, ...prev];
    });
    toast.success(editing?.row ? "Event updated" : "Event created");
    setEditing(null);
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    const { kind, id, label } = confirmDelete;
    if (kind === "games") setGames((p) => p.filter((x) => x.id !== id));
    if (kind === "teams") setTeams((p) => p.filter((x) => x.id !== id));
    if (kind === "players") setPlayers((p) => p.filter((x) => x.id !== id));
    if (kind === "events") setEvents((p) => p.filter((x) => x.id !== id));
    toast.success(`Deleted "${label}"`);
    setConfirmDelete(null);
  };

  const filteredGames = filterByQuery(games, search, (r) => [r.name, r.slug, r.shortName]);
  const filteredTeams = filterByQuery(teams, search, (r) => [r.name, r.slug, r.tag]);
  const filteredPlayers = filterByQuery(players, search, (r) => [r.handle, r.realName]);
  const filteredEvents = filterByQuery(events, search, (r) => [r.title, r.slug, r.format]);

  const newButton = (
    <Button
      className="bg-sky-600 text-white hover:bg-sky-500"
      onClick={() => {
        if (tab === "games") setEditing({ kind: "game", row: null });
        if (tab === "teams") setEditing({ kind: "team", row: null });
        if (tab === "players") setEditing({ kind: "player", row: null });
        if (tab === "events") setEditing({ kind: "event", row: null });
      }}
    >
      <Plus className="h-4 w-4" />
      New {tab.slice(0, -1)}
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        description="Manage games, teams, players and esports events."
        actions={newButton}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as ContentTab)}>
        <div className="flex flex-wrap items-center gap-3">
          <TabsList className="bg-neutral-900">
            <TabsTrigger value="games">Games</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${tab}…`}
              className="border-neutral-800 bg-neutral-900 pl-8"
            />
          </div>
        </div>

        <TabsContent value="games" className="mt-4">
          <GamesTable
            rows={filteredGames}
            onEdit={(r) => setEditing({ kind: "game", row: r })}
            onDelete={(r) => setConfirmDelete({ kind: "games", id: r.id, label: r.name })}
          />
        </TabsContent>
        <TabsContent value="teams" className="mt-4">
          <TeamsTable
            rows={filteredTeams}
            onEdit={(r) => setEditing({ kind: "team", row: r })}
            onDelete={(r) => setConfirmDelete({ kind: "teams", id: r.id, label: r.name })}
          />
        </TabsContent>
        <TabsContent value="players" className="mt-4">
          <PlayersTable
            rows={filteredPlayers}
            onEdit={(r) => setEditing({ kind: "player", row: r })}
            onDelete={(r) => setConfirmDelete({ kind: "players", id: r.id, label: r.handle })}
          />
        </TabsContent>
        <TabsContent value="events" className="mt-4">
          <EventsTable
            rows={filteredEvents}
            onEdit={(r) => setEditing({ kind: "event", row: r })}
            onDelete={(r) => setConfirmDelete({ kind: "events", id: r.id, label: r.title })}
          />
        </TabsContent>
      </Tabs>

      {editing?.kind === "game" ? (
        <GameForm
          initial={editing.row}
          onCancel={() => setEditing(null)}
          onSave={handleSaveGame}
        />
      ) : null}
      {editing?.kind === "team" ? (
        <TeamForm
          initial={editing.row}
          onCancel={() => setEditing(null)}
          onSave={handleSaveTeam}
        />
      ) : null}
      {editing?.kind === "player" ? (
        <PlayerForm
          initial={editing.row}
          onCancel={() => setEditing(null)}
          onSave={handleSavePlayer}
        />
      ) : null}
      {editing?.kind === "event" ? (
        <EventForm
          initial={editing.row}
          onCancel={() => setEditing(null)}
          onSave={handleSaveEvent}
        />
      ) : null}

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Delete {confirmDelete?.kind.slice(0, -1)}?</DialogTitle>
            <DialogDescription className="text-neutral-400">
              This will permanently delete "{confirmDelete?.label}".
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

function filterByQuery<T>(rows: T[], q: string, get: (r: T) => string[]): T[] {
  const s = q.trim().toLowerCase();
  if (!s) return rows;
  return rows.filter((r) => get(r).some((v) => v.toLowerCase().includes(s)));
}

/* ------- Tables ------- */

function GamesTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: Game[];
  onEdit: (r: Game) => void;
  onDelete: (r: Game) => void;
}) {
  const columns: DataColumn<Game>[] = [
    {
      key: "name",
      header: "Game",
      sortable: true,
      accessor: (r) => r.name,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 overflow-hidden rounded bg-neutral-800">
            {}
            <img src={row.iconUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="text-sm font-medium text-neutral-100">{row.name}</div>
            <div className="text-xs text-neutral-500">/{row.slug}</div>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      accessor: (r) => r.category,
      cell: (row) => <StatusBadge tone="violet">{row.category.toUpperCase()}</StatusBadge>,
    },
    {
      key: "platform",
      header: "Platform",
      sortable: true,
      accessor: (r) => r.platform,
      cell: (row) => <StatusBadge tone="neutral">{row.platform}</StatusBadge>,
    },
    {
      key: "players",
      header: "Active players",
      sortable: true,
      accessor: (r) => r.activePlayers,
      cell: (row) => <span className="tabular-nums text-sm">{formatNumber(row.activePlayers)}</span>,
      className: "text-right",
    },
    deleteColumn(onDelete),
  ];
  return <DataTable<Game> data={rows} columns={columns} rowKey={(r) => r.id} onRowClick={onEdit} />;
}

function TeamsTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: Team[];
  onEdit: (r: Team) => void;
  onDelete: (r: Team) => void;
}) {
  const columns: DataColumn<Team>[] = [
    {
      key: "name",
      header: "Team",
      sortable: true,
      accessor: (r) => r.name,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 overflow-hidden rounded bg-neutral-800">
            {}
            <img src={row.logoUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="text-sm font-medium text-neutral-100">{row.name}</div>
            <div className="text-xs text-neutral-500">[{row.tag}]</div>
          </div>
        </div>
      ),
    },
    {
      key: "game",
      header: "Game",
      sortable: true,
      accessor: (r) => gamesSource.find((g) => g.id === r.gameId)?.shortName ?? "",
      cell: (row) => (
        <span className="text-sm text-neutral-300">
          {gamesSource.find((g) => g.id === row.gameId)?.shortName ?? "—"}
        </span>
      ),
    },
    {
      key: "region",
      header: "Region",
      sortable: true,
      accessor: (r) => r.region,
      cell: (row) => <span className="text-sm text-neutral-300">{row.region}</span>,
    },
    {
      key: "country",
      header: "Country",
      cell: (row) => <StatusBadge tone="neutral">{row.country}</StatusBadge>,
    },
    {
      key: "ranking",
      header: "Rank",
      sortable: true,
      accessor: (r) => r.ranking,
      cell: (row) => <span className="tabular-nums text-sm">#{row.ranking}</span>,
    },
    {
      key: "followers",
      header: "Followers",
      sortable: true,
      accessor: (r) => r.followers,
      cell: (row) => <span className="tabular-nums text-sm">{formatNumber(row.followers)}</span>,
      className: "text-right",
    },
    deleteColumn(onDelete),
  ];
  return <DataTable<Team> data={rows} columns={columns} rowKey={(r) => r.id} onRowClick={onEdit} />;
}

function PlayersTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: Player[];
  onEdit: (r: Player) => void;
  onDelete: (r: Player) => void;
}) {
  const columns: DataColumn<Player>[] = [
    {
      key: "handle",
      header: "Player",
      sortable: true,
      accessor: (r) => r.handle,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 overflow-hidden rounded-full bg-neutral-800">
            {}
            <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="text-sm font-medium text-neutral-100">{row.handle}</div>
            <div className="text-xs text-neutral-500">{row.realName}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      accessor: (r) => r.role,
      cell: (row) => <StatusBadge tone="neutral">{row.role}</StatusBadge>,
    },
    {
      key: "team",
      header: "Team",
      cell: (row) => (
        <span className="text-sm text-neutral-300">
          {teamsSource.find((t) => t.id === row.teamId)?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "game",
      header: "Game",
      cell: (row) => (
        <span className="text-sm text-neutral-300">
          {gamesSource.find((g) => g.id === row.gameId)?.shortName ?? "—"}
        </span>
      ),
    },
    {
      key: "country",
      header: "Country",
      cell: (row) => <StatusBadge tone="neutral">{row.country}</StatusBadge>,
    },
    {
      key: "followers",
      header: "Followers",
      sortable: true,
      accessor: (r) => r.followers,
      cell: (row) => <span className="tabular-nums text-sm">{formatNumber(row.followers)}</span>,
      className: "text-right",
    },
    deleteColumn(onDelete),
  ];
  return <DataTable<Player> data={rows} columns={columns} rowKey={(r) => r.id} onRowClick={onEdit} />;
}

function EventsTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: EsportsEvent[];
  onEdit: (r: EsportsEvent) => void;
  onDelete: (r: EsportsEvent) => void;
}) {
  const columns: DataColumn<EsportsEvent>[] = [
    {
      key: "title",
      header: "Event",
      sortable: true,
      accessor: (r) => r.title,
      cell: (row) => (
        <div>
          <div className="text-sm font-medium text-neutral-100">{row.title}</div>
          <div className="text-xs text-neutral-500">{row.format}</div>
        </div>
      ),
    },
    {
      key: "game",
      header: "Game",
      cell: (row) => (
        <span className="text-sm text-neutral-300">
          {gamesSource.find((g) => g.id === row.gameId)?.shortName ?? "—"}
        </span>
      ),
    },
    {
      key: "tier",
      header: "Tier",
      sortable: true,
      accessor: (r) => r.tier,
      cell: (row) => {
        const tone = row.tier === "s" ? "amber" : row.tier === "a" ? "emerald" : row.tier === "b" ? "blue" : "neutral";
        return <StatusBadge tone={tone}>Tier {row.tier.toUpperCase()}</StatusBadge>;
      },
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (r) => r.status,
      cell: (row) => {
        const tone: "emerald" | "amber" | "red" | "neutral" =
          row.status === "live" ? "red" : row.status === "scheduled" ? "amber" : row.status === "completed" ? "emerald" : "neutral";
        return <StatusBadge tone={tone} dot={row.status === "live"}>{row.status}</StatusBadge>;
      },
    },
    {
      key: "starts",
      header: "Starts",
      sortable: true,
      accessor: (r) => new Date(r.startsAt).getTime(),
      cell: (row) => <span className="text-xs text-neutral-400">{formatDate(row.startsAt)}</span>,
    },
    {
      key: "prize",
      header: "Prize",
      sortable: true,
      accessor: (r) => r.prizePoolNgn,
      cell: (row) => <span className="tabular-nums text-sm">{formatNgn(row.prizePoolNgn)}</span>,
      className: "text-right",
    },
    deleteColumn(onDelete),
  ];
  return <DataTable<EsportsEvent> data={rows} columns={columns} rowKey={(r) => r.id} onRowClick={onEdit} />;
}

function deleteColumn<T extends { id: string }>(onDelete: (r: T) => void): DataColumn<T> {
  return {
    key: "actions",
    header: "",
    cell: (row) => (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(row);
        }}
        className="rounded-md p-1.5 text-neutral-400 hover:bg-red-500/10 hover:text-red-400"
        aria-label="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    ),
    className: "w-12 text-right",
  };
}

/* ------- Forms ------- */

function ImagePreview({ label, url, onChange }: { label: string; url: string; onChange: (v: string) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-neutral-800 bg-neutral-900">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-neutral-600">No image</div>
          )}
        </div>
        <div className="flex-1 space-y-1.5">
          <Input
            value={url}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/placeholder.svg?..."
            className="border-neutral-800 bg-neutral-900"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                const reader = new FileReader();
                reader.onload = (ev) => onChange(String(ev.target?.result ?? ""));
                reader.readAsDataURL(f);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

function FormShell({
  title,
  open,
  onOpenChange,
  onSubmit,
  disabled,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-neutral-800 bg-neutral-950 text-neutral-100 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>All fields support mock data.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">{children}</div>
        <SheetFooter>
          <Button
            variant="outline"
            className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button className="bg-sky-600 text-white hover:bg-sky-500" disabled={disabled} onClick={onSubmit}>
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function GameForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: Game | null;
  onCancel: () => void;
  onSave: (g: Game) => void;
}) {
  const [form, setForm] = React.useState<Game>(
    initial ?? {
      id: `game_new_${Date.now()}`,
      slug: "",
      name: "",
      shortName: "",
      coverUrl: "/placeholder.svg?height=400&width=800&text=Cover",
      iconUrl: "/placeholder.svg?height=80&width=80&text=New",
      category: "fps",
      platform: "mobile",
      activePlayers: 0,
      enabled: true,
      featured: false,
      displayOrder: 0,
    },
  );
  const disabled = !form.name.trim() || !form.slug.trim();
  return (
    <FormShell
      title={initial ? "Edit game" : "New game"}
      open
      onOpenChange={(o) => !o && onCancel()}
      onSubmit={() => onSave(form)}
      disabled={disabled}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Slug</Label>
          <Input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="border-neutral-800 bg-neutral-900"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border-neutral-800 bg-neutral-900"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Short name</Label>
        <Input
          value={form.shortName}
          onChange={(e) => setForm({ ...form, shortName: e.target.value })}
          className="border-neutral-800 bg-neutral-900"
        />
      </div>
      <ImagePreview label="Cover image" url={form.coverUrl} onChange={(v) => setForm({ ...form, coverUrl: v })} />
      <ImagePreview label="Icon" url={form.iconUrl} onChange={(v) => setForm({ ...form, iconUrl: v })} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Game["category"] })}>
            <SelectTrigger className="w-full border-neutral-800 bg-neutral-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["br", "fps", "moba", "sports", "fighting"] as const).map((c) => (
                <SelectItem key={c} value={c}>
                  {c.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Platform</Label>
          <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v as Game["platform"] })}>
            <SelectTrigger className="w-full border-neutral-800 bg-neutral-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["mobile", "pc", "console"] as const).map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Active players</Label>
        <Input
          type="number"
          value={form.activePlayers}
          onChange={(e) => setForm({ ...form, activePlayers: Number(e.target.value) || 0 })}
          className="border-neutral-800 bg-neutral-900"
        />
      </div>
    </FormShell>
  );
}

function TeamForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: Team | null;
  onCancel: () => void;
  onSave: (t: Team) => void;
}) {
  const [form, setForm] = React.useState<Team>(
    initial ?? {
      id: `team_new_${Date.now()}`,
      slug: "",
      name: "",
      tag: "",
      logoUrl: "/placeholder.svg?height=120&width=120&text=NEW",
      country: "NG",
      region: "West Africa",
      gameId: gamesSource[0]?.id ?? "",
      ranking: 99,
      followers: 0,
      wins: 0,
      losses: 0,
    },
  );
  const disabled = !form.name.trim() || !form.tag.trim() || !form.slug.trim();
  return (
    <FormShell
      title={initial ? "Edit team" : "New team"}
      open
      onOpenChange={(o) => !o && onCancel()}
      onSubmit={() => onSave(form)}
      disabled={disabled}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Slug</Label>
          <Input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="border-neutral-800 bg-neutral-900"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tag</Label>
          <Input
            value={form.tag}
            onChange={(e) => setForm({ ...form, tag: e.target.value })}
            className="border-neutral-800 bg-neutral-900"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="border-neutral-800 bg-neutral-900"
        />
      </div>
      <ImagePreview label="Logo" url={form.logoUrl} onChange={(v) => setForm({ ...form, logoUrl: v })} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
            <SelectTrigger className="w-full border-neutral-800 bg-neutral-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["NG", "GH", "KE", "ZA", "EG", "MA", "SN", "CI"].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Region</Label>
          <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
            <SelectTrigger className="w-full border-neutral-800 bg-neutral-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["West Africa", "East Africa", "North Africa", "Southern Africa", "Africa"].map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Game</Label>
          <Select value={form.gameId} onValueChange={(v) => setForm({ ...form, gameId: v })}>
            <SelectTrigger className="w-full border-neutral-800 bg-neutral-900">
              <SelectValue />
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
          <Label>Ranking</Label>
          <Input
            type="number"
            value={form.ranking}
            onChange={(e) => setForm({ ...form, ranking: Number(e.target.value) || 0 })}
            className="border-neutral-800 bg-neutral-900"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Followers</Label>
        <Input
          type="number"
          value={form.followers}
          onChange={(e) => setForm({ ...form, followers: Number(e.target.value) || 0 })}
          className="border-neutral-800 bg-neutral-900"
        />
      </div>
    </FormShell>
  );
}

function PlayerForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: Player | null;
  onCancel: () => void;
  onSave: (p: Player) => void;
}) {
  const [form, setForm] = React.useState<Player>(
    initial ?? {
      id: `player_new_${Date.now()}`,
      handle: "",
      realName: "",
      avatarUrl: "/placeholder.svg?height=96&width=96&text=NEW",
      teamId: teamsSource[0]?.id ?? null,
      gameId: gamesSource[0]?.id ?? "",
      role: "IGL",
      country: "NG",
      kda: 1.5,
      followers: 0,
    },
  );
  const disabled = !form.handle.trim();
  return (
    <FormShell
      title={initial ? "Edit player" : "New player"}
      open
      onOpenChange={(o) => !o && onCancel()}
      onSubmit={() => onSave(form)}
      disabled={disabled}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Handle</Label>
          <Input
            value={form.handle}
            onChange={(e) => setForm({ ...form, handle: e.target.value })}
            className="border-neutral-800 bg-neutral-900"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Real name</Label>
          <Input
            value={form.realName}
            onChange={(e) => setForm({ ...form, realName: e.target.value })}
            className="border-neutral-800 bg-neutral-900"
          />
        </div>
      </div>
      <ImagePreview label="Avatar" url={form.avatarUrl} onChange={(v) => setForm({ ...form, avatarUrl: v })} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Team</Label>
          <Select
            value={form.teamId ?? "none"}
            onValueChange={(v) => setForm({ ...form, teamId: v === "none" ? null : v })}
          >
            <SelectTrigger className="w-full border-neutral-800 bg-neutral-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Free agent</SelectItem>
              {teamsSource.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Game</Label>
          <Select value={form.gameId} onValueChange={(v) => setForm({ ...form, gameId: v })}>
            <SelectTrigger className="w-full border-neutral-800 bg-neutral-900">
              <SelectValue />
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
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
            <SelectTrigger className="w-full border-neutral-800 bg-neutral-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["IGL", "Rusher", "Sniper", "Support", "Fragger", "Flex", "Entry"].map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
            <SelectTrigger className="w-full border-neutral-800 bg-neutral-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["NG", "GH", "KE", "ZA", "EG", "MA", "SN", "CI"].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </FormShell>
  );
}

function EventForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: EsportsEvent | null;
  onCancel: () => void;
  onSave: (e: EsportsEvent) => void;
}) {
  const [form, setForm] = React.useState<EsportsEvent>(
    initial ?? {
      id: `event_new_${Date.now()}`,
      slug: "",
      title: "",
      gameId: gamesSource[0]?.id ?? "",
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 86_400_000).toISOString(),
      status: "scheduled",
      tier: "b",
      bannerUrl: "/placeholder.svg?height=600&width=1600&text=Banner",
      thumbnailUrl: "/placeholder.svg?height=400&width=600&text=Thumb",
      description: "",
      prizePoolNgn: 0,
      teamIds: [],
      region: "Africa",
      format: "",
    },
  );
  const disabled = !form.title.trim() || !form.slug.trim();

  function toggleTeam(id: string) {
    setForm((f) =>
      f.teamIds.includes(id) ? { ...f, teamIds: f.teamIds.filter((t) => t !== id) } : { ...f, teamIds: [...f.teamIds, id] },
    );
  }

  return (
    <FormShell
      title={initial ? "Edit event" : "New event"}
      open
      onOpenChange={(o) => !o && onCancel()}
      onSubmit={() => onSave(form)}
      disabled={disabled}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Slug</Label>
          <Input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="border-neutral-800 bg-neutral-900"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Region</Label>
          <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
            <SelectTrigger className="w-full border-neutral-800 bg-neutral-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["West Africa", "East Africa", "North Africa", "Southern Africa", "Africa"].map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="border-neutral-800 bg-neutral-900"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Game</Label>
          <Select value={form.gameId} onValueChange={(v) => setForm({ ...form, gameId: v })}>
            <SelectTrigger className="w-full border-neutral-800 bg-neutral-900">
              <SelectValue />
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
          <Label>Tier</Label>
          <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v as EventTier })}>
            <SelectTrigger className="w-full border-neutral-800 bg-neutral-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["s", "a", "b", "c"] as EventTier[]).map((t) => (
                <SelectItem key={t} value={t}>
                  Tier {t.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Starts at</Label>
          <Input
            type="datetime-local"
            value={toLocalInput(form.startsAt)}
            onChange={(e) => setForm({ ...form, startsAt: new Date(e.target.value).toISOString() })}
            className="border-neutral-800 bg-neutral-900"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Ends at</Label>
          <Input
            type="datetime-local"
            value={toLocalInput(form.endsAt)}
            onChange={(e) => setForm({ ...form, endsAt: new Date(e.target.value).toISOString() })}
            className="border-neutral-800 bg-neutral-900"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as EventStatus })}>
            <SelectTrigger className="w-full border-neutral-800 bg-neutral-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["scheduled", "live", "completed", "cancelled"] as EventStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Prize pool (NGN)</Label>
          <Input
            type="number"
            value={form.prizePoolNgn}
            onChange={(e) => setForm({ ...form, prizePoolNgn: Number(e.target.value) || 0 })}
            className="border-neutral-800 bg-neutral-900"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Format</Label>
        <Input
          value={form.format}
          onChange={(e) => setForm({ ...form, format: e.target.value })}
          placeholder="Single elimination, Bo3"
          className="border-neutral-800 bg-neutral-900"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="min-h-[80px] border-neutral-800 bg-neutral-900"
        />
      </div>
      <ImagePreview label="Banner" url={form.bannerUrl} onChange={(v) => setForm({ ...form, bannerUrl: v })} />
      <div className="space-y-1.5">
        <Label>Participating teams</Label>
        <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-900/40 p-2">
          {teamsSource.map((t) => {
            const selected = form.teamIds.includes(t.id);
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => toggleTeam(t.id)}
                className={`rounded-md border px-2 py-1 text-xs transition ${
                  selected
                    ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
                    : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>
    </FormShell>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
