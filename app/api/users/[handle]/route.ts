import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/guards";
import { getPublicProfileByHandle } from "@/lib/api/users";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/[handle] - public profile lookup.
 *
 * Returns safe profile fields + follower count + recent clips + owned channels.
 * Soft-deleted users return 404. Email is never included. When called with a
 * valid bearer token, `isFollowing` reflects the viewer's follow state in one
 * round-trip.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle: raw } = await params;
  const handle = decodeURIComponent(raw ?? "").trim();
  if (!handle || handle.length > 64) {
    return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
  }

  const viewer = await getCurrentUser().catch(() => null);
  const profile = await getPublicProfileByHandle(handle, viewer?.id);
  if (!profile) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(profile, {
    headers: {
      "Cache-Control": "public, max-age=30, s-maxage=60",
    },
  });
}
