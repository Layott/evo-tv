import "server-only";
import { localStorage, type StorageAdapter } from "./local";
import { vercelBlobStorage } from "./blob";

/**
 * Picks storage adapter at module-load time:
 * - Vercel Blob if BLOB_READ_WRITE_TOKEN is set (production / pulled local env).
 * - Local filesystem otherwise (local dev without Blob configured).
 */
export const storage: StorageAdapter = process.env.BLOB_READ_WRITE_TOKEN
  ? vercelBlobStorage
  : localStorage;

export type { StorageAdapter };
