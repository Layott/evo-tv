"use client";

import * as React from "react";
import { Plus, Search, Trash2 } from "@/components/icons";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminCreateAd,
  adminDeleteAd,
  adminListAds,
  adminUpdateAd,
} from "@/lib/client";
import type { Ad, AdPlacement } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaUpload } from "@/components/admin/media-upload";
import { looksLikeVideo } from "@/lib/media/file-kind";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
import { HowTo } from "./how-to";
import { ChannelBreaksCard } from "./channel-breaks-card";
import { StatusBadge } from "./status-badge";
import { formatDate, formatNumber } from "./utils";

const PLACEMENTS: { value: AdPlacement; label: string }[] = [
  { value: "home_banner", label: "Home banner" },
  { value: "stream_preroll", label: "Stream preroll" },
  // The two the always-on channel uses. Mid-roll runs at the interval set in
  // Channel breaks below; filler is what covers the screen when the feed drops.
  { value: "mid_roll", label: "Channel break (mid-roll)" },
  { value: "live_filler", label: "Filler when the feed drops" },
  { value: "sidebar", label: "Sidebar" },
  { value: "between_content", label: "Between content" },
];

function placementLabel(p: AdPlacement) {
  return PLACEMENTS.find((x) => x.value === p)?.label ?? p;
}

/**
 * What a creative should be, per placement.
 *
 * The form asked for an image and said nothing about shape or size, so what
 * arrived was whatever the advertiser sent and it was cropped by the slot at
 * render time. A wrong-shaped banner is not a design problem to fix later: it
 * is the ad, on the page, cut in half.
 */
/**
 * The three placements that play inside the player take a video file.
 *
 * The break player renders the creative in a `<video>` tag, and the upload
 * field only ever offered images, so a downtime ad could be uploaded and could
 * never play: the tag failed to load it, the error handler ended the break, and
 * the screen went back to a feed that was not there. Anything uploaded for
 * these three has to be a video the browser can play.
 */
const VIDEO_PLACEMENTS: AdPlacement[] = [
  "stream_preroll",
  "mid_roll",
  "live_filler",
];

/**
 * A container the web cannot be relied on to play.
 *
 * `.mov` uploads without complaint, previews in the admin because Chrome will
 * usually decode H.264 inside QuickTime, and then does not play for a viewer on
 * Firefox. For a filler that covers a dropped feed that is the worst possible
 * time to find out, so the row says so rather than waiting for the outage.
 */
function mayNotPlay(url: string): boolean {
  return /\.mov(\?|$)/i.test(url);
}

function creativeKind(placement: AdPlacement): "image" | "video" {
  return VIDEO_PLACEMENTS.includes(placement) ? "video" : "image";
}

const PLACEMENT_SPECS: Record<
  string,
  { size: string; ratio: string; note: string }
> = {
  home_banner: {
    size: "1600 by 400",
    ratio: "4:1",
    note: "Wide strip between the rails on the home page.",
  },
  stream_preroll: {
    size: "1920 by 1080",
    ratio: "16:9",
    note: "A video, played full-frame before the programme starts.",
  },
  mid_roll: {
    size: "1920 by 1080",
    ratio: "16:9",
    note: "A video, played in the player during a channel break. It runs once and hands the channel back.",
  },
  live_filler: {
    size: "1920 by 1080",
    ratio: "16:9",
    note: "A video, looped in the player while a dropped feed reconnects. This is the downtime filler.",
  },
  sidebar: {
    size: "600 by 500",
    ratio: "6:5",
    note: "Beside the player on desktop, under it on a phone.",
  },
  between_content: {
    size: "1200 by 300",
    ratio: "4:1",
    note: "Between rows on the browse pages.",
  },
};

