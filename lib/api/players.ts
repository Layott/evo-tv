import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Player } from "@/lib/types";

function toPlayer(r: typeof schema.players.$inferSelect): Player {
  return {
    id: r.id,
    handle: r.handle,
    realName: r.realName,
    avatarUrl: r.avatarUrl,
    teamId: r.teamId,
    gameId: r.gameId,
    role: r.role,
    country: r.country,
    kda: r.kda / 100,
    followers: r.followers,
  };
}

export async function listPlayers(filter?: {
  gameId?: string;
  teamId?: string;
}): Promise<Player[]> {
  const conds = [];
  if (filter?.gameId) conds.push(eq(schema.players.gameId, filter.gameId));
  if (filter?.teamId) conds.push(eq(schema.players.teamId, filter.teamId));
  const rows =
    conds.length > 0
      ? await db.select().from(schema.players).where(and(...conds))
      : await db.select().from(schema.players);
  return rows.map(toPlayer);
}

export async function getPlayerById(id: string): Promise<Player | null> {
  const r = (await db.select().from(schema.players).where(eq(schema.players.id, id)).limit(1))[0];
  return r ? toPlayer(r) : null;
}
