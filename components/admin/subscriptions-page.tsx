"use client";

import * as React from "react";
import { CalendarPlus, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminCancelSubscription,
  adminExtendSubscription,
  adminListSubscriptions,
  type AdminSubscription,
  type SubscriptionStatus,
} from "@/lib/client";
import { hasMinRole } from "@/lib/auth/role-catalog";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { DataTable, type DataColumn } from "./data-table";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";
import { formatDate, formatNgn } from "./utils";

/**
 * Who is past the paywall, and until when.
 *
 * `/api/admin/subscriptions` has been serving this join since the paywall was
 * built and nothing rendered it, so the only way to answer "is this person
 * actually premium" was a psql session. Cancelling and extending were in the
 * API too, equally unreachable.
 *
 * Nothing here moves money. A refund is a Paystack action; this manages the
 * access period, which is the part the product owns.
 */

const STATUSES: SubscriptionStatus[] = ["active", "past_due", "paused", "canceled"];

function statusTone(status: SubscriptionStatus) {
  if (status === "active") return "emerald" as const;
  if (status === "past_due") return "amber" as const;
  if (status === "paused") return "blue" as const;
  return "neutral" as const;
}

export function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  // Finance can see the book; changing an access period is an admin verb on
  // the API, which is what the buttons obey.
  const canEdit = hasMinRole(role, "admin");

  const [status, setStatus] = React.useState<SubscriptionStatus | "all">("all");
  const [search, setSearch] = React.useState("");
  const [extending, setExtending] = React.useState<AdminSubscription | null>(null);
  const [extendDays, setExtendDays] = React.useState("30");
  const [cancelling, setCancelling] = React.useState<AdminSubscription | null>(null);

  const subsQ = useQuery({
    queryKey: ["admin", "subscriptions", { status }],
    queryFn: () =>
      adminListSubscriptions({ status: status === "all" ? undefined : status }),
  });

  const subscriptions = subsQ.data?.subscriptions ?? [];
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subscriptions;
    return subscriptions.filter(
      (s) =>
        s.userEmail.toLowerCase().includes(q) ||
        (s.userHandle ?? "").toLowerCase().includes(q) ||
        (s.userName ?? "").toLowerCase().includes(q),
    );
  }, [subscriptions, search]);

  const refresh = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] }),
    [queryClient],
  );

  const cancel = useMutation({
    mutationFn: (sub: AdminSubscription) => adminCancelSubscription(sub.id),
    onSuccess: async () => {
      toast.success("Subscription cancelled. No refund was issued.");
      setCancelling(null);
      await refresh();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not cancel it"),
  });

  const extend = useMutation({
    mutationFn: ({ sub, days }: { sub: AdminSubscription; days: number }) =>
      adminExtendSubscription(sub.id, days),
    onSuccess: async (_r, v) => {
      toast.success(`Extended by ${v.days} days`);
      setExtending(null);
      await refresh();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not extend it"),
  });

  const columns: DataColumn<AdminSubscription>[] = [
    {
      key: "user",
      header: "Member",
      sortable: true,
      accessor: (row) => row.userEmail,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {row.userName || row.userHandle || row.userEmail}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.userEmail}</p>
        </div>
      ),
    },
    {
      key: "tier",
      header: "Tier",
      sortable: true,
      accessor: (row) => row.tier,
      cell: (row) => <span className="capitalize">{row.tier}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (row) => row.status,
      cell: (row) => (
        <StatusBadge tone={statusTone(row.status)}>
          {row.status.replace("_", " ")}
        </StatusBadge>
      ),
    },
    {
      key: "price",
      header: "Price",
      sortable: true,
      accessor: (row) => row.priceNgn,
      cell: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {formatNgn(row.priceNgn)}
        </span>
      ),
    },
    {
      key: "periodEnd",
      header: "Access until",
      sortable: true,
      accessor: (row) =>
        row.currentPeriodEnd ? new Date(row.currentPeriodEnd).getTime() : 0,
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.currentPeriodEnd ? formatDate(row.currentPeriodEnd) : "no end date"}
        </span>
      ),
    },
    {
      key: "provider",
      header: "Via",
      cell: (row) => (
        <span className="text-xs capitalize text-muted-foreground">{row.provider}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) =>
        !canEdit ? null : (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setExtendDays("30");
                setExtending(row);
              }}
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Extend
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={row.status === "canceled"}
              onClick={() => setCancelling(row)}
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Who is past the paywall and until when. Refunds happen in Paystack; this controls access periods."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, name or handle"
            className="pl-9"
          />
        </div>

        <Select
          value={status}
          onValueChange={(v) => setStatus(v as SubscriptionStatus | "all")}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {subsQ.data?.total ?? 0}
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(row) => row.id}
        loading={subsQ.isLoading}
        emptyMessage={
          subsQ.isError
            ? "Could not load subscriptions."
            : "Nobody has subscribed yet. Comped access is granted as the Premium role under Users."
        }
      />

      <Dialog open={extending !== null} onOpenChange={(o) => !o && setExtending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Extend access</DialogTitle>
            <DialogDescription>
              {extending
                ? `Pushes ${extending.userEmail}'s access period out. Nothing is charged.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="extend-days">Days</Label>
            <Input
              id="extend-days"
              inputMode="numeric"
              value={extendDays}
              onChange={(e) => setExtendDays(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Between 1 and 365.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setExtending(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!Number(extendDays) || extend.isPending}
              onClick={() =>
                extending &&
                extend.mutate({ sub: extending, days: Number(extendDays) })
              }
            >
              Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelling !== null} onOpenChange={(o) => !o && setCancelling(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this subscription?</DialogTitle>
            <DialogDescription>
              {cancelling
                ? `${cancelling.userEmail} loses premium access, and the account drops back to a normal user unless another subscription keeps it. No money moves: refund in Paystack if one is owed.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCancelling(null)}>
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancel.isPending}
              onClick={() => cancelling && cancel.mutate(cancelling)}
            >
              Cancel subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
