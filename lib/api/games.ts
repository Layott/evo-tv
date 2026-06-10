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
    enabled: r.enabled,
    featured: r.featured,
    displayOrder: r.displayOrder,
  };
}

export async function listGames(): Promise<Game[]> {
  return (await db.select().from(schema.games)).map(toGame);
}

export async function getGameById(id: string): Promise<Game | null> {
  const r = (await db.select().from(schema.games).where(eq(schema.games.id, id)).limit(1))[0];
  return r ? toGame(r) : null;
}

export async function getGameBySlug(slug: string): Promise<Game | null> {
  const r = (await db.select().from(schema.games).where(eq(schema.games.slug, slug)).limit(1))[0];
  return r ? toGame(r) : null;
}
