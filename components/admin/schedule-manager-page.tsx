"use client";

import * as React from "react";
import { AlertTriangle, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminCreateSlot,
  adminDeleteSlot,
  adminListShows,
  adminListSlots,
  adminUpdateSlot,
  type AdminEpgSlot,
  type AdminShow,
} from "@/lib/client";
import {
  DAY_NAMES,
  DAY_SHORT_NAMES,
  MAX_DURATION_MIN,
  MIN_DURATION_MIN,
  overlappingSlots,
  parseHhMm,
  type SlotSpan,
} from "@/lib/epg/admin";
import { MINUTES_PER_DAY, minuteLabel } from "@/lib/epg/grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "./page-header";

/**
 * The channel's running order.
 *
 * `epg_slots` drives the landing page, `/api/schedule` and the app's guide, and
 * until now the only way to change a row was to edit a CSV and re-run
 * `scripts/import-epg.ts` on the droplet. A one-word title fix needed a shell.
 *
 * The grid repeats every week and has no dates, so this is seven lists rather
 * than a calendar. A day is picked, its slots are listed in running order, and
 * the gaps between them are shown: an hour with no slot is an hour where the
 * channel has nothing to say it is playing.
 *
 * Every write is live on the site immediately. `app/page.tsx` is
 * `force-dynamic`, so there is nothing to purge.
 */

interface SlotDraft {
  id: string | null;
  dayOfWeek: number;
  start: string;
  durationMin: string;
  /** The show being scheduled. Its title and pillar come with it. */
  showId: string;
  parentalRating: string;
}

function draftFrom(slot: AdminEpgSlot | null, dayOfWeek: number): SlotDraft {
  return {
    id: slot?.id ?? null,
    dayOfWeek: slot?.dayOfWeek ?? dayOfWeek,
    start: minuteLabel(slot?.startMinute ?? 18 * 60),
    durationMin: String(slot?.durationMin ?? 60),
    showId: slot?.showId ?? "",
    parentalRating:
      slot?.parentalRating === null || slot?.parentalRating === undefined
        ? "none"
        : String(slot.parentalRating),
  };
}

/** Minutes of the day with nothing scheduled, as human ranges. */
function gapsFor(slots: AdminEpgSlot[]): Array<{ from: number; to: number }> {
  const covered = new Array<boolean>(MINUTES_PER_DAY).fill(false);
  for (const slot of slots) {
    for (let i = 0; i < slot.durationMin; i++) {
      const minute = slot.startMinute + i;
      // A slot running past midnight covers the start of the NEXT day, not the
      // rest of this one. It is left out here rather than wrapped: the day
      // being edited is the day being shown.
      if (minute < MINUTES_PER_DAY) covered[minute] = true;
    }
  }
  const gaps: Array<{ from: number; to: number }> = [];
  let start: number | null = null;
  for (let m = 0; m <= MINUTES_PER_DAY; m++) {
    const isCovered = m < MINUTES_PER_DAY ? covered[m] : true;
    if (!isCovered && start === null) start = m;
    if (isCovered && start !== null) {
      gaps.push({ from: start, to: m });
      start = null;
    }
  }
  return gaps;
}

