import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";

/**
 * GET /api/partner/payouts - list payouts the caller can see, scoped to
 * publishers they're a member of. EVO admins see all.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const appRole = (user as { role?: string }).role ?? "user";
  if (appRole === "admin") {
    const all = await db
      .select()
      .from(schema.payouts)
      .orderBy(desc(schema.payouts.createdAt))
      .limit(200);
    return NextResponse.json(all);
  }

  const memberships = await db
    .select({ publisherId: schema.publisherMembers.publisherId })
    .from(schema.publisherMembers)
    .where(eq(schema.publisherMembers.userId, user.id));
  const ids = memberships.map((m) => m.publisherId);
  if (ids.length === 0) return NextResponse.json([]);

  const rows = await db
    .select()
    .from(schema.payouts)
    .where(inArray(schema.payouts.publisherId, ids))
    .orderBy(desc(schema.payouts.createdAt))
    .limit(200);
  return NextResponse.json(rows);
}
