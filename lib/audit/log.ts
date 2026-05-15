import "server-only";
import crypto from "node:crypto";
import { type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";

export interface RecordAuditInput {
  actorUserId: string;
  /** Namespaced verb. Convention: `<domain>.<action>` (e.g. `stream.force_end`). */
  action: string;
  /** Lower-snake_case singular: `stream`, `user`, `channel`, `tip`, `role`, `order`. */
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
  ipHash?: string;
}

function genId(): string {
  return "aud_" + crypto.randomBytes(8).toString("hex");
}

export async function recordAudit(input: RecordAuditInput): Promise<void> {
  await db.insert(schema.adminAuditLog).values({
    id: genId(),
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    details: input.details ?? {},
    ipHash: input.ipHash,
  });
}

/** sha256 hex of the request's client IP. Returns `undefined` if unknowable. */
export function ipHashFromRequest(req: NextRequest): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0]?.trim() : null;
  if (!ip) return undefined;
  return crypto.createHash("sha256").update(ip).digest("hex");
}
