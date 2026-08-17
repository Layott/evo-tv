"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Loader2,
  Package,
  Printer,
  ShoppingBag,
  Truck,
} from "@/components/icons";

import { getOrderById } from "@/lib/client";
import type { Order, OrderStatus } from "@/lib/types";
import { ORDERS_KEY } from "@/components/shop/cart-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  pending: "bg-muted text-foreground/80",
  paid: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  processing: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  shipped: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  delivered: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  cancelled: "border-red-500/40 bg-red-500/15 text-red-400",
  refunded: "bg-muted text-foreground/80",
};

function readLocalOrder(id: string): Order | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ORDERS_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    return (arr as Order[]).find((o) => o.id === id) ?? null;
  } catch {
    return null;
  }
}

export function OrderView({ id }: { id: string }) {
  const [order, setOrder] = React.useState<Order | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [missing, setMissing] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const local = readLocalOrder(id);
      if (local) {
        if (!cancelled) {
          setOrder(local);
          setLoading(false);
        }
        return;
      }
      const remote = await getOrderById(id);
      if (cancelled) return;
      if (!remote) {
        setMissing(true);
      } else {
        setOrder(remote);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (missing) notFound();
  if (loading || !order) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const base = new Date(order.createdAt).getTime();
  const steps: { key: OrderStatus; label: string; icon: React.ElementType; at: string }[] = [
    { key: "paid", label: "Paid", icon: Check, at: new Date(base).toLocaleString() },
    {
      key: "processing",
      label: "Processing",
      icon: Package,
      at: new Date(base + 3600_000).toLocaleString(),
    },
    {
      key: "shipped",
      label: "Shipped",
      icon: Truck,
      at: new Date(base + 86_400_000).toLocaleString(),
    },
    {
      key: "delivered",
      label: "Delivered",
      icon: Check,
      at: new Date(base + 3 * 86_400_000).toLocaleString(),
    },
  ];
  const orderIndex = steps.findIndex((s) => s.key === order.status);
  const activeIdx = orderIndex >= 0 ? orderIndex : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <Link
        href="/profile/orders"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Orders
      </Link>

      <div className="rounded-2xl border border-border bg-card/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Order</p>
            <h1 className="font-mono text-lg font-bold text-foreground">
              #{order.id.slice(-8).toUpperCase()}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Placed {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
          <Badge className={cn("px-3 py-1 text-xs font-semibold", STATUS_TONE[order.status])}>
            {STATUS_LABEL[order.status]}
          </Badge>
        </div>

        <ol className="mt-6 grid gap-3 sm:grid-cols-4">
          {steps.map((s, i) => {
            const active = i <= activeIdx;
            const Icon = s.icon;
            return (
              <li
                key={s.key}
                className={cn( "rounded-xl border p-3",
                  active
                    ? "border-sky-500/40 bg-sky-500/5"
                    : "border-border bg-card/30"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn( "flex size-7 items-center justify-center rounded-full",
                      active ? "bg-sky-500 text-ink" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">{s.label}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {active ? s.at : "Pending"}
                </p>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <h2 className="mb-4 text-base font-semibold text-foreground">Items</h2>
          <ul className="divide-y divide-border">
            {order.items.map((item, i) => (
              <li key={`${item.productId}-${i}`} className="flex items-center gap-3 py-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <Image
                    src={item.thumbnailUrl}
                    alt={item.productName}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.variantLabel ? `${item.variantLabel} · ` : ""}Qty {item.qty}
                  </p>
                </div>
                <div className="text-sm font-semibold">{formatNgn(item.unitPriceNgn * item.qty)}</div>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatNgn(order.subtotalNgn)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd>{order.shippingNgn === 0 ? "Free" : formatNgn(order.shippingNgn)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatNgn(order.totalNgn)}</dd>
            </div>
          </dl>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <h2 className="mb-3 text-base font-semibold text-foreground">Shipping to</h2>
            {order.shipping.address1 ? (
              <div className="space-y-0.5 text-sm text-foreground/80">
                <p className="font-semibold">{order.shipping.fullName}</p>
                <p>{order.shipping.address1}</p>
                {order.shipping.address2 ? <p>{order.shipping.address2}</p> : null}
                <p>
                  {order.shipping.city}, {order.shipping.state}
                </p>
                <p>{order.shipping.country}</p>
                {order.shipping.phone ? (
                  <p className="mt-2 text-xs text-muted-foreground">{order.shipping.phone}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Digital order - no shipping.</p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <h2 className="mb-3 text-base font-semibold text-foreground">Payment</h2>
            <p className="text-sm text-foreground/80">
              <span className="text-[#00C3F7]">Paystack</span> · {order.paymentRef}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <h2 className="mb-3 text-base font-semibold text-foreground">Tracking</h2>
            <p className="font-mono text-sm text-foreground/80">
              {order.trackingNumber ?? "Available once shipped"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="flex-1 border-border"
              onClick={() => window.print()}
            >
              <Printer className="size-4" /> Receipt
            </Button>
            <Button
              asChild
              className="flex-1 bg-sky-500 text-ink hover:bg-sky-500/90"
            >
              <Link href="/shop">
                <ShoppingBag className="size-4" /> Continue
              </Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function OrderRoutePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  if (!id) return notFound();
  return <OrderView id={id} />;
}
