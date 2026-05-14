import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, count, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdminFromRequest } from "@/lib/api/admin";

const querySchema = z.object({
  streamId: z.string().optional(),
  isClosed: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/admin/polls
 *
 * Optional filters: ?streamId=&isClosed=true|false&limit=&offset=
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { streamId, isClosed, limit, offset } = parsed.data;

  const filters = [
    streamId ? eq(schema.polls.streamId, streamId) : undefined,
    typeof isClosed === "boolean"
      ? eq(schema.polls.isClosed, isClosed)
      : undefined,
  ].filter(Boolean) as Parameters<typeof and>;

  const whereClause = filters.length ? and(...filters) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(schema.polls)
      .where(whereClause as ReturnType<typeof and>)
      .orderBy(desc(schema.polls.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(schema.polls)
      .where(whereClause as ReturnType<typeof and>),
  ]);

  return NextResponse.json({
    polls: rows,
    total: totalRow[0]?.value ?? 0,
    limit,
    offset,
  });
}
