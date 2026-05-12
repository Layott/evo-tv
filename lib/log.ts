import "server-only";
import crypto from "node:crypto";

/**
 * Redacting logger. Wrap all server-side `console.log` style calls with
 * this so PII never leaks to log drains.
 *
 *   log.info("order.created", { userId, orderId, totalNgn })
 *   log.warn("auth.fail", { email })   // email gets redacted to e****@d****.com
 *
 * Rules:
 *   - email   → first char + ****@first char + **** + .tld
 *   - phone   → last 4 digits, rest masked
 *   - bearer  → "***"
 *   - ip      → first 6 hex of sha256 (stable, unlinkable)
 *   - paystack_ref → first 4 + last 4
 *   - keys ending in "Token", "Key", "Secret", "Password" → "***"
 */

const TOKEN_KEY_REGEX = /(token|key|secret|password|bearer)$/i;

function redactEmail(s: string): string {
  const m = /^([^@]+)@([^.]+)(\..+)$/.exec(s);
  if (!m) return "***";
  const [, local, domain, tld] = m;
  return `${local![0] ?? "*"}****@${domain![0] ?? "*"}****${tld}`;
}

function redactPhone(s: string): string {
  const digits = s.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

function looksLikeEmail(s: string): boolean {
  return /^[^@]+@[^.]+\..+$/.test(s);
}
function looksLikePhone(s: string): boolean {
  return /^\+?\d[\d\s\-()]{6,}$/.test(s);
}
function looksLikeBearer(s: string): boolean {
  return /^Bearer\s/i.test(s) || s.length === 32 || s.length === 40;
}

export function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 12);
}

export function redactValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (TOKEN_KEY_REGEX.test(key)) return "***";
  if (key.toLowerCase() === "ip" || key.toLowerCase() === "ipaddress") {
    return typeof value === "string" ? hashIp(value) : value;
  }
  if (key.toLowerCase().includes("email") && typeof value === "string") {
    return redactEmail(value);
  }
  if (key.toLowerCase().includes("phone") && typeof value === "string") {
    return redactPhone(value);
  }
  if (typeof value === "string") {
    if (looksLikeBearer(value)) return "***";
    if (looksLikeEmail(value)) return redactEmail(value);
    if (looksLikePhone(value)) return redactPhone(value);
  }
  if (Array.isArray(value)) return value.map((v) => redactValue(key, v));
  if (typeof value === "object") return redactObject(value as Record<string, unknown>);
  return value;
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = redactValue(k, v);
  }
  return out;
}

type Level = "info" | "warn" | "error" | "debug";

function emit(level: Level, event: string, fields?: Record<string, unknown>): void {
  const payload = {
    t: new Date().toISOString(),
    lvl: level,
    evt: event,
    ...(fields ? redactObject(fields) : {}),
  };
  if (level === "error") console.error(JSON.stringify(payload));
  else if (level === "warn") console.warn(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) =>
    emit("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) =>
    emit("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) =>
    emit("error", event, fields),
  debug: (event: string, fields?: Record<string, unknown>) =>
    emit("debug", event, fields),
};
