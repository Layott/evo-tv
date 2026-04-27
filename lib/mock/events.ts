import type { EsportsEvent, Match } from "@/lib/types";
import { sleep, byId, bySlug, hoursAhead, hoursAgo, daysAhead, daysAgo } from "./_util";
import { eventBanner, eventThumb } from "./_media";

export const events: EsportsEvent[] = [
  {
    id: "event_afc_championship",
    slug: "afc-championship-2026",
    title: "EVO Championship 2026 — Grand Finals",
    gameId: "game_freefire",
    startsAt: hoursAhead(2),
    endsAt: hoursAhead(8),
    status: "scheduled",
    tier: "s",
    bannerUrl: eventBanner("event_afc_championship"),
    thumbnailUrl: eventThumb("event_afc_championship"),
    description:
      "The flagship Free Fire tournament of the African Esports Federation. Sixteen teams, one crown, ₦120M prize pool.",
    prizePoolNgn: 120_000_000,
    teamIds: ["team_alpha", "team_nova", "team_apex", "team_vortex", "team_eclipse"],
    region: "Africa",
    format: "Double elimination, Bo5 finals",
    viewerCount: 0,
  },
  {
    id: "event_ff_lagos",
    slug: "ff-lagos-invitational",
    title: "Free Fire Lagos Invitational",
    gameId: "game_freefire",
    startsAt: hoursAgo(1),
    endsAt: hoursAhead(3),
    status: "live",
    tier: "a",
    bannerUrl: eventBanner("event_ff_lagos"),
    thumbnailUrl: eventThumb("event_ff_lagos"),
    description:
      "West African regional showdown. Live from the Eko Convention Centre.",
    prizePoolNgn: 25_000_000,
    teamIds: ["team_alpha", "team_nova", "team_vortex", "team_eclipse"],
    region: "West Africa",
    format: "Single elimination, Bo3",
    viewerCount: 18_420,
  },
  {
    id: "event_codm_cairo",
    slug: "codm-cairo-cup",
    title: "CoD Mobile Cairo Cup",
    gameId: "game_codm",
    startsAt: daysAhead(1),
    endsAt: daysAhead(2),
    status: "scheduled",
    tier: "a",
    bannerUrl: eventBanner("event_codm_cairo"),
    thumbnailUrl: eventThumb("event_codm_cairo"),
    description: "North Africa's premier CoD Mobile cup. Eight teams, ₦15M pool.",
    prizePoolNgn: 15_000_000,
    teamIds: ["team_titan", "team_specter", "team_rogue"],
    region: "North Africa",
    format: "Round robin + top 4 playoff",
    viewerCount: 0,
  },
  {
    id: "event_pubgm_nairobi",
    slug: "pubgm-nairobi-open",
    title: "PUBG Mobile Nairobi Open",
    gameId: "game_pubgm",
    startsAt: daysAhead(3),
    endsAt: daysAhead(5),
    status: "scheduled",
    tier: "b",
    bannerUrl: eventBanner("event_pubgm_nairobi"),
    thumbnailUrl: eventThumb("event_pubgm_nairobi"),
    description: "East Africa open qualifier. Top 2 advance to continental finals.",
    prizePoolNgn: 8_000_000,
    teamIds: ["team_zenith", "team_hydra"],
    region: "East Africa",
    format: "Squad SQ-TPP, 16 teams × 4 matches",
    viewerCount: 0,
  },
  {
    id: "event_eafc_fc_cup",
    slug: "eafc-continental-cup",
    title: "EA FC Continental Cup",
    gameId: "game_eafc",
    startsAt: daysAhead(7),
    endsAt: daysAhead(9),
    status: "scheduled",
    tier: "b",
    bannerUrl: eventBanner("event_eafc_fc_cup"),
    thumbnailUrl: eventThumb("event_eafc_fc_cup"),
    description: "1v1 continental cup across EA Sports FC Mobile.",
    prizePoolNgn: 5_000_000,
    teamIds: ["team_vanguard", "team_stride"],
    region: "Africa",
    format: "Single elimination, Bo3",
    viewerCount: 0,
  },
  {
    id: "event_afc_qualifier_east",
    slug: "afc-east-qualifier",
    title: "EVO East Africa Qualifier",
    gameId: "game_freefire",
    startsAt: daysAgo(3),
    endsAt: daysAgo(2),
    status: "completed",
    tier: "a",
    bannerUrl: eventBanner("event_afc_qualifier_east"),
    thumbnailUrl: eventThumb("event_afc_qualifier_east"),
    description: "East Africa path into EVO Championship.",
    prizePoolNgn: 12_000_000,
    teamIds: ["team_apex"],
    region: "East Africa",
    format: "BR ladder 12 squads",
    viewerCount: 0,
  },
  {
    id: "event_ff_accra",
    slug: "ff-accra-showdown",
    title: "Free Fire Accra Showdown",
    gameId: "game_freefire",
    startsAt: daysAgo(7),
    endsAt: daysAgo(6),
    status: "completed",
    tier: "b",
    bannerUrl: eventBanner("event_ff_accra"),
    thumbnailUrl: eventThumb("event_ff_accra"),
    description: "Community showcase sponsored by EVO Originals.",
    prizePoolNgn: 3_500_000,
    teamIds: ["team_apex", "team_eclipse"],
    region: "West Africa",
    format: "Exhibition",
    viewerCount: 0,
  },
  {
    id: "event_pubgm_casablanca",
    slug: "pubgm-casablanca",
    title: "PUBG Mobile Casablanca Classic",
    gameId: "game_pubgm",
    startsAt: hoursAgo(2),
    endsAt: hoursAhead(4),
    status: "live",
    tier: "a",
    bannerUrl: eventBanner("event_pubgm_casablanca"),
    thumbnailUrl: eventThumb("event_pubgm_casablanca"),
    description: "The North African PUBG Mobile classic returns for its third edition.",
    prizePoolNgn: 22_000_000,
    teamIds: ["team_zenith", "team_hydra"],
    region: "North Africa",
    format: "BR ladder",
    viewerCount: 7_280,
  },
];

