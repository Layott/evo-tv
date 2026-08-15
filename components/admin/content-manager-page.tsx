"use client";

import * as React from "react";
import { Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminCreateEvent,
  adminCreateGame,
  adminCreatePlayer,
  adminCreateTeam,
  adminDeleteEvent,
  adminDeleteGame,
  adminDeletePlayer,
  adminDeleteTeam,
  adminListEvents,
  adminListGames,
  adminListPlayers,
  adminListTeams,
  adminUpdateEvent,
  adminUpdateGame,
  adminUpdatePlayer,
  adminUpdateTeam,
} from "@/lib/client";
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
import { UserAvatar } from "@/components/ui/user-avatar";

type ContentTab = "games" | "teams" | "players" | "events";

export function ContentManagerPage() {
  const [tab, setTab] = React.useState<ContentTab>("games");

  const queryClient = useQueryClient();

  const gamesQ = useQuery({ queryKey: ["admin", "games"], queryFn: () => adminListGames() });
  const teamsQ = useQuery({ queryKey: ["admin", "teams"], queryFn: () => adminListTeams() });
  const playersQ = useQuery({ queryKey: ["admin", "players"], queryFn: () => adminListPlayers() });
  const eventsQ = useQuery({ queryKey: ["admin", "events"], queryFn: () => adminListEvents() });

  const games = gamesQ.data ?? [];
  const teams = teamsQ.data ?? [];
  const players = playersQ.data ?? [];
  const events = eventsQ.data ?? [];

  const refresh = React.useCallback(
    (key: string) => queryClient.invalidateQueries({ queryKey: ["admin", key] }),
    [queryClient],
  );

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

  /**
   * Create and edit both persist.
   *
   * Editing used to report that the backend did not support it. The backend
   * always did: PATCH has been on all four catalogue routes since they were
   * written, and only the screen was missing.
   */
  function makeSave<T extends { id: string }>(
    label: string,
    key: string,
    create: (row: T) => Promise<unknown>,
    update: (id: string, row: T) => Promise<unknown>,
  ) {
    return async (row: T) => {
      const existingId = editing?.row?.id;
      try {
        if (existingId) {
          await update(existingId, row);
          toast.success(`${label[0]!.toUpperCase()}${label.slice(1)} saved`);
        } else {
          await create(row);
          toast.success(`${label[0]!.toUpperCase()}${label.slice(1)} created`);
        }
        setEditing(null);
        await refresh(key);
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : `Could not save the ${label}`,
        );
      }
    };
  }

  const handleSaveGame = makeSave<Game>(
    "game",
    "games",
    (r) => adminCreateGame(r),
    (id, r) => adminUpdateGame(id, r),
  );
  const handleSaveTeam = makeSave<Team>(
    "team",
    "teams",
    (r) => adminCreateTeam(r),
    (id, r) => adminUpdateTeam(id, r),
  );
  const handleSavePlayer = makeSave<Player>(
    "player",
    "players",
    (r) => adminCreatePlayer(r),
    (id, r) => adminUpdatePlayer(id, r),
  );
  const handleSaveEvent = makeSave<EsportsEvent>(
    "event",
    "events",
    (r) => adminCreateEvent(r),
    (id, r) => adminUpdateEvent(id, r),
  );

  /**
   * Deleting is real now, and the API refuses when anything still points at the
   * row: `vods.game_id` and `clips.game_id` cascade, so a game with recordings
   * under it would otherwise take them all with it. The 409 names what is in
   * the way, which is what this toast shows.
   */
  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { kind, id, label } = confirmDelete;
    const remove =
      kind === "games"
        ? adminDeleteGame
        : kind === "teams"
          ? adminDeleteTeam
          : kind === "players"
            ? adminDeletePlayer
            : adminDeleteEvent;
    try {
      await remove(id);
      toast.success(`${label} deleted`);
      setConfirmDelete(null);
      await refresh(kind);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not delete ${label}`);
    }
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
          <TabsList className="bg-card">
            <TabsTrigger value="games">Games</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${tab}…`}
              className="border-border bg-card pl-8"
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
            games={games}
            onEdit={(r) => setEditing({ kind: "team", row: r })}
            onDelete={(r) => setConfirmDelete({ kind: "teams", id: r.id, label: r.name })}
          />
        </TabsContent>
        <TabsContent value="players" className="mt-4">
          <PlayersTable
            rows={filteredPlayers}
            games={games}
            teams={teams}
            onEdit={(r) => setEditing({ kind: "player", row: r })}
            onDelete={(r) => setConfirmDelete({ kind: "players", id: r.id, label: r.handle })}
          />
        </TabsContent>
        <TabsContent value="events" className="mt-4">
          <EventsTable
            rows={filteredEvents}
            games={games}
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
          games={games}
          onCancel={() => setEditing(null)}
          onSave={handleSaveTeam}
        />
      ) : null}
      {editing?.kind === "player" ? (
        <PlayerForm
          initial={editing.row}
          games={games}
          teams={teams}
          onCancel={() => setEditing(null)}
          onSave={handleSavePlayer}
        />
      ) : null}
      {editing?.kind === "event" ? (
        <EventForm
          initial={editing.row}
          games={games}
          teams={teams}
          onCancel={() => setEditing(null)}
          onSave={handleSaveEvent}
        />
      ) : null}

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Delete {confirmDelete?.kind.slice(0, -1)}?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This will permanently delete "{confirmDelete?.label}".
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-input bg-card hover:bg-accent"
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
          <div className="h-8 w-8 overflow-hidden rounded bg-muted">
            {}
            <img src={row.iconUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">{row.name}</div>
            <div className="text-xs text-muted-foreground">/{row.slug}</div>
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
  games,
}: {
  games: Game[];
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
          <div className="h-8 w-8 overflow-hidden rounded bg-muted">
            {}
            <img src={row.logoUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">{row.name}</div>
            <div className="text-xs text-muted-foreground">[{row.tag}]</div>
          </div>
        </div>
      ),
    },
    {
      key: "game",
      header: "Game",
      sortable: true,
      accessor: (r) => games.find((g) => g.id === r.gameId)?.shortName ?? "",
      cell: (row) => (
        <span className="text-sm text-foreground/80">
          {games.find((g) => g.id === row.gameId)?.shortName ?? "-"}
        </span>
      ),
    },
    {
      key: "region",
      header: "Region",
      sortable: true,
      accessor: (r) => r.region,
      cell: (row) => <span className="text-sm text-foreground/80">{row.region}</span>,
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
  games, teams,
}: {
  games: Game[];
  teams: Team[];
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
          <UserAvatar
            src={row.avatarUrl}
            name={row.realName}
            handle={row.handle}
            seed={row.id}
            decorative
            className="h-8 w-8 shrink-0"
          />
          <div>
            <div className="text-sm font-medium text-foreground">{row.handle}</div>
            <div className="text-xs text-muted-foreground">{row.realName}</div>
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
        <span className="text-sm text-foreground/80">
          {teams.find((t) => t.id === row.teamId)?.name ?? "-"}
        </span>
      ),
    },
    {
      key: "game",
      header: "Game",
      cell: (row) => (
        <span className="text-sm text-foreground/80">
          {games.find((g) => g.id === row.gameId)?.shortName ?? "-"}
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
  games,
}: {
  games: Game[];
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
          <div className="text-sm font-medium text-foreground">{row.title}</div>
          <div className="text-xs text-muted-foreground">{row.format}</div>
        </div>
      ),
    },
    {
      key: "game",
      header: "Game",
      cell: (row) => (
        <span className="text-sm text-foreground/80">
          {games.find((g) => g.id === row.gameId)?.shortName ?? "-"}
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
      cell: (row) => <span className="text-xs text-muted-foreground">{formatDate(row.startsAt)}</span>,
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
        className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
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
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-card">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No image</div>
          )}
        </div>
        <div className="flex-1 space-y-1.5">
          <Input
            value={url}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/placeholder.svg?..."
            className="border-border bg-card"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-input bg-card text-foreground hover:bg-accent"
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
      <SheetContent className="w-full overflow-y-auto border-border bg-background text-foreground sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>All fields support mock data.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">{children}</div>
        <SheetFooter>
          <Button
            variant="outline"
            className="border-input bg-card hover:bg-accent"
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
            className="border-border bg-card"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border-border bg-card"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Short name</Label>
        <Input
          value={form.shortName}
          onChange={(e) => setForm({ ...form, shortName: e.target.value })}
          className="border-border bg-card"
        />
      </div>
      <ImagePreview label="Cover image" url={form.coverUrl} onChange={(v) => setForm({ ...form, coverUrl: v })} />
      <ImagePreview label="Icon" url={form.iconUrl} onChange={(v) => setForm({ ...form, iconUrl: v })} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Game["category"] })}>
            <SelectTrigger className="w-full border-border bg-card">
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
            <SelectTrigger className="w-full border-border bg-card">
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
          className="border-border bg-card"
        />
      </div>
    </FormShell>
  );
}

