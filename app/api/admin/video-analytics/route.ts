import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireMinRole } from "@/lib/auth/guards";
import { listVideoSummaries, videoAnalytics } from "@/lib/api/video-analytics";
import { isDayKey, MAX_RANGE_DAYS, resolveRange } from "@/lib/analytics/range";

/**
 * GET /api/admin/video-analytics
 *
 * Without `id`: every video with its headline numbers for the range, best
 * first, which is the list the admin page opens on.
 *
 * With `type` and `id`: the full breakdown for one video.
 */

/**
 * `days` is the preset chips; `from` and `to` are a chosen window.
 *
 * The screen offered four fixed presets and nothing else, so "how did the
 * premiere do on the night" could not be asked: the shortest answer available
 * was seven days with the premiere buried in it. `from` alone is a single day.
 */
const querySchema = z.object({
  type: z.enum(["vod", "episode"]).optional(),
  id: z.string().min(1).optional(),
  days: z.coerce.number().int().min(1).max(MAX_RANGE_DAYS).default(28),
  from: z.string().refine(isDayKey, "Expected YYYY-MM-DD").optional(),
  to: z.string().refine(isDayKey, "Expected YYYY-MM-DD").optional(),
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
  const { type, id, ...rangeInput } = parsed.data;
  const range = resolveRange(rangeInput);

  if (type && id) {
    const data = await videoAnalytics(type, id, rangeInput);
    if (!data) return new NextResponse("Video not found", { status: 404 });
    // The window travels with the answer, so the screen prints the days it is
    // actually looking at rather than the days it asked for.
    return NextResponse.json({ ...data, range });
  }

  return NextResponse.json({
    videos: await listVideoSummaries(rangeInput),
    range,
  });
}
