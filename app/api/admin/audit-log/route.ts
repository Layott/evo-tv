import { NextResponse, type NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdminFromRequest } from "@/lib/api/admin";

export async function GET(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const raw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(raw) ? Math.max(1, Math.min(500, Math.trunc(raw))) : 50;

  const rows = await db
    .select()
    .from(schema.auditLog)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(limit);

  return NextResponse.json(rows);
}
