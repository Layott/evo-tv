import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";

const querySchema = z.object({
  status: z.enum(["open", "resolved", "dismissed"]).optional(),
  targetType: z
    .enum(["stream", "vod", "clip", "user", "chat_message", "party"])
    .optional(),
  category: z
    .enum([
      "spam",
      "abuse",
      "copyright",
      "illegal",
      "csam",
      "impersonation",
      "other",
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/admin/reports
 *
 * List content reports. Moderator+ can view. Default returns `open` reports
 * ordered newest-first. Filter via ?status= / ?category= / ?targetType=.
 */
export async function GET(req: NextRequest) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { status, targetType, category, limit, offset } = parsed.data;

  const filters: SQL[] = [];
  if (status) filters.push(eq(schema.contentReports.status, status));
  else filters.push(eq(schema.contentReports.status, "open"));
  if (targetType) filters.push(eq(schema.contentReports.targetType, targetType));
  if (category) filters.push(eq(schema.contentReports.category, category));

  const whereClause = and(...filters);

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(schema.contentReports)
      .where(whereClause)
      .orderBy(desc(schema.contentReports.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(schema.contentReports)
      .where(whereClause),
  ]);

  return NextResponse.json({
    reports: rows,
    total: totalRow[0]?.value ?? 0,
    limit,
    offset,
  });
}
