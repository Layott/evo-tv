"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { DataTable, type DataColumn } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROOMS } from "@/lib/auth/capabilities";
import { ASSIGNABLE_ROLES, roleLabel } from "@/lib/auth/role-catalog";

/**
 * Who did what, in which room, and what the value was before.
 *
 * The log has existed since August and had no screen: reading it meant curling
 * an endpoint. It also recorded only actor, action and target, so "who changed
 * the price" was answerable and "what was it before" was not.
 *
 * A row expands to the fields that actually moved. Only the changed ones are
 * stored, so this is the whole change rather than two copies of a record with
 * the difference buried in it.
 */
interface AuditEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  capability: string | null;
  action: string;
  targetType: string;
  targetId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function valueLabel(v: unknown): string {
  if (v === null || v === undefined) return "empty";
  if (typeof v === "string") return v === "" ? "empty" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

export function AuditLogPage() {
  const [room, setRoom] = React.useState("all");
  const [role, setRole] = React.useState("all");
  const [action, setAction] = React.useState("");
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin", "audit", room, role, action],
    queryFn: async (): Promise<AuditEntry[]> => {
      const params = new URLSearchParams({ limit: "200" });
      if (room !== "all") params.set("capability", room);
      if (role !== "all") params.set("actorRole", role);
      if (action.trim()) params.set("action", action.trim());
      const res = await fetch(`/api/admin/audit-log?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const columns: DataColumn<AuditEntry>[] = [
    {
      key: "createdAt",
      header: "When",
      width: "150px",
      sortable: true,
      accessor: (r) => r.createdAt,
      cell: (r) => (
        <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
          {timeLabel(r.createdAt)}
        </span>
      ),
    },
    {
      key: "actor",
      header: "Who",
      cell: (r) => (
        <span className="block">
          <span className="block text-sm text-foreground">
            {r.actorName ?? r.actorEmail ?? "Deleted account"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {r.actorRole ? roleLabel(r.actorRole) : "role not recorded"}
          </span>
        </span>
      ),
    },
    {
      key: "capability",
      header: "Room",
      width: "120px",
      cell: (r) =>
        r.capability ? (
          <StatusBadge>
            {ROOMS.find((x) => x.value === r.capability)?.label ?? r.capability}
          </StatusBadge>
        ) : (
          <span className="text-xs text-muted-foreground">not recorded</span>
        ),
    },
    {
      key: "action",
      header: "Did what",
      cell: (r) => (
        <span className="block">
          <span className="block font-mono text-xs text-foreground">
            {r.action}
          </span>
          <span className="block text-xs text-muted-foreground">
            {r.targetType} {r.targetId}
          </span>
        </span>
      ),
    },
    {
      key: "changes",
      header: "Changed",
      width: "110px",
      cell: (r) => {
        const n = r.after ? Object.keys(r.after).length : 0;
        if (n === 0) {
          return <span className="text-xs text-muted-foreground">no fields</span>;
        }
        return (
          <span className="text-sm text-sky-400">
            {n} field{n === 1 ? "" : "s"}
          </span>
        );
      },
    },
  ];

  const rows = query.data ?? [];

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every action taken in the dashboard, the role it was taken under, and what changed."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={room} onValueChange={setRoom}>
          <SelectTrigger className="w-44 bg-card">
            <SelectValue placeholder="All rooms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rooms</SelectItem>
            {ROOMS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-44 bg-card">
            <SelectValue placeholder="Any role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any role</SelectItem>
            {ASSIGNABLE_ROLES.filter((r) => r.isStaff).map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Action, e.g. stream."
          className="w-56 bg-card"
        />
      </div>

      {query.isError ? (
        <div className="rounded-xl bg-card p-6">
          <p className="text-sm text-muted-foreground">
            The log could not be loaded.
          </p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-3 text-sm text-sky-400 underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <DataTable
            data={rows}
            columns={columns}
            rowKey={(r) => r.id}
            loading={query.isPending}
            onRowClick={(r) => setExpanded(expanded === r.id ? null : r.id)}
            emptyMessage={
              action || room !== "all" || role !== "all"
                ? "Nothing matches those filters."
                : "Nothing has been done yet."
            }
            initialSort={{ key: "createdAt", direction: "desc" }}
          />

          {expanded ? (
            <ChangeDetail entry={rows.find((r) => r.id === expanded) ?? null} />
          ) : null}
        </>
      )}
    </div>
  );
}

function ChangeDetail({ entry }: { entry: AuditEntry | null }) {
  if (!entry) return null;
  const keys = Object.keys(entry.after ?? {});

  return (
    <div className="mt-4 rounded-xl bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">
        {entry.action} on {entry.targetType} {entry.targetId}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {timeLabel(entry.createdAt)}
        {entry.ip ? ` · from ${entry.ip}` : ""}
      </p>

      {keys.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No field-level record for this one. Actions logged before the log
          started keeping values, and actions that change nothing on a row, look
          like this.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {keys.map((key) => (
            <div
              key={key}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg bg-background/60 px-3 py-2"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {key}
              </span>
              <span className="text-sm text-foreground/70 line-through">
                {valueLabel(entry.before?.[key])}
              </span>
              <span className="text-sm text-sky-300">
                {valueLabel(entry.after?.[key])}
              </span>
            </div>
          ))}
        </div>
      )}

      {entry.meta && Object.keys(entry.meta).length > 0 ? (
        <pre className="mt-4 overflow-x-auto rounded-lg bg-background/60 p-3 text-xs text-muted-foreground">
          {JSON.stringify(entry.meta, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

export default AuditLogPage;
