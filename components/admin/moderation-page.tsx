"use client";

import * as React from "react";
import { AlertTriangle, Check, MessageSquare, ShieldBan, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import {
  adminLiftSanction,
  adminListReports,
  adminListSanctions,
  adminResolveReport,
} from "@/lib/client";
import type { ChatMessage, Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";
import { formatDate, timeAgo } from "./utils";
import { UserAvatar } from "@/components/ui/user-avatar";

interface Report {
  id: string;
  message: ChatMessage;
  reason: "spam" | "harassment" | "off-topic";
  reportedBy: string;
  reportedAt: string;
  state: "open" | "approved" | "removed" | "escalated";
}

interface BannedUser {
  id: string;
  profile: Profile;
  reason: string;
  durationDays: number;
  bannedAt: string;
}

interface Appeal {
  id: string;
  profile: Profile;
  banReason: string;
  message: string;
  submittedAt: string;
}

/**
 * The queue used to be fabricated end to end: reports against seeded chat
 * messages on `stream_lagos_final` (a stream that no longer exists), bans with
 * invented reasons including "Hate speech" and "Self-harm content", and appeal
 * text written as if by real users. A moderator could have acted on any of it.
 * It reads the real tables now.
 */

export function ModerationPage() {
  const queryClient = useQueryClient();

  const reportsQ = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: () => adminListReports(),
  });
  const sanctionsQ = useQuery({
    queryKey: ["admin", "sanctions"],
    queryFn: () => adminListSanctions(),
  });

  const reports = (reportsQ.data ?? []) as unknown as Report[];
  const banned = (sanctionsQ.data ?? []) as unknown as BannedUser[];

  // Appeals have no table and no endpoint. An empty queue is the truth.
  const appeals: Appeal[] = [];

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "sanctions"] });
  };

  async function reportAction(
    id: string,
    action: "approve" | "remove" | "ban" | "escalate",
  ) {
    try {
      await adminResolveReport(id, action);
      toast.success(
        action === "approve"
          ? "Message approved"
          : action === "remove"
            ? "Message removed"
            : action === "escalate"
              ? "Escalated"
              : "User banned",
      );
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resolve the report");
    }
  }

  /**
   * Lifting a sanction needs both the user and the sanction id, which this list
   * carries, so it goes straight to the endpoint.
   */
  async function unban(id: string) {
    const row = (sanctionsQ.data ?? []).find((x) => x.id === id);
    if (!row) return;
    try {
      await adminLiftSanction(row.userId, row.id);
      toast.success("Sanction lifted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not lift the sanction");
    }
  }

  /** Appeals have no backend, so there is nothing to resolve. */
  function resolveAppeal(_id: string, _outcome: "accept" | "reject") {
    toast.error("Appeals are not implemented yet");
  }

  const openReports = reports.filter((r) => r.state === "open");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moderation"
        description="Review reported messages, active bans and user appeals."
      />

      <Tabs defaultValue="reports">
        <TabsList className="bg-card">
          <TabsTrigger value="reports">
            Reports
            <span className="ml-2 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">
              {openReports.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="banned">Banned users</TabsTrigger>
          <TabsTrigger value="appeals">
            Appeals
            <span className="ml-2 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
              {appeals.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="mt-4">
          <div className="space-y-3">
            {reports.map((r) => {
              const reasonTone = r.reason === "harassment" ? "red" : r.reason === "spam" ? "amber" : "blue";
              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-border bg-card/40 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={reasonTone as "red" | "amber" | "blue"}>{r.reason}</StatusBadge>
                    <div className="text-xs text-muted-foreground">
                      Reported by @{r.reportedBy} · {timeAgo(r.reportedAt)}
                    </div>
                    {r.state !== "open" ? (
                      <StatusBadge tone="neutral" className="ml-auto">
                        {r.state}
                      </StatusBadge>
                    ) : (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {/* Was a hardcoded "stream_lagos_final", a stream that
                            has not existed for months, printed next to every
                            report that had no state. */}
                        {r.message?.streamId ?? "-"}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-start gap-3">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                      {}
                      <img src={r.message.userAvatarUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">
                        @{r.message.userHandle} · {timeAgo(r.message.createdAt)}
                      </div>
                      <div className="mt-1 rounded-md border border-border bg-background p-2 text-sm text-foreground">
                        <MessageSquare className="mr-1 inline h-3 w-3 text-muted-foreground" />
                        {r.message.body}
                      </div>
                    </div>
                  </div>
                  {r.state === "open" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
                        onClick={() => reportAction(r.id, "approve")}
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                        onClick={() => reportAction(r.id, "remove")}
                      >
                        Delete message
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                        onClick={() => reportAction(r.id, "ban")}
                      >
                        <ShieldBan className="h-3.5 w-3.5" /> Ban user
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                        onClick={() => reportAction(r.id, "escalate")}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" /> Escalate
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="banned" className="mt-4">
          <div className="space-y-3">
            {banned.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-4"
              >
                <UserAvatar
                  src={b.profile.avatarUrl}
                  name={b.profile.displayName}
                  handle={b.profile.handle}
                  seed={b.profile.id}
                  decorative
                  className="h-10 w-10 shrink-0"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">
                    {b.profile.displayName}{" "}
                    <span className="text-xs font-normal text-muted-foreground">@{b.profile.handle}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Reason: {b.reason} · {b.durationDays} days · Since {formatDate(b.bannedAt)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
                  onClick={() => unban(b.id)}
                >
                  <Undo2 className="h-3.5 w-3.5" /> Unban
                </Button>
              </div>
            ))}
            {banned.length === 0 ? (
              <div className="rounded-xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
                No active bans.
              </div>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="appeals" className="mt-4">
          <div className="space-y-3">
            {appeals.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-border bg-card/40 p-4"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar
                    src={a.profile.avatarUrl}
                    name={a.profile.displayName}
                    handle={a.profile.handle}
                    seed={a.profile.id}
                    decorative
                    className="h-10 w-10 shrink-0"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">
                      {a.profile.displayName}{" "}
                      <span className="text-xs font-normal text-muted-foreground">@{a.profile.handle}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Original reason: {a.banReason} · submitted {timeAgo(a.submittedAt)}
                    </div>
                  </div>
                </div>
                <blockquote className="mt-3 rounded-md border border-border bg-background p-3 text-sm text-foreground/80">
                  “{a.message}”
                </blockquote>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="bg-sky-600 text-white hover:bg-sky-500"
                    onClick={() => resolveAppeal(a.id, "accept")}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                    onClick={() => resolveAppeal(a.id, "reject")}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
            {appeals.length === 0 ? (
              <div className="rounded-xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
                No outstanding appeals.
              </div>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
