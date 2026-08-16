import "server-only";
import { localStorage, type StorageAdapter } from "./local";
import { spacesStorage } from "./spaces";

/**
 * Picks the storage adapter at module-load time:
 * - DO Spaces if SPACES_KEY is set, which is production.
 * - Local filesystem otherwise, which is a checkout with no credentials.
 *
 * There used to be a Vercel Blob branch between the two, kept as a one-env-var
 * rollback while the move to Spaces was unproven. On 2026-08-16 the upload path
 * was exercised end to end and the last two rows holding Blob URLs were copied
 * across, so the rollback had nothing left to roll back to.
 */
export const storage: StorageAdapter = process.env.SPACES_KEY
  ? spacesStorage
  : localStorage;

/** True when uploads should go straight to Spaces via presigned PUT. */
export const usingSpaces = Boolean(process.env.SPACES_KEY);

/**
 * Recover the storage key from a stored public URL, or null when the URL is
 * not ours to delete.
 *
 * Call sites persist absolute URLs, so best-effort cleanup of a replaced asset
 * has to work backwards from one. Some avatars are external (dicebear) and must
 * never be touched, which is why this returns null for a foreign host rather
 * than trying its luck.
 */
export function ownedKeyFromUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;

  // Local adapter serves from a relative path, not an absolute URL.
  if (rawUrl.startsWith("/api/uploads/")) {
    return storage === localStorage ? rawUrl.slice("/api/uploads/".length) : null;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!parsed.hostname.endsWith(".digitaloceanspaces.com")) return null;
  if (storage !== spacesStorage) return null;

  const key = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
  return key || null;
}

export type { StorageAdapter };
