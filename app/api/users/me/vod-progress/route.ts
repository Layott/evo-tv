import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";

/**
 * GET /api/users/me/vod-progress?limit=20
 *
 * Recent watch history for the current user — vod_progress rows joined with
 * the parent VOD row so the client can render thumbnails + titles without a
 * second round-trip. Soft-deleted VODs (deletedAt NOT NULL) are filtered out.
 *
 * Used to populate the History tab on /library.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const raw = Number.parseInt(
    new URL(req.url).searchParams.get("limit") ?? "20",
    10,
  );
  const limit = Math.max(1, Math.min(100, Number.isFinite(raw) ? raw : 20));

  const rows = await db
    .select({
      vodId: schema.vodProgress.vodId,
      positionSec: schema.vodProgress.positionSec,
      updatedAt: schema.vodProgress.updatedAt,
      title: schema.vods.title,
      thumbnailUrl: schema.vods.thumbnailUrl,
      durationSec: schema.vods.durationSec,
      gameId: schema.vods.gameId,
      isPremium: schema.vods.isPremium,
      pillar: schema.vods.pillar,
    })
    .from(schema.vodProgress)
    .innerJoin(schema.vods, eq(schema.vodProgress.vodId, schema.vods.id))
    .where(
      and(
        eq(schema.vodProgress.userId, user.id),
        isNull(schema.vods.deletedAt),
      ),
    )
    .orderBy(desc(schema.vodProgress.updatedAt))
    .limit(limit);

  return NextResponse.json(rows);
}
