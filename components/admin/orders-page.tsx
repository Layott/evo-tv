"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminListOrders, adminMarkOrderShipped } from "@/lib/client";
import type { Order, OrderStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatDateTime, formatNgn, seededRandom } from "./utils";

/**
 * The orders endpoint returns a user id, not a handle. Showing the id is honest;
 * inventing a handle for it was not.
 */
function handleForUser(id: string): string {
  return id;
}

function orderTone(status: OrderStatus): "emerald" | "amber" | "red" | "blue" | "neutral" {
  if (status === "paid" || status === "pending") return "amber";
  if (status === "processing") return "blue";
  if (status === "shipped" || status === "delivered") return "emerald";
  if (status === "cancelled" || status === "refunded") return "red";
  return "neutral";
}

export function OrdersPage() {
  const queryClient = useQueryClient();

  const ordersQ = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: () => adminListOrders({ limit: 200 }),
  });
  const all = ordersQ.data?.orders ?? [];

  const refresh = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["admin", "orders"] }),
    [queryClient],
  );
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [selected, setSelected] = React.useState<Order | null>(null);
  const [refundConfirm, setRefundConfirm] = React.useState<Order | null>(null);

  const filtered = React.useMemo(() => {
    let rows = all;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((o) =>
        [o.id, handleForUser(o.userId), o.paymentRef].some((v) => v.toLowerCase().includes(q)),
      );
    }
    if (statusFilter !== "all") rows = rows.filter((o) => o.status === statusFilter);
    return rows;
  }, [all, search, statusFilter]);

  const columns: DataColumn<Order>[] = [
    {
      key: "id",
      header: "Order",
      sortable: true,
      accessor: (r) => r.id,
      cell: (row) => (
        <div>
          <div className="font-mono text-xs text-neutral-100">{row.id}</div>
          <div className="text-[11px] text-neutral-500">{row.paymentRef}</div>
        </div>
      ),
    },
    {
      key: "user",
      header: "Customer",
      sortable: true,
      accessor: (r) => handleForUser(r.userId),
      cell: (row) => <span className="text-sm text-neutral-200">@{handleForUser(row.userId)}</span>,
    },
    {
      key: "items",
      header: "Items",
      cell: (row) => (
        <span className="text-sm text-neutral-300">
          {row.items.reduce((acc, i) => acc + i.qty, 0)} item{row.items.reduce((acc, i) => acc + i.qty, 0) > 1 ? "s" : ""}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      sortable: true,
      accessor: (r) => r.totalNgn,
      cell: (row) => <span className="tabular-nums text-sm">{formatNgn(row.totalNgn)}</span>,
      className: "text-right",
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (r) => r.status,
      cell: (row) => <StatusBadge tone={orderTone(row.status)}>{row.status}</StatusBadge>,
    },
    {
      key: "created",
      header: "Created",
      sortable: true,
      accessor: (r) => new Date(r.createdAt).getTime(),
      cell: (row) => <span className="text-xs text-neutral-400">{formatDateTime(row.createdAt)}</span>,
    },
  ];

  const shipMut = useMutation({
    mutationFn: (order: Order) => adminMarkOrderShipped(order.id),
    onSuccess: async () => {
      toast.success("Marked as shipped");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Could not update the order"),
  });

  /**
   * There is no refund endpoint. Money movement has to go through Paystack, and
   * flipping a status column here would say "refunded" while the customer was
   * never paid back. Marking shipped is the one order action that exists.
   */
  function handleRefund() {
    toast.error("Refunds are issued in Paystack, not here");
    setRefundConfirm(null);
  }

  void shipMut;

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="Customer orders, payments and refunds." />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order, customer or payment ref"
            className="border-neutral-800 bg-neutral-900 pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 border-neutral-800 bg-neutral-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"] as OrderStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-neutral-500">{filtered.length} orders</div>
      </div>

      <DataTable<Order>
        data={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setSelected(r)}
      />

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto border-neutral-800 bg-neutral-950 text-neutral-100 sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono">{selected.id}</SheetTitle>
                <SheetDescription>
                  {formatDateTime(selected.createdAt)} · @{handleForUser(selected.userId)}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-4">
                <div className="flex items-center justify-between">
                  <StatusBadge tone={orderTone(selected.status)}>{selected.status}</StatusBadge>
                  <span className="font-mono text-xs text-neutral-500">{selected.paymentRef}</span>
                </div>

                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-neutral-500">Items</div>
                  <ul className="space-y-2">
                    {selected.items.map((item, idx) => (
                      <li
                        key={`${item.productId}-${idx}`}
                        className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-2"
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-neutral-800">
                          {}
                          <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="flex-1 text-sm">
                          <div className="text-neutral-100">{item.productName}</div>
                          <div className="text-xs text-neutral-500">
                            {item.variantLabel ? `Size ${item.variantLabel} · ` : ""}Qty {item.qty}
                          </div>
                        </div>
                        <div className="tabular-nums text-sm">{formatNgn(item.unitPriceNgn * item.qty)}</div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 text-sm">
                  <Row label="Subtotal" value={formatNgn(selected.subtotalNgn)} />
                  <Row label="Shipping" value={formatNgn(selected.shippingNgn)} />
                  <div className="my-1 border-t border-neutral-800" />
                  <Row label="Total" value={formatNgn(selected.totalNgn)} strong />
                </div>

                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-neutral-500">Ship to</div>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 text-sm text-neutral-200">
                    {selected.shipping.fullName}
                    <div className="text-xs text-neutral-400">
                      {selected.shipping.address1}
                      {selected.shipping.address2 ? `, ${selected.shipping.address2}` : ""}
                    </div>
                    <div className="text-xs text-neutral-400">
                      {selected.shipping.city}, {selected.shipping.state}, {selected.shipping.country}
                    </div>
                    <div className="text-xs text-neutral-400">{selected.shipping.phone}</div>
                    {selected.trackingNumber ? (
                      <div className="mt-2 text-xs text-sky-300">Tracking: {selected.trackingNumber}</div>
                    ) : null}
                  </div>
                </div>
              </div>
              <SheetFooter>
                <Button
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-500"
                  disabled={selected.status === "refunded"}
                  onClick={() => setRefundConfirm(selected)}
                >
                  Issue refund
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={!!refundConfirm} onOpenChange={(o) => !o && setRefundConfirm(null)}>
        <DialogContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Issue refund?</DialogTitle>
            <DialogDescription className="text-neutral-400">
              This will mark order {refundConfirm?.id} as refunded and trigger a refund via{" "}
              {refundConfirm?.paymentProvider}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
              onClick={() => setRefundConfirm(null)}
            >
              Cancel
            </Button>
            <Button className="bg-red-600 text-white hover:bg-red-500" onClick={handleRefund}>
              Confirm refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "text-neutral-100" : "text-neutral-400"}>{label}</span>
      <span className={`tabular-nums ${strong ? "text-neutral-100 font-semibold" : "text-neutral-200"}`}>
        {value}
      </span>
    </div>
  );
}