function TeamForm({
  initial,
  onCancel,
  onSave,
  games,
}: {
  games: Game[];
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
      gameId: games[0]?.id ?? "",
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
            className="border-border bg-card"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tag</Label>
          <Input
            value={form.tag}
            onChange={(e) => setForm({ ...form, tag: e.target.value })}
            className="border-border bg-card"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="border-border bg-card"
        />
      </div>
      <ImagePreview label="Logo" url={form.logoUrl} onChange={(v) => setForm({ ...form, logoUrl: v })} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
            <SelectTrigger className="w-full border-border bg-card">
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
            <SelectTrigger className="w-full border-border bg-card">
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
            <SelectTrigger className="w-full border-border bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {games.map((g) => (
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
            className="border-border bg-card"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Followers</Label>
        <Input
          type="number"
          value={form.followers}
          onChange={(e) => setForm({ ...form, followers: Number(e.target.value) || 0 })}
          className="border-border bg-card"
        />
      </div>
    </FormShell>
  );
}

function PlayerForm({
  initial,
  onCancel,
  onSave,
  games, teams,
}: {
  games: Game[];
  teams: Team[];
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
      teamId: teams[0]?.id ?? null,
      gameId: games[0]?.id ?? "",
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
            className="border-border bg-card"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Real name</Label>
          <Input
            value={form.realName}
            onChange={(e) => setForm({ ...form, realName: e.target.value })}
            className="border-border bg-card"
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
            <SelectTrigger className="w-full border-border bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Free agent</SelectItem>
              {teams.map((t) => (
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
            <SelectTrigger className="w-full border-border bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {games.map((g) => (
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
            <SelectTrigger className="w-full border-border bg-card">
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
            <SelectTrigger className="w-full border-border bg-card">
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
  games,
  teams,
}: {
  games: Game[];
  teams: Team[];
  initial: EsportsEvent | null;
  onCancel: () => void;
  onSave: (e: EsportsEvent) => void;
}) {
  const [form, setForm] = React.useState<EsportsEvent>(
    initial ?? {
      id: `event_new_${Date.now()}`,
      slug: "",
      title: "",
      gameId: games[0]?.id ?? "",
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
            className="border-border bg-card"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Region</Label>
          <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
            <SelectTrigger className="w-full border-border bg-card">
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
          className="border-border bg-card"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Game</Label>
          <Select value={form.gameId} onValueChange={(v) => setForm({ ...form, gameId: v })}>
            <SelectTrigger className="w-full border-border bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {games.map((g) => (
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
            <SelectTrigger className="w-full border-border bg-card">
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
            className="border-border bg-card"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Ends at</Label>
          <Input
            type="datetime-local"
            value={toLocalInput(form.endsAt)}
            onChange={(e) => setForm({ ...form, endsAt: new Date(e.target.value).toISOString() })}
            className="border-border bg-card"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as EventStatus })}>
            <SelectTrigger className="w-full border-border bg-card">
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
            className="border-border bg-card"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Format</Label>
        <Input
          value={form.format}
          onChange={(e) => setForm({ ...form, format: e.target.value })}
          placeholder="Single elimination, Bo3"
          className="border-border bg-card"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="min-h-[80px] border-border bg-card"
        />
      </div>
      <ImagePreview label="Banner" url={form.bannerUrl} onChange={(v) => setForm({ ...form, bannerUrl: v })} />
      <div className="space-y-1.5">
        <Label>Participating teams</Label>
        <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-md border border-border bg-card/40 p-2">
          {teams.map((t) => {
            const selected = form.teamIds.includes(t.id);
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => toggleTeam(t.id)}
                className={`rounded-md border px-2 py-1 text-xs transition ${
                  selected
                    ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
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
