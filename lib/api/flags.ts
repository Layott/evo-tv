import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type FeatureFlagRow = typeof schema.featureFlags.$inferSelect;

/** Return all feature-flag rows, ordered by key. */
export async function listFlags(): Promise<FeatureFlagRow[]> {
  const rows = db.select().from(schema.featureFlags).all();
  return rows.sort((a, b) => a.key.localeCompare(b.key));
}

/** Fetch a single flag by key, or `null` when missing. */
export async function getFlag(key: string): Promise<FeatureFlagRow | null> {
  const row = db
    .select()
    .from(schema.featureFlags)
    .where(eq(schema.featureFlags.key, key))
    .get();
  return row ?? null;
}

/**
 * Upsert a flag. Creates the row when missing; otherwise updates the
 * provided fields (undefined ones are untouched).
 */
export async function setFlag(
  key: string,
  enabled: boolean,
  description?: string,
  payload?: Record<string, unknown> | null
): Promise<FeatureFlagRow> {
  const existing = await getFlag(key);
  if (existing) {
    const update: Partial<FeatureFlagRow> = { enabled };
    if (description !== undefined) update.description = description;
    if (payload !== undefined) {
      update.payload = (payload ?? undefined) as
        | Record<string, unknown>
        | undefined;
    }
    db.update(schema.featureFlags)
      .set(update)
      .where(eq(schema.featureFlags.key, key))
      .run();
  } else {
    db.insert(schema.featureFlags)
      .values({
        key,
        enabled,
        description: description ?? "",
        payload: (payload ?? undefined) as
          | Record<string, unknown>
          | undefined,
      })
      .run();
  }
  const row = await getFlag(key);
  if (!row) throw new Error("Flag upsert failed");
  return row;
}

/**
 * "Soft delete" by default: sets enabled=false but keeps the row so the
 * value isn't lost if the flag is referenced elsewhere. Pass `hard:true`
 * to actually remove it.
 */
export async function deleteFlag(
  key: string,
  opts?: { hard?: boolean }
): Promise<{ deleted: boolean; disabled: boolean }> {
  const existing = await getFlag(key);
  if (!existing) return { deleted: false, disabled: false };

  if (opts?.hard) {
    db.delete(schema.featureFlags).where(eq(schema.featureFlags.key, key)).run();
    return { deleted: true, disabled: false };
  }

  db.update(schema.featureFlags)
    .set({ enabled: false })
    .where(eq(schema.featureFlags.key, key))
    .run();
  return { deleted: false, disabled: true };
}
