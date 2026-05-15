import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { and, count, eq, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";

const TARGET_TYPES = ["stream", "vod", "clip", "user", "chat_message", "party"] as const;
const CATEGORIES = [
  "spam",
  "abuse",
  "copyright",
  "illegal",
  "csam",
  "impersonation",
  "other",
] as const;

const createSchema = z.object({
  targetType: z.enum(TARGET_TYPES),
  targetId: z.string().min(1).max(200),
  category: z.enum(CATEGORIES),
  details: z.string().max(2000).optional(),
});

/**
 * POST /api/reports
 *
 * Any authenticated user submits a report against a target. Rate limited
 * loosely by recent-open count: if the reporter already has 20 open reports
 * (un-resolved), block further submissions until staff catches up.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { targetType, targetId, category, details } = parsed.data;

  const openCount = await db
    .select({ value: count() })
    .from(schema.contentReports)
    .where(
      and(
        eq(schema.contentReports.reporterUserId, user.id),
        eq(schema.contentReports.status, "open"),
      ),
    );
  if ((openCount[0]?.value ?? 0) >= 20) {
    return NextResponse.json(
      { error: "Too many open reports; wait for staff review" },
      { status: 429 },
    );
  }

  // Block reporting your own content/self.
  if (targetType === "user" && targetId === user.id) {
    return NextResponse.json(
      { error: "Cannot report yourself" },
      { status: 400 },
    );
  }

  const id = "rpt_" + crypto.randomBytes(8).toString("hex");
  await db.insert(schema.contentReports).values({
    id,
    reporterUserId: user.id,
    targetType,
    targetId,
    category,
    details: details ?? null,
    status: "open",
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, reportId: id });
}

/**
 * GET /api/reports — list MINE (reporter view). Auth required.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const rows = await db
    .select()
    .from(schema.contentReports)
    .where(eq(schema.contentReports.reporterUserId, user.id))
    .orderBy(desc(schema.contentReports.createdAt))
    .limit(100);

  return NextResponse.json({ reports: rows });
}
