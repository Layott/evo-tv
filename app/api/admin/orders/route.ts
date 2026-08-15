import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";

const querySchema = z.object({
  status: z
    .enum([
      "pending",
      "paid",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "refunded",
    ])
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/admin/orders
 *
 * Optional filters: ?status=&from=&to=&limit=&offset=
 * Returns { orders, total } so the admin UI can paginate.
 */
export async function GET(req: NextRequest) {
  // Support reads orders to answer "where is my order". Fulfilment and refunds
  // are higher up; this is the read that makes the support role worth having.
  const guard = await requireMinRole("support_admin");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { status, from, to, limit, offset } = parsed.data;

  const filters = [
    status ? eq(schema.orders.status, status) : undefined,
    from ? gte(schema.orders.createdAt, from) : undefined,
    to ? lte(schema.orders.createdAt, to) : undefined,
  ].filter(Boolean) as Parameters<typeof and>;

  const whereClause = filters.length ? and(...filters) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(schema.orders)
      .where(whereClause as ReturnType<typeof and>)
      .orderBy(desc(schema.orders.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(schema.orders)
      .where(whereClause as ReturnType<typeof and>),
  ]);

  return NextResponse.json({
    orders: rows,
    total: totalRow[0]?.value ?? 0,
    limit,
    offset,
  });
}
