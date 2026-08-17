"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatNgn } from "@/components/profile/ngn";
import { Badge } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";

export function ProductCard({ product }: { product: Product }) {
  const image = product.images[0] ?? "/placeholder.svg";
  return (
    <Link
      href={`/shop/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card/60 transition hover:border-sky-500/40"
    >
      <div className="relative aspect-square bg-muted">
        <Image
          src={image}
          alt={product.name}
          fill
          className="object-cover transition group-hover:scale-[1.02]"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        <Badge className="absolute left-2 top-2 bg-background/70 text-foreground/80 capitalize">
          {product.category}
        </Badge>
        {product.featured ? (
          <Badge className="absolute right-2 top-2 border-amber-500/40 bg-amber-500/20 text-amber-300">
            Featured
          </Badge>
        ) : null}
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-black/80 to-transparent p-2 text-xs font-semibold uppercase tracking-wider text-white opacity-0 transition group-hover:opacity-100">
          View
        </span>
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
