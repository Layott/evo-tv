"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, ShoppingCart } from "lucide-react";

import { listProducts } from "@/lib/client";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/shop/product-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const CATEGORIES: { v: Product["category"] | "all"; label: string }[] = [
  { v: "all", label: "All" },
  { v: "jersey", label: "Jerseys" },
  { v: "apparel", label: "Apparel" },
  { v: "accessory", label: "Accessories" },
  { v: "collectible", label: "Collectibles" },
  { v: "digital", label: "Digital" },
];

type Sort = "featured" | "price-asc" | "price-desc" | "name";

export default function ShopPage() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [cat, setCat] = React.useState<Product["category"] | "all">("all");
  const [sort, setSort] = React.useState<Sort>("featured");

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const list = await listProducts();
      setProducts(list);
      setLoading(false);
    })();
  }, []);

  const filtered = React.useMemo(() => {
    let list = products;
    if (cat !== "all") list = list.filter((p) => p.category === cat);
    list = [...list];
    switch (sort) {
      case "price-asc":
        list.sort((a, b) => a.priceNgn - b.priceNgn);
        break;
      case "price-desc":
        list.sort((a, b) => b.priceNgn - a.priceNgn);
        break;
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        list.sort((a, b) => Number(b.featured) - Number(a.featured));
    }
    return list;
  }, [products, cat, sort]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-50">Shop</h1>
          <p className="text-sm text-neutral-400">
            Official merch, collectibles & digital goods. Pay in Naira.
          </p>
        </div>
        <Button asChild variant="outline" className="border-neutral-800">
          <Link href="/cart">
            <ShoppingCart className="size-4" />
            Cart
          </Link>
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.v}
              onClick={() => setCat(c.v)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                c.v === cat
                  ? "border-sky-500/60 bg-sky-500/15 text-sky-200"
                  : "border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:border-neutral-600"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Select value={sort} onValueChange={(v: Sort) => setSort(v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="featured">Sort: Featured</SelectItem>
            <SelectItem value="price-asc">Price: Low to high</SelectItem>
            <SelectItem value="price-desc">Price: High to low</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-neutral-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 p-12 text-center text-neutral-400">
          No products match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
