"use client";

import * as React from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { MediaImage } from "@/components/ui/media-image";
import { Price } from "@/components/ui/price";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/shop/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-card/60 hover:bg-card"
    >
      <div className="relative aspect-square bg-muted">
        {/* `/placeholder.svg` is the stock v0 asset: a #EAEAEA rectangle. A product
            with no photo painted a near-white block into a dark page. MediaImage
            falls back to the brand-family tile the rest of the app already uses. */}
        <MediaImage
          src={product.images[0]}
          alt={product.name}
          seed={product.id}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <Badge className="absolute left-2 top-2 bg-background/70 text-foreground/80 capitalize">
          {product.category}
        </Badge>
        {product.featured ? (
          <Badge className="absolute right-2 top-2 bg-amber-500/25 text-amber-300">
            Featured
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm font-semibold text-foreground">
          {product.name}
        </p>
        <div className="mt-auto pt-2 text-base font-bold text-sky-400">
          <Price ngn={product.priceNgn} />
        </div>
      </div>
    </Link>
  );
}
