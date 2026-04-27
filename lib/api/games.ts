import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Game } from "@/lib/types";

function toGame(r: typeof schema.games.$inferSelect): Game {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    shortName: r.shortName,
    coverUrl: r.coverUrl,
    iconUrl: r.iconUrl,
    category: r.category as Game["category"],
    platform: r.platform as Game["platform"],
    activePlayers: r.activePlayers,
  };
}

export async function listGames(): Promise<Game[]> {
  return db.select().from(schema.games).all().map(toGame);
}

export async function getGameById(id: string): Promise<Game | null> {
  const r = db.select().from(schema.games).where(eq(schema.games.id, id)).get();
  return r ? toGame(r) : null;
}

export async function getGameBySlug(slug: string): Promise<Game | null> {
  const r = db.select().from(schema.games).where(eq(schema.games.slug, slug)).get();
  return r ? toGame(r) : null;
}
