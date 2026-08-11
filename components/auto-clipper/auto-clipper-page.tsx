"use client";

import * as React from "react";
import {
  Activity,
  Check,
  Eye,
  Flag,
  MessageSquare,
  Settings as SettingsIcon,
  Target,
  Trash2,
  Zap,
  Loader2,
  Crown,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

import {
  approveAutoClip,
  AUTO_CLIP_STATUSES,
  AUTO_CLIP_TRIGGERS,
  discardAutoClip,
  getAutoClipperSettings,
  listAutoClips,
  previewClip,
  updateAutoClipperSettings,
  type AutoClip,
  type AutoClipStatus,
  type AutoClipTrigger,
  type AutoClipperSettings,
} from "@/lib/mock/auto-clips";
import { useAuth } from "@/components/providers";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { DataTable, type DataColumn } from "@/components/admin/data-table";
import { timeAgo } from "@/components/admin/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const TRIGGER_LABELS: Record<AutoClipTrigger, { label: string; icon: React.ElementType; tone: "emerald" | "amber" | "violet" | "blue" | "red" }> = {
  "chat-spike": { label: "Chat spike", icon: MessageSquare, tone: "amber" },
  "score-event": { label: "Score event", icon: Trophy, tone: "emerald" },
  killstreak: { label: "Killstreak", icon: Target, tone: "red" },
  "highlight-tag": { label: "Caster tag", icon: Flag, tone: "blue" },
  "casters-hyped": { label: "Casters hyped", icon: Crown, tone: "violet" },
};

const STATUS_TONES: Record<AutoClipStatus, "amber" | "emerald" | "neutral"> = {
  pending: "amber",
  approved: "emerald",
  discarded: "neutral",
};

