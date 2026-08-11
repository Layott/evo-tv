"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Package } from "lucide-react";

import { useAuth } from "@/components/providers";
import { listOrdersForUser } from "@/lib/client";
import type { Order, OrderStatus } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ORDERS_KEY } from "@/components/shop/cart-store";
import { formatNgn } from "@/components/profile/ngn";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: "border-neutral-700 bg-neutral-800 text-neutral-300",
  paid: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  processing: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  shipped: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  delivered: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  cancelled: "border-red-500/40 bg-red-500/15 text-red-400",
  refunded: "border-neutral-700 bg-neutral-800 text-neutral-300",
};

function readLocalOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ORDERS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as Order[]) : [];
  } catch {
    return [];
  }
}

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    (async () => {
      const remote = await listOrdersForUser(user.id);
      const local = readLocalOrders().filter((o) => o.userId === user.id || !o.userId);
      const map = new Map<string, Order>();
      for (const o of [...local, ...remote]) map.set(o.id, o);
      const combined = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setOrders(combined);
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <Link
        href="/profile"
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200"
      >
        <ArrowLeft className="size-4" /> Profile
      </Link>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-50">Your orders</h1>
          <p className="text-sm text-neutral-400">
            {orders.length} total
          </p>
        </div>
        <Button asChild variant="outline" className="border-neutral-800">
          <Link href="/shop">Keep shopping</Link>
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 p-10 text-center">
          <Package className="mx-auto size-10 text-neutral-600" />
          <p className="mt-3 text-sm font-semibold text-neutral-200">No orders yet.</p>
          <Button
            asChild
            className="mt-4 bg-sky-500 text-black hover:bg-sky-500/90"
          >
            <Link href="/shop">Browse shop</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const count = o.items.reduce((sum, it) => sum + it.qty, 0);
                return (
                  <TableRow key={o.id} className="hover:bg-neutral-900">
                    <TableCell className="font-mono text-xs text-neutral-300">
                      #{o.id.slice(-8).toUpperCase()}
                    </TableCell>
                    <TableCell>{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{count}</TableCell>
                    <TableCell className="font-semibold">{formatNgn(o.totalNgn)}</TableCell>
                    <TableCell>
                      <Badge
                        className={cn("text-[11px] font-semibold", STATUS_TONE[o.status])}
                      >
                        {STATUS_LABEL[o.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline" className="border-neutral-800">
                        <Link href={`/profile/orders/${o.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
