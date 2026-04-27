import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Team } from "@/lib/types";

function toTeam(r: typeof schema.teams.$inferSelect): Team {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    tag: r.tag,
    logoUrl: r.logoUrl,
    country: r.country,
    region: r.region,
    gameId: r.gameId,
    ranking: r.ranking,
    followers: r.followers,
    wins: r.wins,
    losses: r.losses,
  };
}

export async function listTeams(filter?: { gameId?: string }): Promise<Team[]> {
  const rows = filter?.gameId
    ? db.select().from(schema.teams).where(eq(schema.teams.gameId, filter.gameId)).all()
    : db.select().from(schema.teams).all();
  return rows.map(toTeam);
}

export async function getTeamById(id: string): Promise<Team | null> {
  const r = db.select().from(schema.teams).where(eq(schema.teams.id, id)).get();
  return r ? toTeam(r) : null;
}

export async function getTeamBySlug(slug: string): Promise<Team | null> {
  const r = db.select().from(schema.teams).where(eq(schema.teams.slug, slug)).get();
  return r ? toTeam(r) : null;
}