export function AdsManagerPage() {
  const queryClient = useQueryClient();

  const adsQ = useQuery({ queryKey: ["admin", "ads"], queryFn: () => adminListAds() });
  const all = adsQ.data ?? [];

  const refresh = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["admin", "ads"] }),
    [queryClient],
  );
  const [search, setSearch] = React.useState("");
  const [placementFilter, setPlacementFilter] = React.useState<string>("all");
  const [editing, setEditing] = React.useState<Ad | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<Ad | null>(null);

  const filtered = React.useMemo(() => {
    let rows = all;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((a) => a.advertiser.toLowerCase().includes(q));
    }
    if (placementFilter !== "all") rows = rows.filter((a) => a.placement === placementFilter);
    return rows;
  }, [all, search, placementFilter]);

  /**
   * Pausing an ad is the one control that has to be instant: it is how you pull
   * a live campaign. It writes through and refetches rather than only flipping
   * local state, which previously reverted on reload.
   */
  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminUpdateAd(id, { active }),
    onSuccess: async (_r, v) => {
      toast.success(v.active ? "Ad activated" : "Ad paused");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Could not change the ad"),
  });

  const saveMut = useMutation({
    mutationFn: (ad: Ad) => (editing ? adminUpdateAd(ad.id, ad) : adminCreateAd(ad)),
    onSuccess: async () => {
      toast.success(editing ? "Ad updated" : "Ad created");
      setEditing(null);
      setCreateOpen(false);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save the ad"),
  });

  const deleteMut = useMutation({
    mutationFn: (ad: Ad) => adminDeleteAd(ad.id),
    onSuccess: async () => {
      toast.success("Ad deleted");
      setConfirmDelete(null);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete the ad"),
  });

  function handleToggleActive(id: string, active: boolean) {
    toggleMut.mutate({ id, active });
  }

  function handleSave(ad: Ad) {
    saveMut.mutate(ad);
  }

  function handleDelete() {
    if (!confirmDelete) return;
    deleteMut.mutate(confirmDelete);
  }

  const columns: DataColumn<Ad>[] = [
    {
      key: "media",
      header: "Creative",
      cell: (row) => (
        <div className="flex items-center gap-3">
          {/*
            A video creative in an `<img>` is a broken-image icon.
            
            The three player placements take video now, and this cell still
            asked the browser to decode an MP4 as a picture, so the first ad
            uploaded for downtime looked like a failed upload. A muted video
            seeked to the first frame is the thumbnail.
          */}
          <div className="h-10 w-20 overflow-hidden rounded bg-muted">
            {looksLikeVideo(row.mediaUrl) ? (
              <video
                src={`${row.mediaUrl}#t=0.1`}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- an arbitrary
              // creative URL, which next/image would need a remotePatterns entry for.
              <img src={row.mediaUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">{row.advertiser}</div>
            <div className="text-xs text-muted-foreground">{row.clickUrl}</div>
            {mayNotPlay(row.mediaUrl) ? (
              <div className="mt-0.5 text-xs text-amber-300">
                QuickTime file. Some browsers refuse to play it, so upload an MP4
                for anything that has to run on air.
              </div>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "placement",
      header: "Placement",
      sortable: true,
      accessor: (r) => r.placement,
      cell: (row) => <StatusBadge>{placementLabel(row.placement)}</StatusBadge>,
    },
    {
      key: "weight",
      header: "Weight",
      sortable: true,
      accessor: (r) => r.weight,
      cell: (row) => <span className="tabular-nums text-sm">{row.weight}</span>,
    },
    {
      key: "impressions",
      header: "Impressions",
      sortable: true,
      accessor: (r) => r.impressions,
      cell: (row) => <span className="tabular-nums text-sm">{formatNumber(row.impressions)}</span>,
      className: "text-right",
    },
    {
      key: "clicks",
      header: "Clicks",
      sortable: true,
      accessor: (r) => r.clicks,
      cell: (row) => <span className="tabular-nums text-sm">{formatNumber(row.clicks)}</span>,
      className: "text-right",
    },
    {
      key: "ctr",
      header: "CTR",
      sortable: true,
      accessor: (r) => (r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0),
      cell: (row) => {
        const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
        return <span className="tabular-nums text-sm text-sky-300">{ctr.toFixed(1)}%</span>;
      },
      className: "text-right",
    },
    {
      key: "schedule",
      header: "Schedule",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(row.startAt)} - {formatDate(row.endAt)}
        </span>
      ),
    },
    {
      key: "active",
      header: "Active",
      cell: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Switch checked={row.active} onCheckedChange={(v) => handleToggleActive(row.id, v)} />
        </div>
      ),
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

  /**
   * Impressions and clicks are counted per ad row by /api/ads/impression and
   * /api/ads/click, but nothing aggregates them per day, so there is no real
   * 30-day series to draw. This used to invent one - a rising line from about
   * 3,200 to 8,000 impressions - which rendered above a table reading
   * "0 campaigns".
   *
   * The totals below are real: they are the sums the rows actually carry.
   */
  const totals = React.useMemo(
    () => ({
      impressions: all.reduce((acc, a) => acc + (a.impressions ?? 0), 0),
      clicks: all.reduce((acc, a) => acc + (a.clicks ?? 0), 0),
    }),
    [all],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ads"
        description="Campaign creatives, placements, performance."
        actions={
          <Button className="bg-sky-600 text-white hover:bg-sky-500" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
      <HowTo page="ads" />
            New ad
          </Button>
        }
      />

      <ChannelBreaksCard />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search advertiser"
            className="border-border bg-card pl-8"
          />
        </div>
        <Select value={placementFilter} onValueChange={setPlacementFilter}>
          <SelectTrigger className="w-44 border-border bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All placements</SelectItem>
            {PLACEMENTS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">{filtered.length} campaigns</div>
      </div>

      <DataTable<Ad>
        data={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setEditing(r)}
      />

      <section className="rounded-xl border border-border bg-card/40 p-5">
        <h3 className="text-sm font-semibold text-foreground">Performance</h3>
        <p className="text-xs text-muted-foreground">
          Lifetime totals across every campaign. A daily breakdown needs
          per-day aggregation, which does not exist yet.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">Impressions</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {formatNumber(totals.impressions)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Clicks</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {formatNumber(totals.clicks)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">CTR</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {totals.impressions > 0
                ? `${((totals.clicks / totals.impressions) * 100).toFixed(2)}%`
                : "-"}
            </div>
          </div>
        </div>
      </section>

      {(editing || createOpen) && (
        <AdForm
          initial={editing}
          open={!!editing || createOpen}
          onOpenChange={(o) => {
            if (!o) {
              setEditing(null);
              setCreateOpen(false);
            }
          }}
          onSave={handleSave}
        />
      )}

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Delete ad?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Permanently remove campaign from {confirmDelete?.advertiser}.
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

function AdForm({
  initial,
  open,
  onOpenChange,
  onSave,
}: {
  initial: Ad | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (ad: Ad) => void;
}) {
  const [form, setForm] = React.useState<Ad>(
    initial ?? {
      id: `ad_new_${Date.now()}`,
      placement: "home_banner",
      mediaUrl: "",
      clickUrl: "https://example.com",
      advertiser: "",
      active: true,
      startAt: new Date().toISOString(),
      endAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      weight: 100,
      impressions: 0,
      clicks: 0,
    },
  );
  React.useEffect(() => {
    if (open) {
      setForm(
        initial ?? {
          id: `ad_new_${Date.now()}`,
          placement: "home_banner",
          mediaUrl: "",
          clickUrl: "https://example.com",
          advertiser: "",
          active: true,
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
          weight: 100,
          impressions: 0,
          clicks: 0,
        },
      );
    }
  }, [open, initial]);

  /*
   * A creative has to match its placement.
   *
   * Switching the placement after uploading is the easy way to end up with a
   * JPEG assigned to the filler slot, which cannot play: the player would fail
   * to load it, end the break and drop the viewer back onto the feed that is
   * not there. Saying so beats discovering it the next time the feed drops.
   */
  const wantsVideo = creativeKind(form.placement) === "video";
  const creativeMismatch =
    form.mediaUrl.trim().length > 0 && looksLikeVideo(form.mediaUrl) !== wantsVideo;

  const disabled =
    !form.advertiser.trim() ||
    !form.clickUrl.trim() ||
    // An ad with no creative is a slot that renders nothing. The filler row
    // saved without a file is why the dropped-feed cover stayed black.
    !form.mediaUrl.trim() ||
    creativeMismatch;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-border bg-background text-foreground sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{initial ? "Edit ad" : "New ad"}</SheetTitle>
          <SheetDescription>
            Choose the slot, upload what plays in it, set how often it runs.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          {/*
            Placement first, creative second.
            
            The creative field was at the top, so the natural way down the form
            was to upload and then choose where it goes, by which point the
            picker had already offered the wrong kind of file: three of these
            placements play inside the player and take a video, and the field
            cannot know which until the placement is set. Choosing the slot
            first makes the upload field arrive already asking for the right
            thing, and says what that thing is.
          */}
          <div className="space-y-1.5">
            <Label>Placement</Label>
            <Select
              value={form.placement}
              onValueChange={(v) => setForm({ ...form, placement: v as AdPlacement })}
            >
              <SelectTrigger className="w-full border-border bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLACEMENTS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {PLACEMENT_SPECS[form.placement] ? (
              <p className="text-xs text-muted-foreground">
                {PLACEMENT_SPECS[form.placement]!.note} Wants{" "}
                {PLACEMENT_SPECS[form.placement]!.size} (
                {PLACEMENT_SPECS[form.placement]!.ratio}).
              </p>
            ) : null}
          </div>

          {/*
            The creative, uploaded properly.
            
            This used to FileReader the chosen file into a data URL and store
            that in `mediaUrl`, so the whole image went into the database row
            as base64: megabytes per ad, served out of Postgres on every page
            that shows the slot, and never cached at the edge. It presigns to
            Spaces now, like every other upload on the platform.
          */}
          <MediaUpload
            label={creativeKind(form.placement) === "video" ? "Creative (video)" : "Creative"}
            value={form.mediaUrl}
            onChange={(url) => setForm({ ...form, mediaUrl: url })}
            kind={creativeKind(form.placement)}
            // MP4 or WebM only: a QuickTime creative plays in the admin preview
            // and then refuses to play for a viewer on Firefox.
            videoTypes={["video/mp4", "video/webm"]}
            folder="ads"
            hint={
              PLACEMENT_SPECS[form.placement]
                ? `${PLACEMENT_SPECS[form.placement]!.size} recommended (${PLACEMENT_SPECS[form.placement]!.ratio})`
                : undefined
            }
          />

          {creativeMismatch ? (
            <p className="rounded-md bg-red-500/15 p-2.5 text-xs text-red-200">
              {wantsVideo
                ? "This placement plays inside the player, so the creative has to be a video file. Upload an MP4, MOV or WebM."
                : "This placement is a still image slot, so a video cannot be used. Upload a JPG, PNG, WebP or GIF."}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label>Advertiser</Label>
            <Input
              value={form.advertiser}
              onChange={(e) => setForm({ ...form, advertiser: e.target.value })}
              className="border-border bg-card"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Click URL</Label>
            <Input
              value={form.clickUrl}
              onChange={(e) => setForm({ ...form, clickUrl: e.target.value })}
              className="border-border bg-card"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input
                type="date"
                value={form.startAt.slice(0, 10)}
                onChange={(e) => setForm({ ...form, startAt: new Date(e.target.value).toISOString() })}
                className="border-border bg-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input
                type="date"
                value={form.endAt.slice(0, 10)}
                onChange={(e) => setForm({ ...form, endAt: new Date(e.target.value).toISOString() })}
                className="border-border bg-card"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Weight</Label>
              <span className="tabular-nums text-sm text-foreground/80">{form.weight}</span>
            </div>
            <Slider
              value={[form.weight]}
              min={0}
              max={200}
              step={5}
              onValueChange={(v) => setForm({ ...form, weight: v[0] ?? 0 })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-3">
            <div>
              <div className="text-sm font-medium text-foreground">Active</div>
              <div className="text-xs text-muted-foreground">Campaign is eligible to serve.</div>
            </div>
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
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
            onClick={() => onSave(form)}
          >
            Save ad
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
