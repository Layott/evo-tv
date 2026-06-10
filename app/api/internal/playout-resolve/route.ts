import { NextResponse, type NextRequest } from "next/server";
import { and, between, isNotNull, isNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";

/**
 * GET /api/internal/playout-resolve?date=YYYY-MM-DD — Bearer ${PLAYOUT_SECRET}.
 *
 * Server-authoritative program -> file map for the playout adapter. Returns the
 * admin-chosen media file for each scheduled stream airing on the given UTC day
 * (those with a playout_file_path set). The office adapter merges this over its
 * local media-map.json so admin picks in the app win over the static map.
 *
 *   { "map": { "stream_<id>": "/media/anime/ep01.mp4", ... } }
 */
export async function GET(req: NextRequest) {
  const secret = process.env.PLAYOUT_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(dayStart.getTime())) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 },
    );
  }
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const rows = await db
    .select({
      id: schema.streams.id,
      playoutFilePath: schema.streams.playoutFilePath,
    })
    .from(schema.streams)
    .where(
      and(
        isNull(schema.streams.deletedAt),
        isNotNull(schema.streams.playoutFilePath),
        between(
          schema.streams.scheduledStartAt,
          dayStart.toISOString(),
          dayEnd.toISOString(),
        ),
      ),
    );

  const map: Record<string, string> = {};
  for (const r of rows) {
    if (r.playoutFilePath) map[`stream_${r.id}`] = r.playoutFilePath;
  }

  return NextResponse.json({ map });
}
