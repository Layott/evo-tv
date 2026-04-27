import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export interface VodProgress {
  userId: string;
  vodId: string;
  positionSec: number;
  updatedAt: string;
}

export async function getProgress(userId: string, vodId: string): Promise<VodProgress | null> {
  const r = db
    .select()
    .from(schema.vodProgress)
    .where(
      and(
        eq(schema.vodProgress.userId, userId),
        eq(schema.vodProgress.vodId, vodId)
      )
    )
    .get();
  if (!r) return null;
  return {
    userId: r.userId,
    vodId: r.vodId,
    positionSec: r.positionSec,
    updatedAt: r.updatedAt,
  };
}

export async function upsertProgress(
  userId: string,
  vodId: string,
  positionSec: number
): Promise<void> {
  const nowIso = new Date().toISOString();
  db.insert(schema.vodProgress)
    .values({ userId, vodId, positionSec, updatedAt: nowIso })
    .onConflictDoUpdate({
      target: [schema.vodProgress.userId, schema.vodProgress.vodId],
      set: { positionSec, updatedAt: nowIso },
    })
    .run();
}

export async function listProgressForUser(userId: string, limit = 20): Promise<VodProgress[]> {
  return db
    .select()
    .from(schema.vodProgress)
    .where(eq(schema.vodProgress.userId, userId))
    .all()
    .slice(0, limit)
    .map((r) => ({
      userId: r.userId,
      vodId: r.vodId,
      positionSec: r.positionSec,
      updatedAt: r.updatedAt,
    }));
}
