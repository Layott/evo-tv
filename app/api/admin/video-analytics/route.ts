import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireMinRole } from "@/lib/auth/guards";
import { listVideoSummaries, videoAnalytics } from "@/lib/api/video-analytics";

/**
 * GET /api/admin/video-analytics
 *
 * Without `id`: every video with its headline numbers for the range, best
 * first, which is the list the admin page opens on.
 *
 * With `type` and `id`: the full breakdown for one video.
 */

const querySchema = z.object({
  type: z.enum(["vod", "episode"]).optional(),
  id: z.string().min(1).optional(),
  days: z.coerce.number().int().min(1).max(365).default(28),
});

export async function GET(req: NextRequest) {
  // Reading numbers is not a write, and the people who need them most are the
  // ones running the channel day to day.
  const guard = await requireMinRole("support_admin");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { type, id, days } = parsed.data;

  if (type && id) {
    const data = await videoAnalytics(type, id, days);
    if (!data) return new NextResponse("Video not found", { status: 404 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ videos: await listVideoSummaries(days) });
}
