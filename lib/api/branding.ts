import "server-only";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";

/**
 * The site's name, tagline and mark, set by an operator.
 *
 * The Branding tab used to raise "Branding saved" and store nothing, which is
 * the same shape as the password change that reported success and left the old
 * password working: a screen that lies about a write is worse than one with no
 * write at all, because the person believes the job is done and stops checking.
 *
 * Stored in the `feature_flags` row `site.branding`, the same trick the channel
 * breaks use, so this needed no migration and can be changed without a deploy.
 *
 * Colour is deliberately absent. The palette is a token system with a rule
 * behind it, and a hue set here would fight every surface that reads those
 * tokens, the on-air graphics included.
 */

export const BRANDING_FLAG_KEY = "site.branding";

export interface Branding {
  siteName: string;
  tagline: string;
  /** Absolute URL or a path served by this app. Blank means the shipped mark. */
  logoUrl: string;
}

export const BRANDING_DEFAULT: Branding = {
  siteName: "EVO TV",
  tagline: "Africa's home for esports, anime and lifestyle.",
  logoUrl: "",
};

function clean(value: unknown, fallback: string, max: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return fallback;
  return text.slice(0, max);
}

export function normalizeBranding(raw: unknown): Branding {
  const p = (raw ?? {}) as Partial<Branding>;
  return {
    siteName: clean(p.siteName, BRANDING_DEFAULT.siteName, 60),
    tagline: clean(p.tagline, BRANDING_DEFAULT.tagline, 160),
    // Blank is meaningful here: it means "use the mark we ship".
    logoUrl: typeof p.logoUrl === "string" ? p.logoUrl.trim().slice(0, 500) : "",
  };
}

export async function readBranding(): Promise<Branding> {
  const row = (
    await db
      .select({ payload: schema.featureFlags.payload })
      .from(schema.featureFlags)
      .where(eq(schema.featureFlags.key, BRANDING_FLAG_KEY))
      .limit(1)
  )[0];
  return normalizeBranding(row?.payload);
}

export async function writeBranding(next: Branding): Promise<Branding> {
  const branding = normalizeBranding(next);
  await db
    .insert(schema.featureFlags)
    .values({
      key: BRANDING_FLAG_KEY,
      enabled: true,
      description: "Site name, tagline and mark",
      payload: branding as unknown as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: schema.featureFlags.key,
      set: { payload: branding as unknown as Record<string, unknown> },
    });
  return branding;
}
