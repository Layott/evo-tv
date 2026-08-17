import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface StorageAdapter {
  write(relativePath: string, data: Buffer | string): Promise<string>;
  read(relativePath: string): Promise<Buffer>;
  delete(relativePath: string): Promise<void>;
  exists(relativePath: string): Promise<boolean>;
  url(relativePath: string): string;
  signedUrl(relativePath: string, expiresInSec?: number): string;
  verifySigned(relativePath: string, token: string, expiry: number): boolean;
}

const ROOT = path.resolve(process.env.UPLOADS_DIR ?? "./uploads");
const SECRET = process.env.AUTH_SECRET ?? "dev_storage_secret";

function resolveSafe(relativePath: string): string {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = path.join(ROOT, normalized);
  if (!full.startsWith(ROOT)) throw new Error("path traversal detected");
  return full;
}

function sign(relativePath: string, expiry: number): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`${relativePath}:${expiry}`)
    .digest("hex");
}

export const localStorage: StorageAdapter = {
  /**
   * Returns a URL, not the key.
   *
   * Every caller persists whatever `write` hands back and later puts it in an
   * `<img src>`. The Spaces adapter returns a full public URL, so that is the
   * contract; this one returned the bare key, which the browser then resolved
   * against the current page. An avatar uploaded on a checkout with no Spaces
   * credentials was stored as `avatars/<id>/<file>.png` and every page that
   * tried to show it asked for `/admin/avatars/<id>/<file>.png` and got a 404.
   *
   * `url()` already knew the right answer and is reused so the two cannot
   * drift, and `ownedKeyFromUrl` already expected this prefix when working
   * backwards from a stored value.
   */
  async write(relativePath, data) {
    const full = resolveSafe(relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, data);
    return localStorage.url(relativePath);
  },
  async read(relativePath) {
    return fs.promises.readFile(resolveSafe(relativePath));
  },
  async delete(relativePath) {
    try {
      await fs.promises.unlink(resolveSafe(relativePath));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  },
  async exists(relativePath) {
    try {
      await fs.promises.access(resolveSafe(relativePath));
      return true;
    } catch {
      return false;
    }
  },
  url(relativePath) {
    return `/api/uploads/${relativePath.split(path.sep).join("/")}`;
  },
  signedUrl(relativePath, expiresInSec = 3600) {
    const expiry = Date.now() + expiresInSec * 1000;
    const token = sign(relativePath, expiry);
    return `${this.url(relativePath)}?t=${token}&e=${expiry}`;
  },
  verifySigned(relativePath, token, expiry) {
    if (Date.now() > expiry) return false;
    const expected = sign(relativePath, expiry);
    if (expected.length !== token.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  },
};
