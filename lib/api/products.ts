import "server-only";
import { and, eq, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Product } from "@/lib/types";

function toProduct(r: typeof schema.products.$inferSelect): Product {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    category: r.category as Product["category"],
    priceNgn: r.priceNgn,
    images: r.images,
    variants: r.variants,
    featured: r.featured,
    active: r.active,
    teamId: r.teamId,
    inventory: r.inventory,
  };
}

export interface ListProductsFilter {
  featured?: boolean;
  category?: Product["category"];
  teamId?: string;
}

export async function listProducts(
  filter: ListProductsFilter = {}
): Promise<Product[]> {
  const conditions: SQL[] = [eq(schema.products.active, true)];
  if (filter.featured !== undefined) {
    conditions.push(eq(schema.products.featured, filter.featured));
  }
  if (filter.category) {
    conditions.push(eq(schema.products.category, filter.category));
  }
  if (filter.teamId) {
    conditions.push(eq(schema.products.teamId, filter.teamId));
  }
  return (
    await db
      .select()
      .from(schema.products)
      .where(and(...conditions))
  ).map(toProduct);
}

export async function getProductById(id: string): Promise<Product | null> {
  const r = (
    await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1)
  )[0];
  return r ? toProduct(r) : null;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const r = (
    await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.slug, slug))
      .limit(1)
  )[0];
  return r ? toProduct(r) : null;
}
