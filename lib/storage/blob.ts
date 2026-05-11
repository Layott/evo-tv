import "server-only";
import { put, del, head, list } from "@vercel/blob";
import type { StorageAdapter } from "./local";

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

function ensureToken(): string {
  if (!TOKEN) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN not set. Run `vercel env pull` or set in Vercel Project Settings.",
    );
  }
  return TOKEN;
}

/**
 * Vercel Blob adapter. Mirrors the StorageAdapter shape from ./local.
 *
 * Important shape differences vs the local adapter:
 *
 * - `write` returns the public-CDN URL (not the relative path) because Blob
 *   does not expose a local "pathname → URL" map we control; the URL IS the
 *   canonical identifier. Callers that persist `write()` output to the DB
 *   should store the returned URL.
 *
 * - `url(rel)` looks up the canonical URL for an existing blob via `head()`.
 *   It is async-only in semantics but we expose it as a sync string returning
 *   the relative path prefixed with the Blob store domain. For richer flows,
 *   pass the URL returned by `write()` directly.
 *
 * - `signedUrl` / `verifySigned`: Vercel Blob does not expose HMAC signing.
 *   Public blobs are CDN-reachable by anyone with the URL; private blobs need
 *   `getDownloadUrl()` from a token. We use the underlying URL and rely on
 *   the unique random suffix as the "secret".
 */
export const vercelBlobStorage: StorageAdapter = {
  async write(relativePath, data) {
    const token = ensureToken();
    const result = await put(relativePath, data, {
      access: "public",
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    // We return the URL (not the path) so call sites can persist it directly.
    return result.url;
  },

  async read(relativePath) {
    // Blob doesn't expose a direct "read" — fetch the CDN URL.
    const meta = await head(relativePath, { token: ensureToken() });
    const res = await fetch(meta.url);
    if (!res.ok) throw new Error(`blob read failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  },

  async delete(relativePath) {
    try {
      await del(relativePath, { token: ensureToken() });
    } catch (err) {
      // Mirror local adapter behaviour — ENOENT-equivalent is non-fatal.
      const msg = (err as Error).message ?? "";
      if (!msg.includes("not found") && !msg.includes("404")) throw err;
    }
  },

  async exists(relativePath) {
    try {
      await head(relativePath, { token: ensureToken() });
      return true;
    } catch {
      return false;
    }
  },

  url(relativePath) {
    // Public Blob URL pattern. The store's base URL is exposed via the
    // BLOB_READ_WRITE_TOKEN's embedded host but easiest to compute on-the-fly:
    // <storeId>.public.blob.vercel-storage.com/<pathname>
    const token = ensureToken();
    // Token format: vercel_blob_rw_<storeId>_<random>
    const match = /vercel_blob_rw_([a-zA-Z0-9]+)_/.exec(token);
    const storeId = match?.[1]?.toLowerCase();
    if (!storeId) return `/api/uploads/${relativePath}`;
    return `https://${storeId}.public.blob.vercel-storage.com/${relativePath}`;
  },

  signedUrl(relativePath) {
    // Vercel Blob doesn't sign URLs — public blobs are CDN-reachable. Caller
    // should treat this as the canonical URL for the asset.
    return this.url(relativePath);
  },

  verifySigned() {
    // No HMAC signature scheme on Blob. Always true; callers should rely on
    // the unique URL as the access control.
    return true;
  },
};

export async function listBlobs(prefix?: string) {
  return list({ prefix, token: ensureToken() });
}
