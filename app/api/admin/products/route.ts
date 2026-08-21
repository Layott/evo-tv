import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { generateId, requireCapability } from "@/lib/api/admin";
import { writeAudit } from "@/lib/api/audit";
import { slugify } from "@/lib/slug";

/**
 * The shop, from the dashboard.
 *
 * There was no admin write route for products at all. `adminListProducts` in
 * the client read `/api/products`, the public endpoint, so the only thing the
 * dashboard could do with the shop was look at it: every product on the site
 * had to be inserted by hand into Postgres.
 *
 * Orders already had a screen and a mark-shipped route. This is the other half.
 */

/** Reading the catalogue is a support job. Writing it is not. */
export async function GET() {
  const guard = await requireMinRole("support_admin");
  if (!guard.ok) return guard.response;

  const products = await db
    .select()
    .from(schema.products)
    .orderBy(asc(schema.products.name));

  return NextResponse.json({ products, total: products.length });
}

/**
 * A size or a colourway, with its own price and its own stock.
 *
 * The price is per variant because a 3XL jersey costs more than a small one,
 * and stock is per variant because running out of medium is not running out of
 * the shirt.
 */
export const variant = z.object({
  id: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(80),
  priceNgn: z.number().int().min(0).max(100_000_000),
  inventory: z.number().int().min(0).max(1_000_000),
});

export const productBody = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().max(4000).default(""),
  category: z.enum(["jersey", "apparel", "accessory", "digital", "collectible"]),
  priceNgn: z.number().int().min(0).max(100_000_000),
  images: z.array(z.string().trim().min(1).max(2048)).max(10).default([]),
  variants: z.array(variant).max(50).default([]),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
  teamId: z.string().min(1).nullable().default(null),
  // The show this came out of. Null is the common case: most stock is not
  // tied to a programme.
  showId: z.string().min(1).nullable().default(null),
  inventory: z.number().int().min(0).max(1_000_000).default(0),
});

/**
 * POST /api/admin/products - add something to the shop.
 *
 * The slug comes from the name, the same rule the rest of the site follows: one
 * place to say what a thing is called, so the URL cannot disagree with it.
 */
export async function POST(req: NextRequest) {
  const guard = await requireCapability("commerce");
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = productBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const input = parsed.data;

  // `products.slug` is NOT NULL and unique, and there is no id fallback for it,
  // so a collision has to be resolved before the insert rather than surfacing
  // as a Postgres error an operator cannot act on.
  const base = slugify(input.name);
  let slug = base;
  for (let n = 2; n < 50; n++) {
    const taken = (
      await db
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(eq(schema.products.slug, slug))
        .limit(1)
    )[0];
    if (!taken) break;
    slug = `${base}-${n}`;
  }

  if (input.teamId) {
    const team = (
      await db
        .select({ id: schema.teams.id })
        .from(schema.teams)
        .where(eq(schema.teams.id, input.teamId))
        .limit(1)
    )[0];
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 422 });
    }
  }

  // A product pointing at a show that does not exist would render an empty
  // shelf on that show's page and be invisible everywhere else.
  if (input.showId) {
    const show = (
      await db
        .select({ id: schema.shows.id })
        .from(schema.shows)
        .where(eq(schema.shows.id, input.showId))
        .limit(1)
    )[0];
    if (!show) {
      return NextResponse.json({ error: "Show not found" }, { status: 422 });
    }
  }

  const id = generateId("product");
  await db.insert(schema.products).values({ id, slug, ...input });

  await writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "commerce",
    action: "product.create",
    before: null,
    after: { id, slug, ...input } as unknown as Record<string, unknown>,
    targetType: "product",
    targetId: id,
    meta: { name: input.name, slug, priceNgn: input.priceNgn },
  });

  const product = (
    await db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1)
  )[0];
  return NextResponse.json({ product }, { status: 201 });
}
