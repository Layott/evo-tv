import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdminFromRequest } from "@/lib/api/admin";

const querySchema = z.object({
  role: z.enum(["user", "premium", "admin"]).optional(),
  search: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/admin/users
 *
 * Optional filters: ?role=&search=&limit=&offset=
 *   - search matches email or handle (case-insensitive)
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { role, search, limit, offset } = parsed.data;

  const filters = [
    role ? eq(schema.user.role, role) : undefined,
    search
      ? or(
          ilike(schema.user.email, `%${search}%`),
          ilike(schema.user.handle, `%${search}%`),
        )
      : undefined,
  ].filter(Boolean) as Parameters<typeof and>;

  const whereClause = filters.length ? and(...filters) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: schema.user.id,
        email: schema.user.email,
        name: schema.user.name,
        handle: schema.user.handle,
        role: schema.user.role,
        emailVerified: schema.user.emailVerified,
        image: schema.user.image,
        createdAt: schema.user.createdAt,
        deletedAt: schema.user.deletedAt,
      })
      .from(schema.user)
      .where(whereClause as ReturnType<typeof and>)
      .orderBy(desc(schema.user.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(schema.user)
      .where(whereClause as ReturnType<typeof and>),
  ]);

  return NextResponse.json({
    users: rows,
    total: totalRow[0]?.value ?? 0,
    limit,
    offset,
  });
}

const patchSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["user", "premium", "admin"]),
});

/**
 * PATCH /api/admin/users
 *
 * Body: { userId, role } — promote/demote a user. Self-edit blocked.
 */
export async function PATCH(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

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
  if (parsed.data.userId === guard.user.id) {
    return new NextResponse("Cannot change own role", { status: 400 });
  }

  const result = await db
    .update(schema.user)
    .set({ role: parsed.data.role })
    .where(eq(schema.user.id, parsed.data.userId))
    .returning({ id: schema.user.id, role: schema.user.role });

  if (result.length === 0) {
    return new NextResponse("User not found", { status: 404 });
  }

  return NextResponse.json({ ok: true, ...result[0] });
}
