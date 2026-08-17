"use client";

import * as React from "react";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { listProducts } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag } from "@/components/icons";
import { toast } from "sonner";
import { useAuth } from "@/components/providers";
import { addToCart } from "@/components/shop/cart-store";

function ngn(n: number) {
  return `₦${n.toLocaleString()}`;
}

export function InStreamShop() {
  const { role } = useAuth();
  const [products, setProducts] = React.useState<Product[] | null>(null);
  const isPremium = role === "premium";

  React.useEffect(() => {
    let cancelled = false;
    listProducts({ featured: true }).then((items) => {
      if (!cancelled) setProducts(items.slice(0, 6));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!products) {
    return (
      <div className="p-3 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 rounded bg-muted " />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No products featured right now.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <ShoppingBag className="size-4 text-foreground/80" />
        <span className="text-sm font-semibold text-foreground">Featured Shop</span>
        {isPremium && (
          <Badge className="ml-auto bg-amber-500/20 text-amber-300 text-[10px]">
            Premium 10% off
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 p-3 overflow-y-auto">
        {products.map((p) => {
          const discounted = Math.round(p.priceNgn * 0.9);
          return (
            <div
              key={p.id}
              className="rounded-lg border border-border bg-card/60 overflow-hidden flex flex-col"
            >
              <div className="relative aspect-square bg-muted">
                <Image
                  src={p.images[0] || "/placeholder.svg"}
                  alt={p.name}
                  fill
                  className="object-cover"
                  sizes="(max-width:768px) 50vw, 200px"
                />
              </div>
              <div className="p-2 flex-1 flex flex-col gap-1">
                <p className="text-xs font-medium text-foreground line-clamp-2">
                  {p.name}
                </p>
                <div className="mt-auto">
                  {isPremium ? (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] text-muted-foreground line-through">
                        {ngn(p.priceNgn)}
                      </span>
                      <span className="text-sm font-bold text-amber-300">
                        {ngn(discounted)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-foreground">
                      {ngn(p.priceNgn)}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  className="h-7 text-xs mt-1"
                  onClick={() => {
                    addToCart({
                      productId: p.id,
                      variantId: p.variants[0]?.id ?? null,
                      qty: 1,
                    });
                    toast.success(`${p.name} added to cart`);
                  }}
                >
                  Add to cart
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
