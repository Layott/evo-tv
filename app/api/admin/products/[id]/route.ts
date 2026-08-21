import { NextResponse, type NextRequest } from "next/server";
import { count, eq, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireCapability } from "@/lib/api/admin";
import { writeAudit } from "@/lib/api/audit";
import { productBody } from "../route";

/**
 * One product.
 *
 * The slug is deliberately not editable. It is derived from the name at
 * creation and left alone afterwards: a shop URL that has been shared, printed
 * on something, or indexed should not move because somebody fixed a typo in a
 * product title.
 */

const patchSchema = productBody.partial();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCapability("commerce");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const existing = (
    await db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1)
  )[0];
  if (!existing) return new NextResponse("Product not found", { status: 404 });

  // Same reason as the create route: a product pointing at a show that is not
  // there is invisible in the shop and renders an empty shelf on the show.
  if (parsed.data.showId) {
    const show = (
      await db
        .select({ id: schema.shows.id })
        .from(schema.shows)
        .where(eq(schema.shows.id, parsed.data.showId))
        .limit(1)
    )[0];
    if (!show) {
      return NextResponse.json({ error: "Show not found" }, { status: 422 });
    }
  }

  if (parsed.data.teamId) {
    const team = (
      await db
        .select({ id: schema.teams.id })
        .from(schema.teams)
        .where(eq(schema.teams.id, parsed.data.teamId))
        .limit(1)
    )[0];
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 422 });
    }
  }

  if (Object.keys(parsed.data).length > 0) {
    await db.update(schema.products).set(parsed.data).where(eq(schema.products.id, id));

    await writeAudit({
      actorId: guard.user.id,
      actorRole: guard.role,
      capability: "commerce",
      action: "product.update",
      targetType: "product",
      targetId: id,
      meta: { fields: Object.keys(parsed.data), name: existing.name },
    });
  }

  const product = (
    await db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1)
  )[0];
  return NextResponse.json({ product });
}

/**
 * DELETE /api/admin/products/[id] - take it off the shop.
 *
 * `products` has no `deletedAt`, so this sets `active` false rather than
 * removing the row. That is not squeamishness: every order stores its items as
 * a snapshot including the product id, and deleting the row would leave old
 * orders pointing at nothing. An inactive product disappears from the shop and
 * every past order still says what was bought.
 *
 * A product nobody has ever ordered is deleted outright, so a typo made two
 * minutes ago does not linger as an invisible row forever.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCapability("commerce");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const product = (
    await db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1)
  )[0];
  if (!product) return new NextResponse("Product not found", { status: 404 });

  // Has anybody bought it? `orders.items` is a jsonb array of line items, so
  // this is a containment check: `@>` matches any order whose items include an
  // object with this product id.
  const ordered = (
    await db
      .select({ value: count() })
      .from(schema.orders)
      .where(sql`${schema.orders.items} @> ${JSON.stringify([{ productId: id }])}::jsonb`)
  )[0];
  const orderCount = Number(ordered?.value ?? 0);

  if (orderCount > 0) {
    await db
      .update(schema.products)
      .set({ active: false, featured: false })
      .where(eq(schema.products.id, id));

    await writeAudit({
      actorId: guard.user.id,
      actorRole: guard.role,
      capability: "commerce",
      action: "product.deactivate",
      targetType: "product",
      targetId: id,
      meta: { name: product.name, orderCount },
    });

    return NextResponse.json({
      ok: true,
      productId: id,
      deactivated: true,
      message: `Taken off the shop. ${orderCount} past order${
        orderCount === 1 ? "" : "s"
      } still reference it, so the row is kept.`,
    });
  }

  await db.delete(schema.products).where(eq(schema.products.id, id));

  await writeAudit({
    before: product as unknown as Record<string, unknown>,
    after: null,
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "commerce",
    action: "product.delete",
    targetType: "product",
    targetId: id,
    meta: { name: product.name },
  });

  return NextResponse.json({ ok: true, productId: id, deactivated: false });
}
