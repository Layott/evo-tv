import { NextResponse, type NextRequest } from "next/server";
import { and, asc, isNull, like } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";

/**
 * GET /api/admin/playout-media — support_admin+.
 *
 * Lists the active media files the office playout box has reported (see
 * POST /api/internal/playout-media). Powers the file picker in the stream
 * schedule editor. Optional ?q= filters by file name/path substring.
 */
export async function GET(req: NextRequest) {
  const guard = await requireMinRole("support_admin");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();

  const rows = await db
    .select({
      id: schema.playoutMedia.id,
      filePath: schema.playoutMedia.filePath,
      fileName: schema.playoutMedia.fileName,
      durationSec: schema.playoutMedia.durationSec,
      sizeMb: schema.playoutMedia.sizeMb,
      lastSeenAt: schema.playoutMedia.lastSeenAt,
    })
    .from(schema.playoutMedia)
    .where(
      q
        ? and(
            isNull(schema.playoutMedia.deletedAt),
            like(schema.playoutMedia.fileName, `%${q}%`),
          )
        : isNull(schema.playoutMedia.deletedAt),
    )
    .orderBy(asc(schema.playoutMedia.fileName))
    .limit(500);

  return NextResponse.json({ files: rows, total: rows.length });
}
