import "server-only";
import { headers as nextHeaders } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { SessionUser } from "./index";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Resolves the `X-API-Key` header to a SessionUser-shaped object (`role`
 * + `id` + `email` etc) by hashing the key and matching the active row in
 * `api_keys`. Updates `last_used_at` for telemetry. Returns null if header
 * absent, key revoked, or no match.
 *
 * Use as an alternative to session-cookie/bearer auth for server-to-server
 * + external-integration callers.
 */
export async function authenticateApiKey(): Promise<SessionUser | null> {
  const h = await nextHeaders();
  const apiKey = h.get("x-api-key") ?? h.get("X-API-Key");
  if (!apiKey || !apiKey.startsWith("evo_")) return null;

  const keyHash = await sha256Hex(apiKey);
  const row = (
    await db
      .select({
        userId: schema.apiKeys.userId,
        keyId: schema.apiKeys.id,
      })
      .from(schema.apiKeys)
      .where(
        and(
          eq(schema.apiKeys.keyHash, keyHash),
          isNull(schema.apiKeys.revokedAt),
        ),
      )
      .limit(1)
  )[0];

  if (!row) return null;

  // Update last_used_at (best-effort, fire-and-forget).
  void db
    .update(schema.apiKeys)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(schema.apiKeys.id, row.keyId))
    .catch(() => {
      /* ignore */
    });

  const user = (
    await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, row.userId))
      .limit(1)
  )[0];

  if (!user) return null;
  return user as unknown as SessionUser;
}
