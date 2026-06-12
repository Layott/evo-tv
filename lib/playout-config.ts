import "server-only";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";

/**
 * Playout channel config: filler content + ad break media for the office
 * playout box. Stored in the feature_flags row `playout.config` (jsonb
 * payload) so no migration is needed. File paths come from the playout
 * media library the office agent reports (/api/admin/playout-media).
 */

export const PLAYOUT_CONFIG_FLAG_KEY = "playout.config";

export interface PlayoutConfig {
  fillerFiles: string[];
  adFiles: string[];
}

export async function readPlayoutConfig(): Promise<PlayoutConfig> {
  const row = (
    await db
      .select({ payload: schema.featureFlags.payload })
      .from(schema.featureFlags)
      .where(eq(schema.featureFlags.key, PLAYOUT_CONFIG_FLAG_KEY))
      .limit(1)
  )[0];
  const p = (row?.payload ?? {}) as Partial<PlayoutConfig>;
  return {
    fillerFiles: Array.isArray(p.fillerFiles)
      ? p.fillerFiles.filter((f): f is string => typeof f === "string")
      : [],
    adFiles: Array.isArray(p.adFiles)
      ? p.adFiles.filter((f): f is string => typeof f === "string")
      : [],
  };
}
