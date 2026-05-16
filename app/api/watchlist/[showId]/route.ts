import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/guards";
import {
  getShowById,
  getWatchlistEntry,
  removeWatchlistEntry,
  upsertWatchlistEntry,
} from "@/lib/api/shows";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  status: z.enum([
    "watching",
    "completed",
    "on_hold",
    "dropped",
    "plan_to_watch",
  ]),
});

/** GET /api/watchlist/[showId] — current viewer's status for a show, or null. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ showId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { showId } = await params;
  if (!showId)
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const entry = await getWatchlistEntry(user.id, showId);
  return NextResponse.json({ entry });
}

/** PUT /api/watchlist/[showId] — upsert status. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ showId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { showId } = await params;
  if (!showId)
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const show = await getShowById(showId);
  if (!show) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await upsertWatchlistEntry(user.id, showId, parsed.data.status);
  return NextResponse.json({ ok: true, status: parsed.data.status });
}

/** DELETE /api/watchlist/[showId] — remove from watchlist. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ showId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { showId } = await params;
  if (!showId)
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  await removeWatchlistEntry(user.id, showId);
  return NextResponse.json({ ok: true });
}
