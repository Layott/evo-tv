"use client";

import * as React from "react";
import { Plus, Search, Trash2, Upload } from "lucide-react";
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
import { StatusBadge } from "./status-badge";
import { formatDate, formatNumber, seededRandom } from "./utils";

const PLACEMENTS: { value: AdPlacement; label: string }[] = [
  { value: "home_banner", label: "Home banner" },
  { value: "stream_preroll", label: "Stream preroll" },
  { value: "sidebar", label: "Sidebar" },
  { value: "between_content", label: "Between content" },
];

function placementLabel(p: AdPlacement) {
  return PLACEMENTS.find((x) => x.value === p)?.label ?? p;
}

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
          <div className="h-10 w-20 overflow-hidden rounded bg-neutral-800">
            {}
            <img src={row.mediaUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="text-sm font-medium text-neutral-100">{row.advertiser}</div>
            <div className="text-xs text-neutral-500">{row.clickUrl}</div>
          </div>
        </div>
      ),
    },
    {
      key: "placement",
      header: "Placement",
      sortable: true,
      accessor: (r) => r.placement,
      cell: (row) => <StatusBadge tone="violet">{placementLabel(row.placement)}</StatusBadge>,
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
        <span className="text-xs text-neutral-400">
          {formatDate(row.startAt)} — {formatDate(row.endAt)}
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
          className="rounded-md p-1.5 text-neutral-400 hover:bg-red-500/10 hover:text-red-400"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
      className: "w-12 text-right",
    },
  ];

  const series = React.useMemo(() => {
    const rng = seededRandom(99);
    const now = Date.now();
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now - (29 - i) * 86_400_000);
      const impressions = Math.round(3_200 + rng() * 2_800 + i * 120);
      const clicks = Math.round(90 + rng() * 120 + i * 3);
      return {
        day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        impressions,
        clicks,
      };
    });
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ads"
        description="Campaign creatives, placements, performance."
        actions={
          <Button className="bg-sky-600 text-white hover:bg-sky-500" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New ad
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search advertiser"
            className="border-neutral-800 bg-neutral-900 pl-8"
          />
        </div>
        <Select value={placementFilter} onValueChange={setPlacementFilter}>
          <SelectTrigger className="w-44 border-neutral-800 bg-neutral-900">
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
        <div className="ml-auto text-xs text-neutral-500">{filtered.length} campaigns</div>
      </div>

      <DataTable<Ad>
        data={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setEditing(r)}
      />

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
        <h3 className="text-sm font-semibold text-neutral-100">Performance (30 days)</h3>
        <p className="text-xs text-neutral-500">Aggregated impressions and clicks across all active campaigns.</p>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#262626" vertical={false} />
              <XAxis dataKey="day" stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#171717",
                  border: "1px solid #262626",
                  borderRadius: 8,
                  color: "#e5e5e5",
                }}
              />
              <Line type="monotone" dataKey="impressions" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="clicks" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
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
        <DialogContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Delete ad?</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Permanently remove campaign from {confirmDelete?.advertiser}.
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
      mediaUrl: "/placeholder.svg?height=200&width=1200&text=New+Creative",
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
          mediaUrl: "/placeholder.svg?height=200&width=1200&text=New+Creative",
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

  const disabled = !form.advertiser.trim() || !form.clickUrl.trim();
  const mediaInput = React.useRef<HTMLInputElement>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-neutral-800 bg-neutral-950 text-neutral-100 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{initial ? "Edit ad" : "New ad"}</SheetTitle>
          <SheetDescription>Upload creative, set placement and weight.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          <div className="space-y-1.5">
            <Label>Creative preview</Label>
            <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
              {}
              <img src={form.mediaUrl} alt="" className="w-full object-cover" />
            </div>
            <div className="flex gap-2">
              <Input
                value={form.mediaUrl}
                onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })}
                className="border-neutral-800 bg-neutral-900"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
                onClick={() => mediaInput.current?.click()}
              >
                <Upload className="h-4 w-4" />
              </Button>
              <input
                ref={mediaInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const reader = new FileReader();
                    reader.onload = (ev) => setForm((prev) => ({ ...prev, mediaUrl: String(ev.target?.result ?? "") }));
                    reader.readAsDataURL(f);
                  }
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Advertiser</Label>
              <Input
                value={form.advertiser}
                onChange={(e) => setForm({ ...form, advertiser: e.target.value })}
                className="border-neutral-800 bg-neutral-900"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Placement</Label>
              <Select
                value={form.placement}
                onValueChange={(v) => setForm({ ...form, placement: v as AdPlacement })}
              >
                <SelectTrigger className="w-full border-neutral-800 bg-neutral-900">
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
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Click URL</Label>
            <Input
              value={form.clickUrl}
              onChange={(e) => setForm({ ...form, clickUrl: e.target.value })}
              className="border-neutral-800 bg-neutral-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input
                type="date"
                value={form.startAt.slice(0, 10)}
                onChange={(e) => setForm({ ...form, startAt: new Date(e.target.value).toISOString() })}
                className="border-neutral-800 bg-neutral-900"
              />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input
                type="date"
                value={form.endAt.slice(0, 10)}
                onChange={(e) => setForm({ ...form, endAt: new Date(e.target.value).toISOString() })}
                className="border-neutral-800 bg-neutral-900"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Weight</Label>
              <span className="tabular-nums text-sm text-neutral-300">{form.weight}</span>
            </div>
            <Slider
              value={[form.weight]}
              min={0}
              max={200}
              step={5}
              onValueChange={(v) => setForm({ ...form, weight: v[0] ?? 0 })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
            <div>
              <div className="text-sm font-medium text-neutral-100">Active</div>
              <div className="text-xs text-neutral-400">Campaign is eligible to serve.</div>
            </div>
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
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
            onClick={() => onSave(form)}
          >
            Save ad
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
