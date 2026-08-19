import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/guards";
import {
  getPublicProfileByHandle,
  type PublicProfileClip,
  type PublicProfileVod,
} from "@/lib/api/users";

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

  // Play counts come off unconditionally, not per role.
  //
  // This response is `Cache-Control: public`, so a shared cache can hand one
  // caller's copy to the next. Varying the body by role behind a public cache
  // is how an admin's copy ends up served to everybody, which is worse than
  // the leak it was meant to fix. Staff read these figures in the control
  // room, so there is nothing lost by stripping them here for everyone.
  const publicProfile = {
    ...profile,
    recentClips: profile.recentClips.map(
      ({ viewCount: _c, ...rest }: PublicProfileClip) => rest,
    ),
    recentVods: profile.recentVods.map(
      ({ viewCount: _v, ...rest }: PublicProfileVod) => rest,
    ),
  };

  return NextResponse.json(publicProfile, {
    headers: {
      "Cache-Control": "public, max-age=30, s-maxage=60",
    },
  });
}
