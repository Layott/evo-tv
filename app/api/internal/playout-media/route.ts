import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNull, notInArray, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";

/**
 * Office media-agent -> backend: report the playout box's media library.
 *
 * scripts/report-media-library.mjs scans the playout folder and POSTs the full
 * current file list here. We upsert one playout_media row per file (refreshing
 * lastSeenAt + metadata, un-deleting any that reappeared) and soft-delete rows
 * whose file is no longer present. Admins then pick from these in the schedule
 * editor instead of hand-editing a JSON map.
 *
 * Auth: Authorization: Bearer ${PLAYOUT_SECRET}.
 *
 * Body (JSON):
 *   { "files": [ { "path": "/media/anime/ep01.mp4", "name": "ep01.mp4",
 *                  "durationSec": 1380, "sizeMb": 540 }, ... ] }
 */

type IncomingFile = {
  path?: unknown;
  name?: unknown;
  durationSec?: unknown;
  sizeMb?: unknown;
};

function genId(): string {
  return (
    "pm_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function asInt(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.PLAYOUT_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let body: { files?: unknown };
  try {
    body = (await req.json()) as { files?: unknown };
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }
  if (!Array.isArray(body.files)) {
    return NextResponse.json({ error: "files[] required" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const seen: string[] = [];
  let upserted = 0;

  for (const raw of body.files as IncomingFile[]) {
    const filePath = typeof raw.path === "string" ? raw.path.trim() : "";
    if (!filePath) continue;
    const fileName =
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name.trim()
        : filePath.split(/[\\/]/).pop() || filePath;
    seen.push(filePath);

    await db
      .insert(schema.playoutMedia)
      .values({
        id: genId(),
        filePath,
        fileName,
        durationSec: asInt(raw.durationSec),
        sizeMb: asInt(raw.sizeMb),
        lastSeenAt: nowIso,
        createdAt: nowIso,
        deletedAt: null,
      })
      .onConflictDoUpdate({
        target: schema.playoutMedia.filePath,
        set: {
          fileName,
          durationSec: asInt(raw.durationSec),
          sizeMb: asInt(raw.sizeMb),
          lastSeenAt: nowIso,
          deletedAt: null,
        },
      });
    upserted += 1;
  }

  // Soft-delete files that exist in the table but were not in this report.
  let removed = 0;
  if (seen.length > 0) {
    const res = await db
      .update(schema.playoutMedia)
      .set({ deletedAt: nowIso })
      .where(
        and(
          isNull(schema.playoutMedia.deletedAt),
          notInArray(schema.playoutMedia.filePath, seen),
        ),
      );
    removed = (res as { rowCount?: number }).rowCount ?? 0;
  } else {
    // Empty report = the folder is empty; soft-delete everything still active.
    const res = await db
      .update(schema.playoutMedia)
      .set({ deletedAt: nowIso })
      .where(isNull(schema.playoutMedia.deletedAt));
    removed = (res as { rowCount?: number }).rowCount ?? 0;
  }

  const activeRow = (
    await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.playoutMedia)
      .where(isNull(schema.playoutMedia.deletedAt))
  )[0];

  return NextResponse.json({
    ok: true,
    upserted,
    removed,
    active: activeRow?.n ?? 0,
  });
}
