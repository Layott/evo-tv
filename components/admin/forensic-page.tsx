"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/client";
import { DataTable, type DataColumn } from "./data-table";
import { HowTo } from "./how-to";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";
import { formatDateTime } from "./utils";

/**
 * Who signed in, from where, and who else was on the same connection.
 *
 * This screen was a "Coming soon" card promising per-session watermarks and
 * leak tracing, which needs a transcoding pipeline nobody has built. Meanwhile
 * `login_events` has been recording every sign-in with a hashed IP, a device
 * fingerprint and the method used, and `/api/admin/login-events` has been able
 * to answer "every account that signed in from this connection" since August.
 * Nothing on either dashboard called it.
 *
 * So the page is the thing that exists. It is the screen for the question that
 * actually comes up, which is not "who leaked this stream" but "this person is
 * back after a ban, aren't they".
 *
 * The IP is stored hashed and shown truncated. It is enough to group by and
 * useless for anything else, which is the point: the job is spotting the same
 * connection twice, not knowing where somebody lives.
 */

interface LoginEvent {
  id: string;
  userId: string;
  ipHash: string | null;
  region: string | null;
  userAgent: string | null;
  deviceFp: string | null;
  method: string | null;
  createdAt: string;
  userHandle: string | null;
  userEmail: string | null;
  userName: string | null;
}

type Pivot = { kind: "ip" | "device"; value: string } | null;

/** The device, in the words somebody would use for it. */
function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent.toLowerCase();
  if (ua.includes("evotv") || ua.includes("expo")) return "EVO TV app";
  if (ua.includes("android")) return "Android browser";
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS browser";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "Mac";
  if (ua.includes("linux")) return "Linux";
  return "Other";
}

function short(value: string | null): string {
  if (!value) return "none";
  return value.slice(0, 10);
}

export function ForensicPage() {
  const [pivot, setPivot] = React.useState<Pivot>(null);

  const eventsQ = useQuery({
    queryKey: ["admin", "login-events", pivot],
    queryFn: () =>
      apiGet<{ events: LoginEvent[] }>("/api/admin/login-events", {
        limit: 100,
        ...(pivot?.kind === "ip" ? { ipHash: pivot.value } : {}),
        ...(pivot?.kind === "device" ? { deviceFp: pivot.value } : {}),
      }),
    staleTime: 30_000,
  });

  const events = eventsQ.data?.events ?? [];

  /*
   * How many different accounts are behind whatever is on screen.
   *
   * On the unfiltered list it is a size-of-the-platform number and not very
   * interesting. Pivoted on one connection it is the whole answer: two accounts
   * on one hashed IP is a household, and nine is somebody working around a ban.
   */
  const distinctAccounts = new Set(events.map((e) => e.userId)).size;

  const columns: DataColumn<LoginEvent>[] = [
    {
      key: "when",
      header: "When",
      width: "160px",
      sortable: true,
      accessor: (r) => r.createdAt,
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {formatDateTime(r.createdAt)}
        </span>
      ),
    },
    {
      key: "who",
      header: "Who",
      cell: (r) => (
        <span className="block">
          <span className="block text-sm text-foreground">
            {r.userName ?? r.userHandle ?? "Deleted account"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {r.userHandle ? `@${r.userHandle}` : (r.userEmail ?? r.userId)}
          </span>
        </span>
      ),
    },
    {
      key: "method",
      header: "How",
      width: "120px",
      cell: (r) => <StatusBadge>{r.method ?? "password"}</StatusBadge>,
    },
    {
      key: "device",
      header: "Device",
      cell: (r) => (
        <span className="block">
          <span className="block text-sm text-foreground">
            {deviceLabel(r.userAgent)}
          </span>
          {r.deviceFp ? (
            <button
              type="button"
              onClick={() => setPivot({ kind: "device", value: r.deviceFp! })}
              className="text-xs text-sky-400 hover:underline"
            >
              Everyone on this device
            </button>
          ) : null}
        </span>
      ),
    },
    {
      key: "where",
      header: "Connection",
      cell: (r) => (
        <span className="block">
          <span className="block text-sm text-foreground">
            {r.region ?? "Region unknown"}
          </span>
          {r.ipHash ? (
            <button
              type="button"
              onClick={() => setPivot({ kind: "ip", value: r.ipHash! })}
              className="font-mono text-xs text-sky-400 hover:underline"
              title="Hashed. Enough to group by, useless for anything else."
            >
              {short(r.ipHash)} · everyone here
            </button>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sign-in forensics"
        description="Who signed in, from where, and who else was on the same connection."
      />
      <HowTo page="forensic" />

      {pivot ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-card/60 p-4">
          <span className="text-sm text-foreground">
            {pivot.kind === "ip"
              ? "Every account that signed in from this connection"
              : "Every account that signed in on this device"}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {short(pivot.value)}
          </span>
          <span className="text-sm text-muted-foreground">
            {distinctAccounts} {distinctAccounts === 1 ? "account" : "accounts"},{" "}
            {events.length} {events.length === 1 ? "sign-in" : "sign-ins"}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto bg-card hover:bg-accent"
            onClick={() => setPivot(null)}
          >
            <X className="h-3.5 w-3.5" />
            Show everyone again
          </Button>
        </div>
      ) : null}

      <DataTable
        data={events}
        columns={columns}
        rowKey={(r) => r.id}
        loading={eventsQ.isLoading}
        initialSort={{ key: "when", direction: "desc" }}
        emptyMessage={
          pivot
            ? "Nothing else has signed in from there."
            : "No sign-ins recorded yet."
        }
      />

      <p className="max-w-[70ch] text-xs text-muted-foreground">
        Watermarking a stream per viewer, so a leaked recording can be traced
        back to the account that played it, is not built. It needs the video
        re-encoded per session, which the playout box does not do and the
        droplet has no headroom for.
      </p>
    </div>
  );
}
