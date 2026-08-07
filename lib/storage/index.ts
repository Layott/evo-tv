import "server-only";
import { localStorage, type StorageAdapter } from "./local";
import { vercelBlobStorage } from "./blob";
import { spacesStorage } from "./spaces";

/**
 * Picks storage adapter at module-load time, most specific first:
 * - DO Spaces if SPACES_KEY is set (the destination).
 * - Vercel Blob if BLOB_READ_WRITE_TOKEN is set (the source, still live until
 *   the object copy is verified; keeping it means rollback is one env var).
 * - Local filesystem otherwise (dev without either configured).
 *
 * Delete the Blob branch, `./blob.ts` and the @vercel/blob dependency once
 * nothing 404s against Spaces.
 */
export const storage: StorageAdapter = process.env.SPACES_KEY
  ? spacesStorage
  : process.env.BLOB_READ_WRITE_TOKEN
    ? vercelBlobStorage
    : localStorage;

/** True when uploads should go straight to Spaces via presigned PUT. */
export const usingSpaces = Boolean(process.env.SPACES_KEY);

/**
 * Recover the storage key from a stored public URL, or null when the URL is
 * not ours to delete.
 *
 * Call sites persist absolute URLs, so best-effort cleanup of a replaced asset
 * has to work backwards from one. Two things make that fiddly during the
 * migration: rows still hold Vercel Blob URLs while new writes go to Spaces,
 * and some avatars are external (dicebear) and must never be touched.
 *
 * Returns null for a foreign host, and for a Blob URL while Spaces is active,
 * because the active adapter cannot delete from the other backend. The result
 * is a leaked orphan on a store that is about to be deleted anyway, which is
 * the correct trade against deleting something we do not own.
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

  const isBlob = parsed.hostname.endsWith(".blob.vercel-storage.com");
  const isSpaces = parsed.hostname.endsWith(".digitaloceanspaces.com");
  if (!isBlob && !isSpaces) return null;
  if (isBlob && storage !== vercelBlobStorage) return null;
  if (isSpaces && storage !== spacesStorage) return null;

  const key = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
  return key || null;
}

export type { StorageAdapter };
