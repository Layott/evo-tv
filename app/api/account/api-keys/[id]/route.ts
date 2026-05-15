import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";

/**
 * DELETE /api/account/api-keys/[id] — revoke (soft delete).
 *
 * Sets revokedAt=now. Only the owning user can revoke their own keys.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { id } = await params;

  const existing = (
    await db
      .select({
        id: schema.apiKeys.id,
        userId: schema.apiKeys.userId,
      })
      .from(schema.apiKeys)
      .where(
        and(
          eq(schema.apiKeys.id, id),
          isNull(schema.apiKeys.revokedAt),
        ),
      )
      .limit(1)
  )[0];

  if (!existing) {
    return new NextResponse("Key not found or already revoked", { status: 404 });
  }
  if (existing.userId !== user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  await db
    .update(schema.apiKeys)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(schema.apiKeys.id, id));

  return NextResponse.json({ ok: true });
}
