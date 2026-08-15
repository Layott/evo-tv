import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import {
  addBookmark,
  isBookmarked,
  removeBookmark,
} from "@/lib/api/watch-later";

/**
 * GET /api/users/me/watch-later/[vodId] - `{ bookmarked: boolean }` so the
 * VOD detail page can render the right button state without listing the
 * whole bookmarks set.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ vodId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { vodId } = await params;
  return NextResponse.json({ bookmarked: await isBookmarked(user.id, vodId) });
}

/**
 * POST /api/users/me/watch-later/[vodId] - add to watch-later. Idempotent
 * (ON CONFLICT DO NOTHING). Returns `{ bookmarked: true }`.
 *
 * Verifies the VOD exists + isn't soft-deleted before inserting.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ vodId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { vodId } = await params;

  const vod = (
    await db
      .select({ id: schema.vods.id, deletedAt: schema.vods.deletedAt })
      .from(schema.vods)
      .where(eq(schema.vods.id, vodId))
      .limit(1)
  )[0];
  if (!vod || vod.deletedAt) {
    return new NextResponse("VOD not found", { status: 404 });
  }

  await addBookmark(user.id, vodId);
  return NextResponse.json({ bookmarked: true });
}

/**
 * DELETE /api/users/me/watch-later/[vodId] - remove from watch-later.
 * Idempotent (no-op if missing). Returns `{ bookmarked: false }`.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ vodId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { vodId } = await params;
  await removeBookmark(user.id, vodId);
  return NextResponse.json({ bookmarked: false });
}
