"use client";

import * as React from "react";
import { Search, ShieldCheck, Eye, ScanLine, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import {
  listForensicMarks,
  getForensicMark,
  searchForensicMarksByCode,
  type ForensicAction,
  type ForensicMark,
} from "@/lib/mock/forensic";
import { listLiveStreams } from "@/lib/mock/streams";
import type { Stream } from "@/lib/types";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { DataTable, type DataColumn } from "@/components/admin/data-table";
import { timeAgo } from "@/components/admin/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ACTION_TONES: Record<ForensicAction, "neutral" | "amber" | "red" | "violet"> = {
  none: "neutral",
  warned: "amber",
  "session-revoked": "amber",
  "account-suspended": "red",
  "legal-takedown": "violet",
};

const ACTION_LABELS: Record<ForensicAction, string> = {
  none: "No action",
  warned: "Warned",
  "session-revoked": "Session revoked",
  "account-suspended": "Account suspended",
  "legal-takedown": "Legal takedown",
};

const SOURCE_LABELS: Record<ForensicMark["source"], string> = {
  "telegram-leak": "Telegram leak",
  "twitter-clip": "Twitter clip",
  "torrent-tracker": "Torrent tracker",
  "youtube-mirror": "YouTube mirror",
};

export function ForensicPage() {
  const [marks, setMarks] = React.useState<ForensicMark[] | null>(null);
  const [streams, setStreams] = React.useState<Stream[]>([]);
  const [streamFilter, setStreamFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [openMark, setOpenMark] = React.useState<ForensicMark | null>(null);

  React.useEffect(() => {
    listLiveStreams().then(setStreams);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setMarks(null);
    listForensicMarks(streamFilter === "all" ? undefined : streamFilter).then(
      (list) => {
        if (!cancelled) setMarks(list);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [streamFilter]);

  const filteredMarks = React.useMemo(() => {
    if (!marks) return [];
    if (!search.trim()) return marks;
    const q = search.toLowerCase().replace(/[-\s]/g, "");
    return marks.filter(
      (m) =>
        m.code.toLowerCase().replace(/-/g, "").includes(q) ||
        m.userHandle.toLowerCase().includes(q) ||
        m.sessionId.toLowerCase().includes(q),
    );
  }, [marks, search]);

  React.useEffect(() => {
    if (!openId) {
      setOpenMark(null);
      return;
    }
    let cancelled = false;
    getForensicMark(openId).then((m) => {
      if (!cancelled) setOpenMark(m);
    });
    return () => {
      cancelled = true;
    };
  }, [openId]);

  async function copyCode(code: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.message("Clipboard unavailable");
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Watermark code copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  async function searchByCode() {
    if (!search.trim()) return;
    const list = await searchForensicMarksByCode(search.trim());
    if (list.length === 0) {
      toast.message("No matching watermark on record");
      return;
    }
    toast.success(`${list.length} match${list.length === 1 ? "" : "es"} found`);
  }

  const columns: DataColumn<ForensicMark>[] = [
    {
      key: "session",
      header: "Session",
      cell: (row) => (
        <div className="font-mono text-[11px]">
          <div className="text-neutral-100">{row.sessionId}</div>
          <div className="text-neutral-500">@{row.userHandle}</div>
        </div>
      ),
    },
    {
      key: "stream",
      header: "Stream",
      cell: (row) => (
        <div className="max-w-[260px] truncate text-sm text-neutral-200" title={row.streamTitle}>
          {row.streamTitle}
        </div>
      ),
    },
    {
      key: "code",
      header: "Watermark",
      cell: (row) => (
        <button
          type="button"
          onClick={() => copyCode(row.code)}
          className="font-mono text-[11px] text-sky-300 hover:underline"
          title="Copy code"
        >
          {row.code}
        </button>
      ),
    },
    {
      key: "source",
      header: "Source",
      cell: (row) => (
        <span className="text-xs text-neutral-300">{SOURCE_LABELS[row.source]}</span>
      ),
    },
    {
      key: "confidence",
      header: "Confidence",
      sortable: true,
      accessor: (r) => r.matchConfidence,
      cell: (row) => {
        const pct = Math.round(row.matchConfidence * 100);
        const tone = pct >= 90 ? "emerald" : pct >= 80 ? "blue" : "amber";
        return (
          <StatusBadge tone={tone === "emerald" ? "emerald" : tone === "blue" ? "blue" : "amber"}>
            {pct}%
          </StatusBadge>
        );
      },
      className: "text-right",
    },
    {
      key: "captured",
      header: "Captured",
      sortable: true,
      accessor: (r) => new Date(r.capturedAt).getTime(),
      cell: (row) => (
        <span className="text-xs text-neutral-400">{timeAgo(row.capturedAt)}</span>
      ),
    },
    {
      key: "action",
      header: "Action",
      sortable: true,
      accessor: (r) => r.action,
      cell: (row) => (
        <StatusBadge tone={ACTION_TONES[row.action]}>{ACTION_LABELS[row.action]}</StatusBadge>
      ),
    },
  ];

  const stats = React.useMemo(() => {
    const list = marks ?? [];
    return {
      total: list.length,
      pending: list.filter((m) => m.action === "none" || m.action === "warned").length,
      legal: list.filter((m) => m.action === "legal-takedown").length,
    };
  }, [marks]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forensic watermark"
        description="Per-session A/B-frame manifests embed a unique code so leaks can be traced back to the originating viewer."
        actions={
          <StatusBadge tone="emerald" dot>
            Live tracing
          </StatusBadge>
        }
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={ShieldCheck}
          label="Marks captured (30d)"
          value={stats.total.toString()}
          tone="emerald"
        />
        <StatCard
          icon={Eye}
          label="Pending review"
          value={stats.pending.toString()}
          tone="amber"
        />
        <StatCard
          icon={AlertTriangle}
          label="Legal takedowns"
          value={stats.legal.toString()}
          tone="red"
        />
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-100">How it works</h3>
        <ol className="grid grid-cols-1 gap-3 text-xs text-neutral-400 sm:grid-cols-3">
          <li className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
            <span className="mb-1.5 inline-flex size-5 items-center justify-center rounded-full bg-sky-500/20 text-[10px] font-bold text-sky-300">
              1
            </span>
            <p className="text-neutral-200">Per-session manifest</p>
            <p className="mt-0.5">
              Each viewer gets a slightly-shifted HLS variant; ads are encoded with a unique
              fingerprint per session.
            </p>
          </li>
          <li className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
            <span className="mb-1.5 inline-flex size-5 items-center justify-center rounded-full bg-sky-500/20 text-[10px] font-bold text-sky-300">
              2
            </span>
            <p className="text-neutral-200">Detect & match</p>
            <p className="mt-0.5">
              Crawlers scan Telegram, Twitter, and torrent trackers, fingerprint match, surface
              the originating session.
            </p>
          </li>
          <li className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
            <span className="mb-1.5 inline-flex size-5 items-center justify-center rounded-full bg-sky-500/20 text-[10px] font-bold text-sky-300">
              3
            </span>
            <p className="text-neutral-200">Action</p>
            <p className="mt-0.5">
              Mod team revokes the session, suspends the account, or escalates to legal — depending
              on confidence + repeat offence.
            </p>
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, handle, session…"
              className="border-neutral-800 bg-neutral-900 pl-8 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={searchByCode}>
            <ScanLine className="size-3.5" />
            Trace code
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-neutral-500">Stream:</span>
            <Select value={streamFilter} onValueChange={setStreamFilter}>
              <SelectTrigger className="w-56 border-neutral-800 bg-neutral-900 text-sm">
                <SelectValue placeholder="All streams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All streams</SelectItem>
                {streams.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DataTable
          data={filteredMarks}
          columns={columns}
          rowKey={(r) => r.id}
          loading={marks === null}
          onRowClick={(r) => setOpenId(r.id)}
          emptyMessage="No watermark captures match this filter."
          initialSort={{ key: "captured", direction: "desc" }}
        />
      </section>

      <Sheet open={Boolean(openId)} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full max-w-lg sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Watermark capture</SheetTitle>
            <SheetDescription>
              Forensic detail for the matched leak. Drill in to confirm before action.
            </SheetDescription>
          </SheetHeader>
          {openMark ? (
            <div className="mt-6 space-y-5 px-4 pb-6">
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Code</div>
                <button
                  type="button"
                  onClick={() => copyCode(openMark.code)}
                  className="mt-1 block w-full break-all text-left font-mono text-base text-sky-300 hover:underline"
                >
                  {openMark.code}
                </button>
              </div>

              <ManifestVisual code={openMark.code} />

              <Section label="Session">
                <Row label="ID" value={<span className="font-mono">{openMark.sessionId}</span>} />
                <Row label="User" value={`@${openMark.userHandle} (${openMark.userId})`} />
                <Row label="Stream" value={openMark.streamTitle} />
              </Section>

              <Section label="Detection">
                <Row label="Source" value={SOURCE_LABELS[openMark.source]} />
                <Row
                  label="Confidence"
                  value={`${Math.round(openMark.matchConfidence * 100)}%`}
                />
                <Row label="Captured" value={timeAgo(openMark.capturedAt)} />
              </Section>

              <Section label="Action taken">
                <div className="flex items-center gap-2">
                  <StatusBadge tone={ACTION_TONES[openMark.action]}>
                    {ACTION_LABELS[openMark.action]}
                  </StatusBadge>
                  {openMark.action === "none" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.success("Action queued for moderator review")}
                    >
                      Queue review
                    </Button>
                  ) : null}
                </div>
              </Section>
            </div>
          ) : (
            <div className="mt-6 px-4">
              <div className="h-32 rounded-xl bg-neutral-900/60 animate-pulse" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "emerald" | "amber" | "red";
}) {
  const ring =
    tone === "emerald"
      ? "ring-sky-500/30"
      : tone === "amber"
        ? "ring-amber-500/30"
        : "ring-red-500/30";
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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-neutral-800/50 py-2 first:border-t-0 first:pt-0">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="max-w-[60%] text-right text-sm text-neutral-100">{value}</span>
    </div>
  );
}

function ManifestVisual({ code }: { code: string }) {
  // Generate 12 evenly-spaced colored bars; positions encode the watermark.
  const bars = Array.from({ length: 24 }).map((_, i) => {
    const seed = code.charCodeAt(i % code.length) + i;
    const intensity = (seed % 100) / 100;
    return { intensity };
  });
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-neutral-500">
        <ScanLine className="size-3" />
        Manifest fingerprint
      </div>
      <svg viewBox="0 0 240 60" className="h-16 w-full" aria-hidden="true">
        {bars.map((b, i) => (
          <rect
            key={i}
            x={i * 10}
            y={30 - b.intensity * 25}
            width={6}
            height={b.intensity * 50 + 6}
            rx={1}
            className={
              i % 5 === 0
                ? "fill-amber-400"
                : i % 4 === 0
                  ? "fill-sky-400"
                  : "fill-neutral-600"
            }
          />
        ))}
      </svg>
      <p className="mt-2 text-[11px] text-neutral-500">
        Each bar represents an A/B segment offset embedded in this viewer's HLS manifest. Highlighted
        bars are the per-session signature.
      </p>
    </div>
  );
}
