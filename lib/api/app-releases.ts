import "server-only";
import { desc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";

export type ReleasePlatform = "android" | "ios";

export interface AppRelease {
  id: string;
  platform: ReleasePlatform;
  version: string;
  buildNumber: number;
  commitSha: string;
  fileUrl: string;
  sizeBytes: number;
  notes: string | null;
  releasedAt: string;
}

/**
 * The build a visitor should be given for this platform.
 *
 * Ordered by build number rather than by `releasedAt`, so re-publishing an
 * older binary by mistake cannot demote the newer one, and two builds on the
 * same day are unambiguous.
 */
export async function getLatestRelease(
  platform: ReleasePlatform,
): Promise<AppRelease | null> {
  const rows = await db
    .select()
    .from(schema.appReleases)
    .where(eq(schema.appReleases.platform, platform))
    .orderBy(desc(schema.appReleases.buildNumber))
    .limit(1);

  return (rows[0] as AppRelease | undefined) ?? null;
}

/** Every release for a platform, newest first. Used by the admin list. */
export async function listReleases(
  platform: ReleasePlatform,
  limit = 20,
): Promise<AppRelease[]> {
  const rows = await db
    .select()
    .from(schema.appReleases)
    .where(eq(schema.appReleases.platform, platform))
    .orderBy(desc(schema.appReleases.buildNumber))
    .limit(limit);
  return rows as AppRelease[];
}

/** A size a person can read, for the button that is about to cost them 96 MB. */
export function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}