export function ScheduleManagerPage() {
  const queryClient = useQueryClient();
  const [day, setDay] = React.useState(1);
  const [draft, setDraft] = React.useState<SlotDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<AdminEpgSlot | null>(null);

  const slotsQ = useQuery({
    queryKey: ["admin", "epg"],
    queryFn: () => adminListSlots(),
  });
  // Programming picks from the catalogue, so the catalogue has to be here.
  const showsQ = useQuery({
    queryKey: ["admin", "shows", "for-schedule"],
    queryFn: () => adminListShows({ limit: 200 }),
  });
  const allSlots = React.useMemo(() => slotsQ.data ?? [], [slotsQ.data]);
  const shows: AdminShow[] = React.useMemo(
    () => (showsQ.data?.shows ?? []).slice().sort((a, b) => a.title.localeCompare(b.title)),
    [showsQ.data],
  );
  const showById = React.useMemo(
    () => new Map(shows.map((s) => [s.id, s])),
    [shows],
  );

  const daySlots = React.useMemo(
    () =>
      allSlots
        .filter((s) => s.dayOfWeek === day && s.isActive)
        .sort((a, b) => a.startMinute - b.startMinute),
    [allSlots, day],
  );

  const gaps = React.useMemo(() => gapsFor(daySlots), [daySlots]);

  const refresh = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["admin", "epg"] }),
    [queryClient],
  );

  /**
   * Overlap warnings for the slot being edited, computed here as it is typed.
   *
   * Same function the route runs after the write. Doing it in both places is
   * not duplication: the server's answer arrives too late to stop somebody
   * saving a programme on top of another one.
   */
  const draftWarnings = React.useMemo(() => {
    if (!draft) return [];
    const startMinute = parseHhMm(draft.start);
    const durationMin = Number(draft.durationMin);
    if (startMinute === null || !Number.isFinite(durationMin) || durationMin <= 0) {
      return [];
    }
    const candidate: SlotSpan = {
      id: draft.id ?? "__new__",
      dayOfWeek: draft.dayOfWeek,
      startMinute,
      durationMin,
      title: showById.get(draft.showId)?.title ?? "This slot",
    };
    const existing: SlotSpan[] = allSlots
      .filter((s) => s.isActive)
      .map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startMinute: s.startMinute,
        durationMin: s.durationMin,
        title: s.title,
      }));
    return overlappingSlots(candidate, existing).map(
      (s) =>
        `Overlaps ${DAY_NAMES[s.dayOfWeek - 1]} ${minuteLabel(s.startMinute)} ${s.title}`,
    );
  }, [draft, allSlots, showById]);

  const save = useMutation({
    mutationFn: async (input: SlotDraft) => {
      const startMinute = parseHhMm(input.start);
      if (startMinute === null) throw new Error("Start time must be HH:MM");
      const durationMin = Number(input.durationMin);
      if (
        !Number.isFinite(durationMin) ||
        durationMin < MIN_DURATION_MIN ||
        durationMin > MAX_DURATION_MIN
      ) {
        throw new Error(
          `Duration must be between ${MIN_DURATION_MIN} and ${MAX_DURATION_MIN} minutes`,
        );
      }
      if (!input.showId) {
        throw new Error("Pick the show being scheduled");
      }
      const payload = {
        dayOfWeek: input.dayOfWeek,
        startMinute,
        durationMin,
        showId: input.showId,
        parentalRating:
          input.parentalRating === "none" ? null : Number(input.parentalRating),
      };
      return input.id ? adminUpdateSlot(input.id, payload) : adminCreateSlot(payload);
    },
    onSuccess: async (result, input) => {
      toast.success(input.id ? "Slot updated" : "Slot added");
      for (const warning of result.warnings) toast.warning(warning);
      setDraft(null);
      await refresh();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not save the slot"),
  });

  const remove = useMutation({
    mutationFn: (slot: AdminEpgSlot) => adminDeleteSlot(slot.id),
    onSuccess: async () => {
      toast.success("Slot removed. That hour now has nothing on air.");
      setConfirmDelete(null);
      await refresh();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not remove the slot"),
  });

  /**
   * Copy a whole day onto another one, slot by slot.
   *
   * A weekday rotation is usually the same five days running, and typing it out
   * five times is how a grid ends up inconsistent. Sequential rather than
   * parallel: the unique index is on (day, start minute) and a burst of
   * concurrent inserts would race each other onto the same 409.
   */
  const copyDay = useMutation({
    mutationFn: async (targetDay: number) => {
      let copied = 0;
      const skipped: string[] = [];
      for (const slot of daySlots) {
        // A row imported before the show link existed has nothing to copy: it
        // names a programme the catalogue does not know. Named in the report
        // rather than dropped quietly.
        if (!slot.showId) {
          skipped.push(`${minuteLabel(slot.startMinute)} ${slot.title}: not linked to a show`);
          continue;
        }
        try {
          await adminCreateSlot({
            dayOfWeek: targetDay,
            startMinute: slot.startMinute,
            durationMin: slot.durationMin,
            showId: slot.showId,
            parentalRating: slot.parentalRating,
          });
          copied++;
        } catch (err) {
          skipped.push(
            `${minuteLabel(slot.startMinute)} ${err instanceof Error ? err.message : ""}`,
          );
        }
      }
      return { copied, skipped, targetDay };
    },
    onSuccess: async ({ copied, skipped, targetDay }) => {
      toast.success(
        `Copied ${copied} slot${copied === 1 ? "" : "s"} to ${DAY_NAMES[targetDay - 1]}`,
      );
      // Named rather than counted: "3 skipped" tells an operator nothing about
      // which hours are still wrong.
      for (const reason of skipped) toast.warning(`Skipped ${reason}`);
      await refresh();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not copy the day"),
  });

  return (
    <div>
      <PageHeader
        title="Schedule"
        description="The repeating weekly grid. It drives the landing page, the guide on the site and the app, and it goes live the moment you save."
        actions={
          <Button type="button" onClick={() => setDraft(draftFrom(null, day))}>
            <Plus className="h-4 w-4" />
            Add slot
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {DAY_SHORT_NAMES.map((name, index) => {
            const value = index + 1;
            const count = allSlots.filter(
              (s) => s.dayOfWeek === value && s.isActive,
            ).length;
            return (
              <Button
                key={name}
                type="button"
                size="sm"
                variant={day === value ? "default" : "outline"}
                onClick={() => setDay(value)}
              >
                {name}
                <span className="ml-1 text-xs opacity-70">{count}</span>
              </Button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Select
            value=""
            onValueChange={(v) => copyDay.mutate(Number(v))}
            disabled={daySlots.length === 0 || copyDay.isPending}
          >
            <SelectTrigger className="w-44">
              {copyDay.isPending ? (
                <span className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Copying
                </span>
              ) : (
                <span className="flex items-center gap-2 text-sm">
                  <Copy className="h-3.5 w-3.5" />
                  Copy day to
                </span>
              )}
            </SelectTrigger>
            <SelectContent>
              {DAY_NAMES.map((name, index) =>
                index + 1 === day ? null : (
                  <SelectItem key={name} value={String(index + 1)}>
                    {name}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/30">
        {slotsQ.isLoading ? (
          <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading the grid
          </p>
        ) : daySlots.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nothing programmed on {DAY_NAMES[day - 1]}. The channel shows nothing on
            air for the whole day.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {daySlots.map((slot) => (
              <li key={slot.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-28 shrink-0 tabular-nums text-sm text-foreground">
                  {minuteLabel(slot.startMinute)}
                  <span className="text-muted-foreground">
                    {" "}
                    to {minuteLabel(slot.startMinute + slot.durationMin)}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{slot.title}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {slot.pillar}
                    {slot.parentalRating ? ` · ${slot.parentalRating}+` : ""}
                    {` · ${slot.durationMin} min`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setDraft(draftFrom(slot, day))}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${slot.title}`}
                    onClick={() => setConfirmDelete(slot)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {gaps.length > 0 && daySlots.length > 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-card/30 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <AlertTriangle className="h-4 w-4" />
            Unprogrammed hours on {DAY_NAMES[day - 1]}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {gaps.map((gap) => (
              <Badge
                key={`${gap.from}-${gap.to}`}
                variant="outline"
                className="cursor-pointer tabular-nums"
                onClick={() =>
                  setDraft({
                    ...draftFrom(null, day),
                    start: minuteLabel(gap.from),
                    durationMin: String(gap.to - gap.from),
                  })
                }
              >
                {minuteLabel(gap.from)} to {minuteLabel(gap.to % MINUTES_PER_DAY)}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Nothing is on air in these hours. Tap one to programme it.
          </p>
        </div>
      ) : null}

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit slot" : "New slot"}</DialogTitle>
            <DialogDescription>
              Times are Lagos wall clock, the same clock the channel runs on.
            </DialogDescription>
          </DialogHeader>

          {draft ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="slot-show">Show</Label>
                <Select
                  value={draft.showId}
                  onValueChange={(v) => setDraft({ ...draft, showId: v })}
                >
                  <SelectTrigger id="slot-show">
                    <SelectValue placeholder="Pick a show" />
                  </SelectTrigger>
                  <SelectContent>
                    {shows.map((show) => (
                      <SelectItem key={show.id} value={show.id}>
                        {show.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* The pillar is the show's, not the slot's. Setting it here as
                    well was a second answer to the same question. */}
                <p className="text-xs text-muted-foreground">
                  {shows.length === 0
                    ? "No shows yet. Create one under Shows and it appears here."
                    : draft.showId
                      ? `Filed under ${showById.get(draft.showId)?.pillar ?? ""}, from the show.`
                      : "Programming is picked from the shows catalogue."}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="slot-day">Day</Label>
                  <Select
                    value={String(draft.dayOfWeek)}
                    onValueChange={(v) => setDraft({ ...draft, dayOfWeek: Number(v) })}
                  >
                    <SelectTrigger id="slot-day">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_NAMES.map((name, index) => (
                        <SelectItem key={name} value={String(index + 1)}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slot-start">Start</Label>
                  <Input
                    id="slot-start"
                    type="time"
                    value={draft.start}
                    onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slot-duration">Duration, minutes</Label>
                  <Input
                    id="slot-duration"
                    inputMode="numeric"
                    value={draft.durationMin}
                    onChange={(e) => setDraft({ ...draft, durationMin: e.target.value })}
                  />
                </div>

              </div>

              <div className="space-y-2">
                <Label htmlFor="slot-rating">Parental rating</Label>
                <Select
                  value={draft.parentalRating}
                  onValueChange={(v) => setDraft({ ...draft, parentalRating: v })}
                >
                  <SelectTrigger id="slot-rating">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unrated</SelectItem>
                    <SelectItem value="16">16+</SelectItem>
                    <SelectItem value="18">18+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {draftWarnings.length > 0 ? (
                <div className="rounded-lg border border-border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    This time is already busy
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {draftWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Back-to-back programming is fine. Saving on the exact same start
                    minute is refused.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!draft?.showId || save.isPending}
              onClick={() => draft && save.mutate(draft)}
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {draft?.id ? "Save slot" : "Add slot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this slot?</DialogTitle>
            <DialogDescription>
              {confirmDelete
                ? `"${confirmDelete.title}" leaves the rotation. ${DAY_NAMES[confirmDelete.dayOfWeek - 1]} ${minuteLabel(confirmDelete.startMinute)} then has nothing on air until the next slot starts.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => confirmDelete && remove.mutate(confirmDelete)}
            >
              Remove slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
