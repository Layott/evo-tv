"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { Loader2, ShoppingCart, ArrowLeft, Check } from "@/components/icons";
import { toast } from "sonner";

import {
  getProductById,
  getProductBySlug,
  listProducts,
} from "@/lib/client";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/shop/product-card";
import { VariantPicker } from "@/components/shop/variant-picker";
import { QtyStepper } from "@/components/shop/qty-stepper";
import { addToCart } from "@/components/shop/cart-store";
import { formatNgn } from "@/components/profile/ngn";
import { cn } from "@/lib/utils";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [product, setProduct] = React.useState<Product | null>(null);
  const [related, setRelated] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [missing, setMissing] = React.useState(false);
  const [variantId, setVariantId] = React.useState<string | null>(null);
  const [qty, setQty] = React.useState(1);
  const [activeImage, setActiveImage] = React.useState(0);

  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      let p = await getProductById(id);
      if (!p) p = await getProductBySlug(id);
      if (cancelled) return;
      if (!p) {
        setMissing(true);
        setLoading(false);
        return;
      }
      setProduct(p);
      const defaultVariant = p.variants.find((v) => v.inventory > 0);
      setVariantId(defaultVariant?.id ?? null);
      const all = await listProducts();
      if (cancelled) return;
      setRelated(
        all
          .filter((r) => r.category === p!.category && r.id !== p!.id)
          .slice(0, 6)
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (missing) notFound();

  if (loading || !product) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeVariant = variantId ? product.variants.find((v) => v.id === variantId) : null;
  const price = activeVariant?.priceNgn ?? product.priceNgn;
  const hasVariants = product.variants.length > 0;
  const inStock = hasVariants ? (activeVariant?.inventory ?? 0) > 0 : product.inventory > 0;

  function handleAdd() {
    if (hasVariants && !variantId) {
      toast.error("Pick a size first");
      return;
    }
    addToCart({ productId: product!.id, variantId, qty });
    toast.success(`Added ${qty} × ${product!.name} to cart`, {
      action: { label: "View cart", onClick: () => (window.location.href = "/cart") },
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <Link
        href="/shop"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to shop
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-card">
            <Image
              src={product.images[activeImage] ?? product.images[0] ?? "/placeholder.svg"}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          </div>
          {product.images.length > 1 ? (
            <div className="mt-3 flex gap-2">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={cn( "relative aspect-square w-20 overflow-hidden rounded-lg border",
                    i === activeImage
                      ? "border-sky-500/60"
                      : "border-border hover:bg-card"
                  )}
                >
                  <Image src={img} alt="" fill className="object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <Badge className="bg-card capitalize text-foreground/80">
            {product.category}
          </Badge>
          <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
            {product.name}
          </h1>
          <div className="mt-3 text-3xl font-bold text-sky-400">
            {formatNgn(price)}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-foreground/80">
            {product.description}
          </p>
          <div className="mt-6 space-y-4">
            {hasVariants ? (
              <VariantPicker
                variants={product.variants}
                value={variantId}
                onChange={setVariantId}
              />
            ) : null}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Quantity
              </p>
              <QtyStepper value={qty} onChange={setQty} max={inStock ? 10 : 0} />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                onClick={handleAdd}
                disabled={!inStock}
                className="flex-1 bg-sky-500 text-black hover:bg-sky-500/90"
              >
                <ShoppingCart className="size-4" />
                {inStock ? "Add to cart" : "Out of stock"}
              </Button>
              <Button asChild variant="outline" className="border-border">
                <Link href="/cart">View cart</Link>
              </Button>
            </div>
            <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-1">
                <Check className="size-3 text-sky-400" /> Ships NG-wide &middot; 3-5 business days
              </li>
              <li className="flex items-center gap-1">
                <Check className="size-3 text-sky-400" /> Paystack secured checkout
              </li>
              <li className="flex items-center gap-1">
                <Check className="size-3 text-sky-400" /> 14-day returns on apparel
              </li>
            </ul>
          </div>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-12">
          <h2 className="mb-4 text-base font-semibold text-foreground">You might also like</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
