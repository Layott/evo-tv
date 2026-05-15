import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";

/**
 * GET /api/admin/users/[id]/login-events
 *
 * Per-user forensic login history. Returns last 100 rows newest-first.
 * Moderator+.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const rows = await db
    .select()
    .from(schema.loginEvents)
    .where(eq(schema.loginEvents.userId, id))
    .orderBy(desc(schema.loginEvents.createdAt))
    .limit(100);

  return NextResponse.json({ events: rows });
}
