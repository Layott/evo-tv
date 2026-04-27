import "server-only";
import crypto from "node:crypto";

const SECRET = process.env.AUTH_SECRET ?? "dev_stream_key_secret";

export function generateStreamKey(): string {
  const bytes = crypto.randomBytes(16).toString("hex");
  return `sk_live_${bytes}`;
}

export function hashStreamKey(key: string): string {
  return crypto.createHmac("sha256", SECRET).update(key).digest("hex");
}

export function compareStreamKey(key: string, hash: string): boolean {
  const expected = hashStreamKey(key);
  if (expected.length !== hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
}
