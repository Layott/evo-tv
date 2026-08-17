"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingBag, Trash2, Tag } from "@/components/icons";
import { toast } from "sonner";
import { BackButton } from "@/components/shell/back-button";

import { getProductById } from "@/lib/client";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QtyStepper } from "@/components/shop/qty-stepper";
import { MediaImage } from "@/components/ui/media-image";
import {
  CartLine,
  getCart,
  updateQty,
  removeLine,
} from "@/components/shop/cart-store";
import { PaystackButton, PaystackMark } from "@/components/shop/paystack-button";
import { formatNgn } from "@/components/profile/ngn";

interface ResolvedLine extends CartLine {
  product: Product;
  unit: number;
  subtotal: number;
  variantLabel: string | null;
}

const SHIPPING = 2500;
const FREE_SHIPPING_MIN = 50_000;

export default function CartPage() {
  const router = useRouter();
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [products, setProducts] = React.useState<Record<string, Product>>({});
  const [loading, setLoading] = React.useState(true);
  const [promo, setPromo] = React.useState("");
  const [discount, setDiscount] = React.useState(0);

  const refresh = React.useCallback(() => setLines(getCart()), []);

  React.useEffect(() => {
    refresh();
    function onChange() {
      refresh();
    }
    window.addEventListener("evotv-cart-change", onChange);
    return () => window.removeEventListener("evotv-cart-change", onChange);
  }, [refresh]);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const entries = await Promise.all(
        lines.map(async (l) => {
          const p = await getProductById(l.productId);
          return p ? ([l.productId, p] as const) : null;
        })
      );
      const map: Record<string, Product> = {};
      for (const e of entries) if (e) map[e[0]] = e[1];
      setProducts(map);
      setLoading(false);
    })();
  }, [lines]);

  const resolved: ResolvedLine[] = lines
    .map((l) => {
      const p = products[l.productId];
      if (!p) return null;
      const variant = l.variantId
        ? p.variants.find((v) => v.id === l.variantId)
        : null;
      const unit = variant?.priceNgn ?? p.priceNgn;
      return {
        ...l,
        product: p,
        unit,
        subtotal: unit * l.qty,
        variantLabel: variant?.label ?? null,
      };
    })
    .filter((r): r is ResolvedLine => r !== null);

  const subtotal = resolved.reduce((sum, r) => sum + r.subtotal, 0);
  const shipping = subtotal === 0 ? 0 : subtotal >= FREE_SHIPPING_MIN ? 0 : SHIPPING;
  const promoAmount = Math.round(subtotal * discount);
  const total = Math.max(0, subtotal - promoAmount + shipping);

  function applyPromo() {
    if (promo.trim().toUpperCase() === "EVO10") {
      setDiscount(0.1);
      toast.success("Promo EVO10 applied - 10% off");
    } else {
      setDiscount(0);
      toast.error("Invalid promo code");
    }
  }

  if (loading && lines.length > 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (resolved.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <ShoppingBag className="mx-auto size-12 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-bold text-foreground">Your cart is empty</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find jerseys, apparel, and digital gifts in the shop.
        </p>
        <Button
          asChild
          className="mt-5 bg-sky-500 text-ink hover:bg-sky-600"
        >
          <Link href="/shop">Browse shop</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-4">
        <BackButton fallbackHref="/shop" />
      </div>
      <h1 className="mb-4 text-xl font-bold text-foreground">Your cart</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
          {resolved.map((line, i) => (
            <div
              key={`${line.productId}-${line.variantId ?? ""}`}
              className={`flex flex-wrap items-start gap-4 p-4 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                <MediaImage
                  src={line.product.images[0]}
                  alt={line.product.name}
                  seed={line.product.id}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/shop/${line.product.id}`}
                  className="line-clamp-2 text-sm font-semibold text-foreground hover:text-sky-300"
                >
                  {line.product.name}
                </Link>
                {line.variantLabel ? (
                  <p className="text-xs text-muted-foreground">Size: {line.variantLabel}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatNgn(line.unit)} each
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <QtyStepper
                  value={line.qty}
                  onChange={(n) => updateQty(line.productId, line.variantId, n)}
                />
                <div className="min-w-[88px] text-right text-sm font-semibold text-foreground">
                  {formatNgn(line.subtotal)}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    removeLine(line.productId, line.variantId);
                    toast.success("Removed from cart");
                  }}
                  aria-label="Remove"
                >
                  <Trash2 className="size-4 text-red-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <h2 className="text-base font-semibold text-foreground">Order summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatNgn(subtotal)}</dd>
              </div>
              {promoAmount > 0 ? (
                <div className="flex justify-between text-sky-400">
                  <dt>Promo EVO10</dt>
                  <dd>-{formatNgn(promoAmount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>
                  {shipping === 0 && subtotal >= FREE_SHIPPING_MIN ? (
                    <span className="text-sky-400">Free</span>
                  ) : (
                    formatNgn(shipping)
                  )}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-bold">
                <dt>Total</dt>
                <dd>{formatNgn(total)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex gap-2">
              <div className="relative flex-1">
                <Tag className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Promo code"
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" className="border-border" onClick={applyPromo}>
                Apply
              </Button>
            </div>
            <PaystackButton
              className="mt-5"
              onClick={() => router.push("/checkout")}
            >
              Checkout with Paystack
            </PaystackButton>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Payments secured by <PaystackMark className="align-middle" />
            </p>
          </div>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/shop">← Continue shopping</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
