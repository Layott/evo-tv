import "server-only";
import { and, eq, isNull, or, gt, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type SanctionKind = "suspended" | "banned" | "chat_banned";

export const SANCTION_KINDS = ["suspended", "banned", "chat_banned"] as const;

/**
 * Active sanctions for a user: not reverted AND (no expiry OR expiry in future).
 * Returns the rows; callers decide whether to block based on `kind`.
 */
export async function activeSanctions(userId: string) {
  const nowIso = new Date().toISOString();
  return db
    .select()
    .from(schema.userSanctions)
    .where(
      and(
        eq(schema.userSanctions.userId, userId),
        isNull(schema.userSanctions.revertedAt),
        or(
          isNull(schema.userSanctions.expiresAt),
          gt(schema.userSanctions.expiresAt, nowIso),
        ),
      ),
    )
    .orderBy(desc(schema.userSanctions.createdAt));
}

export async function hasActiveSanction(
  userId: string,
  kind: SanctionKind,
): Promise<boolean> {
  const rows = await activeSanctions(userId);
  return rows.some((r) => r.kind === kind);
}

export async function isAccountBlocked(userId: string): Promise<boolean> {
  const rows = await activeSanctions(userId);
  return rows.some((r) => r.kind === "suspended" || r.kind === "banned");
}

export async function isChatBlocked(userId: string): Promise<boolean> {
  const rows = await activeSanctions(userId);
  return rows.some(
    (r) =>
      r.kind === "chat_banned" || r.kind === "suspended" || r.kind === "banned",
  );
}
