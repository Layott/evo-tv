import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/guards";
import { getEntitlements, NO_ENTITLEMENTS } from "@/lib/api/entitlements";

/**
 * GET /api/me/entitlements
 *
 * What this viewer has paid for, as the player and the UI need to know it.
 * Signed out is a valid answer, not an error: a guest has none of them.
 *
 * The player uses `maxHeight` to cap the quality ladder. Note what this is and
 * is not: it stops the player asking for the higher rungs, which saves the
 * viewer's data and ours. It is not the boundary. The boundary is the master
 * playlist, which is now served per viewer at `/api/hls/[id]/master.m3u8` and
 * simply does not contain the premium rungs for somebody who has not paid for
 * them, so a client that ignores this number gets nothing extra.
 */
export async function GET() {
  const user = await getCurrentUser();
  const entitlements = user
    ? await getEntitlements(user.id, user.role)
    : NO_ENTITLEMENTS;

  return NextResponse.json(
    {
      ...entitlements,
      signedIn: Boolean(user),
      /**
       * The tallest rung this viewer may pull.
       *
       * 480p on the free tier is a deliberate pair of decisions: it is the
       * right default for a mobile-first audience on Nigerian data, and it is
       * the difference between a viewer costing 0.36 GB an hour and 0.68.
       * `null` means no cap.
       */
      maxHeight: entitlements.hdPlayback ? null : 480,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
