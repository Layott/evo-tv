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

function teamsForEvent(eventId: string): string[] {
  return db
    .select({ teamId: schema.eventTeams.teamId })
    .from(schema.eventTeams)
    .where(eq(schema.eventTeams.eventId, eventId))
    .all()
    .map((r) => r.teamId);
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
      ? db.select().from(schema.events).where(and(...conds)).all()
      : db.select().from(schema.events).all();
  return rows.map((r) => toEvent(r, teamsForEvent(r.id)));
}

export async function getEventById(id: string): Promise<EsportsEvent | null> {
  const r = db.select().from(schema.events).where(eq(schema.events.id, id)).get();
  return r ? toEvent(r, teamsForEvent(r.id)) : null;
}

export async function getEventBySlug(slug: string): Promise<EsportsEvent | null> {
  const r = db.select().from(schema.events).where(eq(schema.events.slug, slug)).get();
  return r ? toEvent(r, teamsForEvent(r.id)) : null;
}

export async function listMatchesForEvent(eventId: string): Promise<Match[]> {
  return db
    .select()
    .from(schema.matches)
    .where(eq(schema.matches.eventId, eventId))
    .all()
    .map(toMatch);
}
