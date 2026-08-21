import { NextResponse } from "next/server";

import { requireMinRole } from "@/lib/auth/guards";
import { usingSpaces } from "@/lib/storage";
import { listSpaces, makePublic, publicUrl } from "@/lib/storage/spaces";
import { writeAudit } from "@/lib/api/audit";

/**
 * POST /api/admin/uploads/repair
 *
 * Republish the files the bucket kept private.
 *
 * The presigned PUT asked for `public-read` in its query string and the bucket
 * did not apply it, so everything the CMS uploaded landed unreadable: the
 * stream thumbnail on /admin/streams was a broken image and so was every poster
 * uploaded the same way. New uploads are fixed at the source; this is for what
 * is already up there, and it is here rather than only in a script so it does
 * not need a terminal on the droplet.
 *
 * Capped per call. A bucket with thousands of objects should not hold a request
 * open for minutes: run it again and it picks up where the count left off,
 * because a repaired file is no longer broken.
 */

const MAX_PER_RUN = 300;

async function readable(url: string): Promise<number> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    return res.status;
  } catch {
    return 0;
  }
}

export async function POST() {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;

  if (!usingSpaces) {
    return NextResponse.json(
      { error: "No storage backend is configured on this deployment" },
      { status: 503 },
    );
  }

  let checked = 0;
  let broken = 0;
  let repaired = 0;
  const stillBroken: { key: string; status: number }[] = [];
  let truncated = false;

  for (const prefix of ["admin-uploads/", "downloads/"]) {
    const listing = await listSpaces(prefix);
    for (const object of listing.Contents ?? []) {
      const key = object.Key;
      if (!key) continue;
      if (checked >= MAX_PER_RUN) {
        truncated = true;
        break;
      }
      checked++;
      if ((await readable(publicUrl(key))) === 200) continue;
      broken++;
      const result = await makePublic(key);
      if (result.publiclyReadable) repaired++;
      else stillBroken.push({ key, status: result.status });
    }
    if (truncated) break;
  }

  void writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "roster",
    action: "uploads.repair",
    before: { unreadable: broken },
    after: { repaired, stillUnreadable: stillBroken.length, checked },
    targetType: "storage",
    targetId: "spaces",
    meta: { checked, broken, repaired, stillBroken: stillBroken.length, truncated },
  });

  return NextResponse.json({
    checked,
    broken,
    repaired,
    stillBroken,
    truncated,
  });
}
