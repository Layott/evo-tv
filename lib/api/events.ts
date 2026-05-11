import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { EsportsEvent, Match } from "@/lib/types";

function toEvent(
  r: typeof schema.events.$inferSelect,
  teamIds: string[]
): EsportsEvent {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    gameId: r.gameId,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: r.status as EsportsEvent["status"],
    tier: r.tier as EsportsEvent["tier"],
    bannerUrl: r.bannerUrl,
    thumbnailUrl: r.thumbnailUrl,
    description: r.description,
    prizePoolNgn: r.prizePoolNgn,
    teamIds,
    region: r.region,
    format: r.format,
    viewerCount: r.viewerCount,
  };
}

function toMatch(r: typeof schema.matches.$inferSelect): Match {
  return {
    id: r.id,
    eventId: r.eventId,
    teamAId: r.teamAId ?? "",
    teamBId: r.teamBId ?? "",
    scheduledAt: r.scheduledAt,
    state: r.state as Match["state"],
    scoreA: r.scoreA,
    scoreB: r.scoreB,
    round: r.round,
    bestOf: r.bestOf,
  };
}

async function teamsForEvent(eventId: string): Promise<string[]> {
  const rows = await db
    .select({ teamId: schema.eventTeams.teamId })
    .from(schema.eventTeams)
    .where(eq(schema.eventTeams.eventId, eventId));
  return rows.map((r) => r.teamId);
}

export async function listEvents(filter?: {
  status?: EsportsEvent["status"];
  gameId?: string;
}): Promise<EsportsEvent[]> {
  const conds = [];
  if (filter?.status) conds.push(eq(schema.events.status, filter.status));
  if (filter?.gameId) conds.push(eq(schema.events.gameId, filter.gameId));
  const rows =
    conds.length > 0
      ? await db.select().from(schema.events).where(and(...conds))
      : await db.select().from(schema.events);
  return Promise.all(rows.map(async (r) => toEvent(r, await teamsForEvent(r.id))));
}

export async function getEventById(id: string): Promise<EsportsEvent | null> {
  const r = (await db.select().from(schema.events).where(eq(schema.events.id, id)).limit(1))[0];
  return r ? toEvent(r, await teamsForEvent(r.id)) : null;
}

export async function getEventBySlug(slug: string): Promise<EsportsEvent | null> {
  const r = (await db.select().from(schema.events).where(eq(schema.events.slug, slug)).limit(1))[0];
  return r ? toEvent(r, await teamsForEvent(r.id)) : null;
}

export async function listMatchesForEvent(eventId: string): Promise<Match[]> {
  return (
    await db
      .select()
      .from(schema.matches)
      .where(eq(schema.matches.eventId, eventId))
  ).map(toMatch);
}
