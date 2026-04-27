"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock4,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { DataTable, type DataColumn } from "@/components/admin/data-table";
import { formatNgn, timeAgo } from "@/components/admin/utils";
import {
  listAllUssdSessions,
  overrideUssdSession,
  type UssdSession,
  type UssdStatus,
} from "@/lib/mock/ussd";

function statusTone(s: UssdStatus): "amber" | "emerald" | "red" {
  if (s === "awaiting") return "amber";
  if (s === "confirmed") return "emerald";
  return "red";
}

export function AdminBillingPage() {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [confirming, setConfirming] = React.useState<UssdSession | null>(null);
  const [expiring, setExpiring] = React.useState<UssdSession | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const sessionsQ = useQuery({
    queryKey: ["admin", "ussd-sessions", refreshKey],
    queryFn: () => listAllUssdSessions(),
    refetchInterval: 5_000,
  });

  const sessions: UssdSession[] = sessionsQ.data ?? [];

  const filtered = React.useMemo(() => {
    let rows = sessions;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((s) =>
        [s.code, s.providerLabel, s.shortCode, s.userId].some((v) =>
          v.toLowerCase().includes(q)
        )
      );
    }
    if (statusFilter !== "all") rows = rows.filter((s) => s.status === statusFilter);
    return rows;
  }, [sessions, search, statusFilter]);

  const counts = React.useMemo(() => {
    const c = { awaiting: 0, confirmed: 0, expired: 0, total: sessions.length };
    for (const s of sessions) c[s.status] += 1;
    return c;
  }, [sessions]);

  async function refresh() {
    setRefreshKey((k) => k + 1);
    await sessionsQ.refetch();
  }

  async function override(
    session: UssdSession,
    next: Exclude<UssdStatus, "awaiting">
  ) {
    const updated = await overrideUssdSession(session.id, next);
    if (!updated) {
      toast.error("Session no longer exists");
    } else {
      toast.success(
        next === "confirmed"
          ? `Confirmed ${session.code} manually`
          : `Marked ${session.code} expired`
      );
    }
    await sessionsQ.refetch();
  }

  const columns: DataColumn<UssdSession>[] = [
    {
      key: "code",
      header: "Linking code",
      cell: (row) => (
        <div className="font-mono text-sm tracking-[0.2em] text-neutral-100">
          {row.code}
        </div>
      ),
    },
    {
      key: "provider",
      header: "Provider",
      sortable: true,
      accessor: (r) => r.providerLabel,
      cell: (row) => (
        <div className="text-sm text-neutral-200">
          {row.providerLabel}
          <div className="text-xs text-neutral-500 font-mono">{row.shortCode}</div>
        </div>
      ),
    },
    {
      key: "user",
      header: "User",
      sortable: true,
      accessor: (r) => r.userId,
      cell: (row) => <span className="font-mono text-xs text-neutral-300">{row.userId}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      accessor: (r) => r.amountNgn,
      cell: (row) => <span className="tabular-nums text-sm">{formatNgn(row.amountNgn)}</span>,
      className: "text-right",
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (r) => r.status,
      cell: (row) => (
        <StatusBadge tone={statusTone(row.status)} dot={row.status === "awaiting"}>
          {row.status}
        </StatusBadge>
      ),
    },
    {
      key: "started",
      header: "Started",
      sortable: true,
      accessor: (r) => new Date(r.startedAt).getTime(),
      cell: (row) => <span className="text-xs text-neutral-400">{timeAgo(row.startedAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={row.status !== "awaiting"}
            className="h-7 border-neutral-700 bg-neutral-900 px-2 text-xs hover:bg-neutral-800 disabled:opacity-40"
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(row);
            }}
          >
            <CheckCircle2 className="size-3" />
            Confirm
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={row.status !== "awaiting"}
            className="h-7 border-neutral-700 bg-neutral-900 px-2 text-xs hover:bg-neutral-800 disabled:opacity-40"
            onClick={(e) => {
              e.stopPropagation();
              setExpiring(row);
            }}
          >
            <XCircle className="size-3" />
            Expire
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & USSD"
        description="Monitor pending USSD sessions, manually confirm or expire them."
        actions={
          <Button
            variant="outline"
            className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
            onClick={refresh}
            disabled={sessionsQ.isFetching}
          >
            {sessionsQ.isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard
          label="Total"
          value={counts.total}
          tone="neutral"
          Icon={Clock4}
        />
        <SummaryCard
          label="Awaiting"
          value={counts.awaiting}
          tone="amber"
          Icon={Clock4}
        />
        <SummaryCard
          label="Confirmed"
          value={counts.confirmed}
          tone="emerald"
          Icon={CheckCircle2}
        />
        <SummaryCard
          label="Expired"
          value={counts.expired}
          tone="red"
          Icon={XCircle}
        />
      </div>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-50">Pending USSD</h2>
            <p className="mt-0.5 text-sm text-neutral-400">
              Sessions auto-confirm 30s after the user starts. Use the manual override only when
              the upstream provider stalls.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-neutral-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, provider, user"
              className="border-neutral-800 bg-neutral-900 pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 border-neutral-800 bg-neutral-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="awaiting">Awaiting</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-neutral-500">
            {filtered.length} sessions
          </div>
        </div>

        <DataTable<UssdSession>
          data={filtered}
          columns={columns}
          rowKey={(r) => r.id}
          loading={sessionsQ.isLoading}
          emptyMessage="No USSD sessions match these filters."
        />
      </section>

      <Dialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Manually confirm session?</DialogTitle>
            <DialogDescription className="text-neutral-400">
              This will mark linking code{" "}
              <span className="font-mono text-neutral-200">{confirming?.code}</span> as confirmed
              and grant the user Premium. Use this only when the carrier callback is delayed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
              onClick={() => setConfirming(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-sky-500 text-black hover:bg-sky-500/90"
              onClick={async () => {
                if (!confirming) return;
                await override(confirming, "confirmed");
                setConfirming(null);
              }}
            >
              Confirm session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!expiring} onOpenChange={(o) => !o && setExpiring(null)}>
        <DialogContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Expire session?</DialogTitle>
            <DialogDescription className="text-neutral-400">
              This invalidates linking code{" "}
              <span className="font-mono text-neutral-200">{expiring?.code}</span>. The user
              will have to start a new session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
              onClick={() => setExpiring(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-500"
              onClick={async () => {
                if (!expiring) return;
                await override(expiring, "expired");
                setExpiring(null);
              }}
            >
              Expire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  Icon,
}: {
  label: string;
  value: number;
  tone: "neutral" | "amber" | "emerald" | "red";
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const accent = {
    neutral: "bg-neutral-700/30 text-neutral-300 ring-neutral-700",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    emerald: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
  }[tone];
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div
        className={`flex size-10 items-center justify-center rounded-lg ring-1 ring-inset ${accent}`}
        aria-hidden
      >
        <Icon className="size-5" />
      </div>
      <div className="flex-1">
        <p className="text-xs uppercase tracking-wider text-neutral-500">{label}</p>
        <p className="text-lg font-bold text-neutral-50 tabular-nums">{value}</p>
      </div>
    </div>
  );
}