export function AutoClipperPage() {
  const { role } = useAuth();

  const [filter, setFilter] = React.useState<AutoClipStatus | "all">("pending");
  const [clips, setClips] = React.useState<AutoClip[] | null>(null);
  const [previewing, setPreviewing] = React.useState<AutoClip | null>(null);
  const [settings, setSettings] = React.useState<AutoClipperSettings | null>(null);
  const [updating, setUpdating] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (role !== "admin") return;
    refresh();
    getAutoClipperSettings().then(setSettings);
  }, [role]);

  React.useEffect(() => {
    if (role !== "admin") return;
    refresh();
  }, [filter, role]);

  function refresh() {
    setClips(null);
    listAutoClips(filter === "all" ? undefined : { status: filter }).then(setClips);
  }

  if (role !== "admin") {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center p-8">
        <div className="w-full rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-100">Admin only</h2>
          <p className="mt-1 text-sm text-neutral-400">
            The auto-clipper console is restricted to EVO TV admins. Switch roles or head back to the app.
          </p>
          <Button asChild className="mt-4 bg-sky-600 hover:bg-sky-500">
            <Link href="/home">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  async function handleApprove(id: string) {
    setBusy(id);
    try {
      await approveAutoClip(id);
      toast.success("Clip approved & published");
      refresh();
    } catch {
      toast.error("Could not approve");
    } finally {
      setBusy(null);
    }
  }

  async function handleDiscard(id: string) {
    setBusy(id);
    try {
      await discardAutoClip(id);
      toast.message("Clip discarded");
      refresh();
    } catch {
      toast.error("Could not discard");
    } finally {
      setBusy(null);
    }
  }

  async function handlePreview(id: string) {
    const clip = await previewClip(id);
    setPreviewing(clip);
  }

  async function patchSettings(patch: Partial<AutoClipperSettings>) {
    if (!settings) return;
    setUpdating(true);
    try {
      const next = await updateAutoClipperSettings(patch);
      setSettings(next);
      toast.success("Settings saved");
    } catch {
      toast.error("Could not save");
    } finally {
      setUpdating(false);
    }
  }

  const columns: DataColumn<AutoClip>[] = [
    {
      key: "thumb",
      header: "",
      width: "104px",
      cell: (row) => (
        <div className="relative aspect-video w-24 overflow-hidden rounded">
          <img src={row.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium text-white">
            {row.endSec - row.startSec}s
          </span>
        </div>
      ),
    },
    {
      key: "trigger",
      header: "Trigger",
      cell: (row) => {
        const t = TRIGGER_LABELS[row.trigger];
        const Icon = t.icon;
        return (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset",
                t.tone === "amber" && "bg-amber-500/10 text-amber-300 ring-amber-500/30",
                t.tone === "emerald" && "bg-sky-500/10 text-sky-300 ring-sky-500/30",
                t.tone === "red" && "bg-red-500/10 text-red-300 ring-red-500/30",
                t.tone === "violet" && "bg-violet-500/10 text-violet-300 ring-violet-500/30",
                t.tone === "blue" && "bg-blue-500/10 text-blue-300 ring-blue-500/30",
              )}
            >
              <Icon className="size-3" />
              {t.label}
            </span>
          </div>
        );
      },
    },
    {
      key: "stream",
      header: "Source",
      cell: (row) => (
        <div className="min-w-0">
          <div className="max-w-[280px] truncate text-sm text-neutral-100" title={row.streamTitle}>
            {row.streamTitle}
          </div>
          <div className="truncate text-xs text-neutral-500">{row.caption}</div>
        </div>
      ),
    },
    {
      key: "confidence",
      header: "Confidence",
      sortable: true,
      accessor: (r) => r.confidence,
      cell: (row) => {
        const pct = Math.round(row.confidence * 100);
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-800">
              <div
                className={cn(
                  "h-full rounded-full",
                  pct >= 90 ? "bg-emerald-400" : pct >= 75 ? "bg-sky-400" : "bg-amber-400",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-neutral-400">{pct}%</span>
          </div>
        );
      },
    },
    {
      key: "detected",
      header: "Detected",
      sortable: true,
      accessor: (r) => new Date(r.detectedAt).getTime(),
      cell: (row) => <span className="text-xs text-neutral-400">{timeAgo(row.detectedAt)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (r) => r.status,
      cell: (row) => (
        <StatusBadge tone={STATUS_TONES[row.status]}>
          {row.status === "pending" ? "Pending review" : row.status === "approved" ? "Approved" : "Discarded"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => handlePreview(row.id)}>
            <Eye className="size-3.5" />
            Preview
          </Button>
          {row.status === "pending" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy === row.id}
                onClick={() => handleApprove(row.id)}
              >
                {busy === row.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <>
                    <Check className="size-3.5" />
                    Approve
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
                disabled={busy === row.id}
                onClick={() => handleDiscard(row.id)}
              >
                <Trash2 className="size-3.5" />
                Discard
              </Button>
            </>
          ) : null}
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8">
      <PageHeader
        title="Auto-clipper"
        description="Watches every live stream for moments worth clipping. You review and ship to /clips."
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge tone={settings?.enabled ? "emerald" : "neutral"} dot={settings?.enabled}>
              {settings?.enabled ? "Running" : "Paused"}
            </StatusBadge>
            <Switch
              checked={settings?.enabled ?? false}
              disabled={!settings || updating}
              onCheckedChange={(v) => patchSettings({ enabled: v })}
            />
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatTile icon={Activity} label="Pending review" value={(clips ?? []).filter((c) => c.status === "pending").length} tone="amber" />
        <StatTile icon={Check} label="Approved (24h)" value={(clips ?? []).filter((c) => c.status === "approved").length} tone="emerald" />
        <StatTile icon={Trash2} label="Discarded (24h)" value={(clips ?? []).filter((c) => c.status === "discarded").length} tone="neutral" />
        <StatTile icon={Zap} label="Triggers active" value={settings?.scoreEventTypes.length ?? 0} tone="violet" />
      </section>

      <section>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as AutoClipStatus | "all")}>
          <TabsList className="bg-neutral-900/60">
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="discarded">Discarded</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-4">
          <DataTable
            data={clips ?? []}
            columns={columns}
            rowKey={(r) => r.id}
            loading={clips === null}
            initialSort={{ key: "detected", direction: "desc" }}
            emptyMessage="No auto-clips match this filter."
          />
        </div>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
        <div className="mb-4 flex items-center gap-2">
          <SettingsIcon className="size-4 text-neutral-400" />
          <h3 className="text-sm font-semibold text-neutral-100">Trigger settings</h3>
        </div>
        {settings ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <SettingRow
              label="Chat spike threshold"
              hint="Messages per second to trigger a clip"
            >
              <div className="flex items-center gap-3">
                <Slider
                  value={[settings.chatSpikeMessagesPerSec]}
                  min={4}
                  max={40}
                  step={1}
                  onValueChange={(v) => setSettings((s) => (s ? { ...s, chatSpikeMessagesPerSec: v[0] ?? s.chatSpikeMessagesPerSec } : s))}
                  onValueCommit={(v) => patchSettings({ chatSpikeMessagesPerSec: v[0] })}
                  className="flex-1"
                />
                <span className="w-12 text-right text-xs tabular-nums text-neutral-300">
                  {settings.chatSpikeMessagesPerSec}/s
                </span>
              </div>
            </SettingRow>

            <SettingRow label="Killstreak min kills" hint="Consecutive kills detected">
              <div className="flex items-center gap-3">
                <Slider
                  value={[settings.killstreakMinKills]}
                  min={2}
                  max={8}
                  step={1}
                  onValueChange={(v) =>
                    setSettings((s) => (s ? { ...s, killstreakMinKills: v[0] ?? s.killstreakMinKills } : s))
                  }
                  onValueCommit={(v) => patchSettings({ killstreakMinKills: v[0] })}
                  className="flex-1"
                />
                <span className="w-12 text-right text-xs tabular-nums text-neutral-300">
                  {settings.killstreakMinKills}
                </span>
              </div>
            </SettingRow>

            <SettingRow label="Min clip length" hint="Lowest acceptable duration">
              <div className="flex items-center gap-3">
                <Slider
                  value={[settings.minClipDurationSec]}
                  min={8}
                  max={30}
                  step={1}
                  onValueChange={(v) =>
                    setSettings((s) => (s ? { ...s, minClipDurationSec: v[0] ?? s.minClipDurationSec } : s))
                  }
                  onValueCommit={(v) => patchSettings({ minClipDurationSec: v[0] })}
                  className="flex-1"
                />
                <span className="w-12 text-right text-xs tabular-nums text-neutral-300">
                  {settings.minClipDurationSec}s
                </span>
              </div>
            </SettingRow>

            <SettingRow label="Max clip length" hint="Hard cap on detected clips">
              <div className="flex items-center gap-3">
                <Slider
                  value={[settings.maxClipDurationSec]}
                  min={30}
                  max={120}
                  step={5}
                  onValueChange={(v) =>
                    setSettings((s) => (s ? { ...s, maxClipDurationSec: v[0] ?? s.maxClipDurationSec } : s))
                  }
                  onValueCommit={(v) => patchSettings({ maxClipDurationSec: v[0] })}
                  className="flex-1"
                />
                <span className="w-12 text-right text-xs tabular-nums text-neutral-300">
                  {settings.maxClipDurationSec}s
                </span>
              </div>
            </SettingRow>

            <SettingRow label="Score event types" hint="Which game-state events fire a clip">
              <div className="flex flex-wrap gap-2">
                {(["ace", "clutch", "comeback", "first-blood"] as const).map((kind) => {
                  const active = settings.scoreEventTypes.includes(kind);
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? settings.scoreEventTypes.filter((s) => s !== kind)
                          : [...settings.scoreEventTypes, kind];
                        patchSettings({ scoreEventTypes: next });
                      }}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
                        active
                          ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
                          : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700",
                      )}
                    >
                      {kind}
                    </button>
                  );
                })}
              </div>
            </SettingRow>

            <SettingRow
              label="Auto-approve confidence"
              hint="Above this threshold, clips publish without review"
            >
              <div className="flex items-center gap-3">
                <Slider
                  value={[Math.round(settings.autoApproveAboveConfidence * 100)]}
                  min={75}
                  max={99}
                  step={1}
                  onValueChange={(v) =>
                    setSettings((s) =>
                      s ? { ...s, autoApproveAboveConfidence: (v[0] ?? 90) / 100 } : s,
                    )
                  }
                  onValueCommit={(v) =>
                    patchSettings({ autoApproveAboveConfidence: (v[0] ?? 90) / 100 })
                  }
                  className="flex-1"
                />
                <span className="w-12 text-right text-xs tabular-nums text-neutral-300">
                  {Math.round(settings.autoApproveAboveConfidence * 100)}%
                </span>
              </div>
            </SettingRow>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-neutral-800/50" />
            ))}
          </div>
        )}
      </section>

      {/* Preview dialog */}
      <Dialog open={Boolean(previewing)} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewing?.caption ?? "Clip preview"}</DialogTitle>
            <DialogDescription>
              {previewing
                ? `${previewing.streamTitle} · ${previewing.endSec - previewing.startSec}s · ${TRIGGER_LABELS[previewing.trigger].label}`
                : null}
            </DialogDescription>
          </DialogHeader>
          {previewing ? (
            <>
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                <img
                  src={previewing.thumbnailUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                  <div className="flex size-16 items-center justify-center rounded-full bg-white/20">
                    <Eye className="size-7 text-white" />
                  </div>
                </div>
                <div className="absolute bottom-2 left-2 rounded bg-black/80 px-2 py-0.5 text-[10px] font-medium text-white">
                  Preview · auto-generated
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <Mini label="Trigger">{TRIGGER_LABELS[previewing.trigger].label}</Mini>
                <Mini label="Confidence">{Math.round(previewing.confidence * 100)}%</Mini>
                <Mini label="Window">{`${previewing.startSec}s → ${previewing.endSec}s`}</Mini>
                <Mini label="Detected">{timeAgo(previewing.detectedAt)}</Mini>
              </div>
              {previewing.status === "pending" ? (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      handleDiscard(previewing.id);
                      setPreviewing(null);
                    }}
                    className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
                  >
                    Discard
                  </Button>
                  <Button
                    onClick={() => {
                      handleApprove(previewing.id);
                      setPreviewing(null);
                    }}
                  >
                    <Check className="size-4" />
                    Approve & publish
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: "amber" | "emerald" | "neutral" | "violet";
}) {
  const ring = {
    amber: "ring-amber-500/30",
    emerald: "ring-sky-500/30",
    neutral: "ring-neutral-700",
    violet: "ring-violet-500/30",
  }[tone];
  return (
    <div className={`rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 ring-1 ring-inset ${ring}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-500">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-50">{value}</div>
    </div>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
      <Label className="text-xs font-semibold text-neutral-200">{label}</Label>
      {hint ? <p className="mt-0.5 text-[11px] text-neutral-500">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-100">{children}</div>
    </div>
  );
}
