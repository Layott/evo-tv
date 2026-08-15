"use client";

import * as React from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminCreateEpisode,
  adminCreateSeason,
  adminDeleteEpisode,
  adminGetShow,
  adminUpdateEpisode,
  type AdminEpisode,
  type AdminSeason,
  type AdminShow,
} from "@/lib/client";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MediaUpload } from "./media-upload";

/**
 * The inside of a show: its seasons, and the episodes hung off them.
 *
 * Split from the list screen because it is a different job. The list answers
 * "what shows exist"; this answers "what is in this one", which is where the
 * video actually gets attached and where the paywall is set episode by episode.
 */

/** `3600` -> `1:00:00`, so a runtime reads as a runtime in the table. */
function formatRuntime(sec: number): string {
  if (!sec) return "-";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

interface EpisodeDraft {
  seasonId: string;
  title: string;
  synopsis: string;
  hlsUrl: string;
  thumbnailUrl: string;
  runtimeMin: string;
  isPremium: boolean | null;
}

function emptyDraft(seasonId: string): EpisodeDraft {
  return {
    seasonId,
    title: "",
    synopsis: "",
    hlsUrl: "",
    thumbnailUrl: "",
    runtimeMin: "",
    isPremium: null,
  };
}

export function ShowEpisodesPanel({ show }: { show: AdminShow }) {
  const queryClient = useQueryClient();
  const detailQ = useQuery({
    queryKey: ["admin", "show", show.id],
    queryFn: () => adminGetShow(show.id),
  });

  const seasons: AdminSeason[] = detailQ.data?.seasons ?? [];
  const episodes: AdminEpisode[] = detailQ.data?.episodes ?? [];

  const [draft, setDraft] = React.useState<EpisodeDraft | null>(null);
  const [confirmPull, setConfirmPull] = React.useState<AdminEpisode | null>(null);

  const refresh = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "show", show.id] });
    // The list screen shows the season and episode counters, which the server
    // recomputes on every write, so it has to be refetched too.
    await queryClient.invalidateQueries({ queryKey: ["admin", "shows"] });
  }, [queryClient, show.id]);

  const addSeason = useMutation({
    mutationFn: () => adminCreateSeason(show.id, {}),
    onSuccess: async (season) => {
      toast.success(`Season ${season.seasonNumber} added`);
      await refresh();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not add the season"),
  });

  const saveEpisode = useMutation({
    mutationFn: async (input: EpisodeDraft) => {
      const runtimeSec = Math.round(Number(input.runtimeMin || 0) * 60);
      return adminCreateEpisode(show.id, {
        seasonId: input.seasonId,
        title: input.title.trim(),
        synopsis: input.synopsis.trim(),
        hlsUrl: input.hlsUrl.trim(),
        thumbnailUrl: input.thumbnailUrl.trim(),
        runtimeSec: Number.isFinite(runtimeSec) ? runtimeSec : 0,
        // Left out entirely when the operator did not touch it, so the server
        // inherits the show's tier instead of being told "free".
        ...(input.isPremium === null ? {} : { isPremium: input.isPremium }),
      });
    },
    onSuccess: async (episode) => {
      toast.success(`Episode ${episode.episodeNumber} added`);
      setDraft(null);
      await refresh();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not add the episode"),
  });

  const togglePremium = useMutation({
    mutationFn: (episode: AdminEpisode) =>
      adminUpdateEpisode(episode.id, { isPremium: !episode.isPremium }),
    onSuccess: async (episode) => {
      toast.success(episode.isPremium ? "Episode is now paid" : "Episode is now free");
      await refresh();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not change the tier"),
  });

  const pullEpisode = useMutation({
    mutationFn: (episode: AdminEpisode) => adminDeleteEpisode(episode.id),
    onSuccess: async () => {
      toast.success("Episode pulled");
      setConfirmPull(null);
      await refresh();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not pull the episode"),
  });

  if (detailQ.isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading episodes
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Seasons and episodes</h3>
          <p className="text-xs text-muted-foreground">
            {show.totalSeasons} season{show.totalSeasons === 1 ? "" : "s"},{" "}
            {show.totalEpisodes} episode{show.totalEpisodes === 1 ? "" : "s"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addSeason.mutate()}
          disabled={addSeason.isPending}
        >
          <Plus className="h-3.5 w-3.5" />
          Add season
        </Button>
      </div>

      {seasons.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No seasons yet. Add one, then episodes go inside it.
        </p>
      ) : null}

      {seasons.map((season) => {
        const inSeason = episodes.filter((e) => e.seasonId === season.id);
        return (
          <div key={season.id} className="rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Season {season.seasonNumber}
                  {season.title ? `: ${season.title}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {inSeason.length} episode{inSeason.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setDraft(emptyDraft(season.id))}
              >
                <Plus className="h-3.5 w-3.5" />
                Add episode
              </Button>
            </div>

            {inSeason.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                Nothing in this season yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {inSeason.map((episode) => (
                  <li
                    key={episode.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <span className="w-10 shrink-0 text-sm tabular-nums text-muted-foreground">
                      E{episode.episodeNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{episode.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatRuntime(episode.runtimeSec)}
                        {episode.hlsUrl ? "" : " · no video attached"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`premium-${episode.id}`}
                        className="text-xs text-muted-foreground"
                      >
                        {episode.isPremium ? "Paid" : "Free"}
                      </Label>
                      <Switch
                        id={`premium-${episode.id}`}
                        checked={episode.isPremium}
                        onCheckedChange={() => togglePremium.mutate(episode)}
                        disabled={togglePremium.isPending}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Pull ${episode.title}`}
                        onClick={() => setConfirmPull(episode)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New episode</DialogTitle>
            <DialogDescription>
              The number is taken from the end of the season unless you renumber it later.
            </DialogDescription>
          </DialogHeader>

          {draft ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="episode-title">Title</Label>
                <Input
                  id="episode-title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Episode title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="episode-synopsis">Synopsis</Label>
                <Textarea
                  id="episode-synopsis"
                  value={draft.synopsis}
                  rows={3}
                  onChange={(e) => setDraft({ ...draft, synopsis: e.target.value })}
                />
              </div>

              <MediaUpload
                label="Video"
                kind="video"
                folder="episodes"
                value={draft.hlsUrl}
                onChange={(url) => setDraft({ ...draft, hlsUrl: url })}
                hint="An HLS playlist or an MP4. The player takes either."
              />

              <MediaUpload
                label="Thumbnail"
                kind="image"
                folder="episodes"
                value={draft.thumbnailUrl}
                onChange={(url) => setDraft({ ...draft, thumbnailUrl: url })}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="episode-runtime">Runtime, minutes</Label>
                  <Input
                    id="episode-runtime"
                    inputMode="numeric"
                    value={draft.runtimeMin}
                    onChange={(e) => setDraft({ ...draft, runtimeMin: e.target.value })}
                    placeholder="24"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="episode-tier">Access</Label>
                  <Select
                    value={draft.isPremium === null ? "inherit" : draft.isPremium ? "paid" : "free"}
                    onValueChange={(v) =>
                      setDraft({
                        ...draft,
                        isPremium: v === "inherit" ? null : v === "paid",
                      })
                    }
                  >
                    <SelectTrigger id="episode-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">
                        Same as the show ({show.isPremium ? "paid" : "free"})
                      </SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!draft?.title.trim() || saveEpisode.isPending}
              onClick={() => draft && saveEpisode.mutate(draft)}
            >
              {saveEpisode.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add episode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmPull !== null}
        onOpenChange={(open) => !open && setConfirmPull(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pull this episode?</DialogTitle>
            <DialogDescription>
              {confirmPull
                ? `"${confirmPull.title}" stops being reachable and the show's counts drop by one. The row is kept, so it can be restored from the database.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmPull(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pullEpisode.isPending}
              onClick={() => confirmPull && pullEpisode.mutate(confirmPull)}
            >
              Pull episode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