export const matches: Match[] = [
  { id: "match_1", eventId: "event_ff_lagos", teamAId: "team_alpha", teamBId: "team_nova", scheduledAt: hoursAgo(1), state: "live", scoreA: 2, scoreB: 1, round: "Semifinal 1", bestOf: 5 },
  { id: "match_2", eventId: "event_ff_lagos", teamAId: "team_vortex", teamBId: "team_eclipse", scheduledAt: hoursAhead(1), state: "scheduled", scoreA: 0, scoreB: 0, round: "Semifinal 2", bestOf: 5 },
  { id: "match_3", eventId: "event_ff_lagos", teamAId: "team_alpha", teamBId: "team_vortex", scheduledAt: hoursAhead(3), state: "scheduled", scoreA: 0, scoreB: 0, round: "Final", bestOf: 5 },
  { id: "match_4", eventId: "event_pubgm_casablanca", teamAId: "team_zenith", teamBId: "team_hydra", scheduledAt: hoursAgo(1), state: "live", scoreA: 1, scoreB: 1, round: "Grand Final", bestOf: 3 },
];

export async function listEvents(filter?: {
  status?: EsportsEvent["status"];
  gameId?: string;
}): Promise<EsportsEvent[]> {
  await sleep();
  let result = events;
  if (filter?.status) result = result.filter((e) => e.status === filter.status);
  if (filter?.gameId) result = result.filter((e) => e.gameId === filter.gameId);
  return result;
}

export async function getEventById(id: string): Promise<EsportsEvent | null> {
  await sleep();
  return byId(events, id);
}

export async function getEventBySlug(slug: string): Promise<EsportsEvent | null> {
  await sleep();
  return bySlug(events, slug);
}

export async function listMatchesForEvent(eventId: string): Promise<Match[]> {
  await sleep();
  return matches.filter((m) => m.eventId === eventId);
}
