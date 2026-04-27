"use client";

import * as React from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  Bell,
  Calendar as CalendarIcon,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  MapPin,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

import { useMockAuth } from "@/components/providers/mock-auth-provider";
import {
  buildIcsFile,
  CALENDAR_REGIONS,
  downloadIcs,
  isReminderSet,
  listMatchCalendarEntries,
  toggleReminder,
  type CalendarMatch,
  type CalendarTier,
} from "@/lib/mock/calendar";
import { listGames } from "@/lib/mock/games";
import { userPrefs } from "@/lib/mock/users";
import type { Game } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const TIERS: CalendarTier[] = ["s", "a", "b", "c"];
const TIER_TONES: Record<CalendarTier, string> = {
  s: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  a: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  b: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  c: "border-neutral-700 bg-neutral-800 text-neutral-300",
};

function ymKey(d: Date) {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

export function MatchCalendarPage() {
  const { user } = useMockAuth();
  const tz = React.useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  const [cursor, setCursor] = React.useState<Date>(() => new Date());
  const [matches, setMatches] = React.useState<CalendarMatch[] | null>(null);
  const [games, setGames] = React.useState<Game[]>([]);
  const [gameFilter, setGameFilter] = React.useState<string | null>(null);
  const [tierFilter, setTierFilter] = React.useState<CalendarTier | null>(null);
  const [regionFilter, setRegionFilter] = React.useState<string | null>(null);
  const [favOnly, setFavOnly] = React.useState(false);
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);
  const [reminders, setReminders] = React.useState<Set<string>>(new Set());

  const favoriteTeams = React.useMemo(
    () => (user ? userPrefs[user.id]?.favoriteTeams ?? [] : []),
    [user],
  );

  React.useEffect(() => {
    listGames().then(setGames);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setMatches(null);
    listMatchCalendarEntries({
      monthIso: ymKey(cursor),
      gameId: gameFilter ?? undefined,
      tier: tierFilter ?? undefined,
      region: regionFilter ?? undefined,
      favoriteTeams: favOnly ? favoriteTeams : undefined,
    }).then((list) => {
      if (!cancelled) setMatches(list);
    });
    return () => {
      cancelled = true;
    };
  }, [cursor, gameFilter, tierFilter, regionFilter, favOnly, favoriteTeams]);

  React.useEffect(() => {
    // Hydrate reminders from storage
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("evotv_calendar_reminders_v1");
        if (raw) setReminders(new Set(JSON.parse(raw) as string[]));
      } catch {
        /* noop */
      }
    }
  }, []);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    days.push(d);
  }

  const matchesByDay: Record<string, CalendarMatch[]> = {};
  (matches ?? []).forEach((m) => {
    const key = format(parseISO(m.scheduledAt), "yyyy-MM-dd");
    matchesByDay[key] = matchesByDay[key] ?? [];
    matchesByDay[key]!.push(m);
  });

  const dayMatches = selectedDay
    ? matchesByDay[format(selectedDay, "yyyy-MM-dd")] ?? []
    : [];

  function handleAddToCalendar(matchesForExport: CalendarMatch[]) {
    if (matchesForExport.length === 0) return;
    const ics = buildIcsFile(matchesForExport);
    const filename =
      matchesForExport.length === 1
        ? `evo-${matchesForExport[0]!.id}.ics`
        : `evo-calendar-${format(cursor, "yyyy-MM")}.ics`;
    downloadIcs(filename, ics);
    toast.success(
      `Downloaded ${matchesForExport.length} event${matchesForExport.length === 1 ? "" : "s"} as .ics`,
    );
  }

  function handleReminder(match: CalendarMatch) {
    const next = toggleReminder(match.id);
    setReminders((prev) => {
      const s = new Set(prev);
      if (next) s.add(match.id);
      else s.delete(match.id);
      return s;
    });
    if (next) {
      toast.success(
        `Reminder set: ${match.teamA.tag} vs ${match.teamB.tag}`,
      );
    } else {
      toast.message("Reminder cleared");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Match calendar</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Every match across African esports. Times shown in your local zone (
            <span className="font-medium text-neutral-200">{tz}</span>).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-900/40">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCursor((c) => subMonths(c, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2 text-sm font-semibold tabular-nums text-neutral-100">
              {format(cursor, "MMMM yyyy")}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddToCalendar(matches ?? [])}
            disabled={!matches || matches.length === 0}
          >
            <CalendarPlus className="size-3.5" />
            Export month
          </Button>
        </div>
      </header>

      <Filters
        games={games}
        gameFilter={gameFilter}
        setGameFilter={setGameFilter}
        tierFilter={tierFilter}
        setTierFilter={setTierFilter}
        regionFilter={regionFilter}
        setRegionFilter={setRegionFilter}
        favOnly={favOnly}
        setFavOnly={setFavOnly}
        favoritesAvailable={favoriteTeams.length > 0}
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wider text-neutral-500">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="px-1.5 py-1 text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const inMonth = isSameMonth(d, cursor);
              const dayList = matchesByDay[key] ?? [];
              const isSelected = selectedDay && isSameDay(d, selectedDay);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(d)}
                  className={cn(
                    "group flex aspect-square min-h-16 flex-col items-start gap-1 rounded-lg border border-neutral-800 bg-neutral-950/60 p-1.5 text-left transition",
                    !inMonth && "opacity-40",
                    isToday(d) && "border-sky-500/60 bg-sky-500/5",
                    isSelected && "ring-2 ring-sky-500/60",
                    "hover:border-neutral-700 hover:bg-neutral-900",
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={cn(
                        "text-xs font-semibold tabular-nums",
                        isToday(d) ? "text-sky-300" : "text-neutral-200",
                      )}
                    >
                      {format(d, "d")}
                    </span>
                    {dayList.length > 0 && (
                      <span className="text-[10px] tabular-nums text-neutral-400">
                        {dayList.length}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-0.5">
                    {dayList.slice(0, 6).map((m) => (
                      <span
                        key={m.id}
                        className={cn(
                          "size-1.5 rounded-full",
                          m.tier === "s"
                            ? "bg-amber-400"
                            : m.tier === "a"
                              ? "bg-sky-400"
                              : m.tier === "b"
                                ? "bg-emerald-400"
                                : "bg-neutral-500",
                        )}
                        title={`${m.teamA.tag} vs ${m.teamB.tag}`}
                      />
                    ))}
                    {dayList.length > 6 && (
                      <span className="text-[9px] text-neutral-500">+{dayList.length - 6}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="rounded-xl border border-neutral-800 bg-neutral-900/40">
          <div className="border-b border-neutral-800 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
              <CalendarIcon className="size-4 text-sky-400" />
              {selectedDay
                ? format(selectedDay, "EEEE, d MMMM yyyy")
                : "Pick a day"}
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {selectedDay
                ? `${dayMatches.length} match${dayMatches.length === 1 ? "" : "es"} scheduled`
                : "Click any day on the calendar to see matches."}
            </p>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-3">
            {matches === null ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full bg-neutral-800/60" />
                ))}
              </div>
            ) : !selectedDay ? (
              <div className="rounded-lg border border-dashed border-neutral-800 bg-neutral-950/40 p-6 text-center text-sm text-neutral-500">
                Select a day to see fixtures.
              </div>
            ) : dayMatches.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-800 bg-neutral-950/40 p-6 text-center text-sm text-neutral-500">
                No matches scheduled.
              </div>
            ) : (
              <ul className="space-y-2">
                {dayMatches.map((match) => (
                  <li
                    key={match.id}
                    className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              TIER_TONES[match.tier],
                            )}
                          >
                            {match.tier.toUpperCase()}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                            {match.gameShortName}
                          </span>
                          {match.state === "live" && (
                            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-red-400">
                              <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
                              Live
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-xs text-neutral-400" title={match.eventTitle}>
                          {match.eventTitle}
                        </p>
                      </div>
                      <Countdown iso={match.scheduledAt} state={match.state} />
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <TeamRow team={match.teamA} />
                      <span className="text-xs font-semibold text-neutral-500">vs</span>
                      <TeamRow team={match.teamB} reverse />
                    </div>

                    <div className="mt-3 flex items-center gap-3 text-[11px] text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Intl.DateTimeFormat(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(match.scheduledAt))}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {match.region}
                      </span>
                      <span className="flex items-center gap-1">
                        <Trophy className="size-3" />
                        Bo{match.bestOf}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant={reminders.has(match.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleReminder(match)}
                      >
                        <Bell className="size-3.5" />
                        {reminders.has(match.id) ? "Reminder set" : "Remind me"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddToCalendar([match])}
                      >
                        <CalendarPlus className="size-3.5" />
                        Add .ics
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Filters({
  games,
  gameFilter,
  setGameFilter,
  tierFilter,
  setTierFilter,
  regionFilter,
  setRegionFilter,
  favOnly,
  setFavOnly,
  favoritesAvailable,
}: {
  games: Game[];
  gameFilter: string | null;
  setGameFilter: (v: string | null) => void;
  tierFilter: CalendarTier | null;
  setTierFilter: (v: CalendarTier | null) => void;
  regionFilter: string | null;
  setRegionFilter: (v: string | null) => void;
  favOnly: boolean;
  setFavOnly: (v: boolean) => void;
  favoritesAvailable: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Chip
          active={gameFilter === null}
          onClick={() => setGameFilter(null)}
          label="All games"
        />
        {games.map((g) => (
          <Chip
            key={g.id}
            active={gameFilter === g.id}
            onClick={() => setGameFilter(g.id)}
            label={g.shortName}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-500">Tier:</span>
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTierFilter(tierFilter === t ? null : t)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase transition",
              tierFilter === t
                ? TIER_TONES[t]
                : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700",
            )}
          >
            {t}
          </button>
        ))}

        <span className="ml-3 text-xs text-neutral-500">Region:</span>
        {CALENDAR_REGIONS.map((r) => (
          <Chip
            key={r}
            active={regionFilter === r}
            onClick={() => setRegionFilter(regionFilter === r ? null : r)}
            label={r}
            small
          />
        ))}

        <button
          type="button"
          onClick={() => setFavOnly(!favOnly)}
          disabled={!favoritesAvailable}
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition",
            favOnly
              ? "border-pink-500/50 bg-pink-500/10 text-pink-300"
              : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700",
            !favoritesAvailable && "cursor-not-allowed opacity-50",
          )}
          title={!favoritesAvailable ? "Sign in and favorite teams to use this filter" : undefined}
        >
          <Heart className={cn("size-3", favOnly && "fill-current")} />
          Favorites only
        </button>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  small,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition",
        small && "py-0.5 text-[11px]",
        active
          ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
          : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700",
      )}
    >
      {label}
    </button>
  );
}

function TeamRow({
  team,
  reverse,
}: {
  team: { id: string; name: string; tag: string; logoUrl: string };
  reverse?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2",
        reverse && "flex-row-reverse text-right",
      )}
    >
      <Avatar className="size-7 shrink-0">
        <AvatarImage src={team.logoUrl} alt={team.name} />
        <AvatarFallback>{team.tag.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-neutral-100">{team.tag}</div>
        <div className="truncate text-[10px] text-neutral-500">{team.name}</div>
      </div>
    </div>
  );
}

function Countdown({
  iso,
  state,
}: {
  iso: string;
  state: "scheduled" | "live" | "completed";
}) {
  const target = new Date(iso).getTime();
  const [diff, setDiff] = React.useState(() => target - Date.now());
  React.useEffect(() => {
    const i = window.setInterval(() => setDiff(target - Date.now()), 30_000);
    return () => window.clearInterval(i);
  }, [target]);

  if (state === "completed") {
    return <span className="text-[10px] text-neutral-500">Final</span>;
  }
  if (state === "live") {
    return (
      <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
        Now
      </span>
    );
  }
  if (diff <= 0) {
    return <span className="text-[10px] text-neutral-400">Starting…</span>;
  }
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const label =
    days > 0
      ? `in ${days}d ${hours}h`
      : hours > 0
        ? `in ${hours}h ${minutes}m`
        : `in ${minutes}m`;
  return <span className="text-[10px] tabular-nums text-neutral-300">{label}</span>;
}
