import { NextResponse, type NextRequest } from "next/server";
import { desc } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireAdminFromRequest } from "@/lib/api/admin";

/**
 * Admin view of the pre-launch waitlist. Returns every signup, newest first.
 * Does NOT expose verify tokens.
 *
 *   GET /api/admin/waitlist -> { count, entries: [...] }
 */
export async function GET(_req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const entries = await db
    .select({
      id: schema.waitlist.id,
      email: schema.waitlist.email,
      username: schema.waitlist.username,
      verified: schema.waitlist.verified,
      verifiedAt: schema.waitlist.verifiedAt,
      source: schema.waitlist.source,
      createdAt: schema.waitlist.createdAt,
    })
    .from(schema.waitlist)
    .orderBy(desc(schema.waitlist.createdAt));

  return NextResponse.json({ count: entries.length, entries });
}
