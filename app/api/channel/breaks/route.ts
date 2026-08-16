import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/guards";
import { readChannelBreaks } from "@/lib/channel-breaks";
import { getEntitlements } from "@/lib/api/entitlements";

/**
 * GET /api/channel/breaks
 *
 * Everything the player needs to run the channel's rhythm: when to take a
 * break, when to show the on-air card, whether to cover a dropped feed, and
 * whether this particular viewer has paid for none of the ads.
 *
 * `adFree` is decided here rather than in the browser. A client that decides
 * for itself whether to show ads is a client that can be told not to.
 *
 * Not cached: the answer differs per viewer, and the whole point of the flag
 * is that an admin can change the rhythm without a deploy.
 */
export async function GET() {
  const user = await getCurrentUser();
  const [breaks, entitlements] = await Promise.all([
    readChannelBreaks(),
    getEntitlements(user?.id, user?.role),
  ]);

  return NextResponse.json(
    {
      ...breaks,
      adFree: entitlements.adFree,
      // Sent so the player can say why the ads stopped, rather than a viewer
      // wondering whether it is broken.
      signedIn: Boolean(user),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
