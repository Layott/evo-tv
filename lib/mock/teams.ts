import type { Team } from "@/lib/types";
import { sleep, byId, bySlug } from "./_util";
import { teamLogo } from "./_media";

export const teams: Team[] = [
  { id: "team_alpha", slug: "team-alpha", name: "Team Alpha", tag: "ALPHA", logoUrl: teamLogo("team-alpha"), country: "NG", region: "West Africa", gameId: "game_freefire", ranking: 1, followers: 42_800, wins: 84, losses: 12 },
  { id: "team_nova", slug: "nova-esports", name: "Nova Esports", tag: "NOVA", logoUrl: teamLogo("nova-esports"), country: "NG", region: "West Africa", gameId: "game_freefire", ranking: 2, followers: 38_100, wins: 78, losses: 18 },
  { id: "team_apex", slug: "apex-legends-ng", name: "Apex Predators", tag: "APEX", logoUrl: teamLogo("apex-legends-ng"), country: "GH", region: "West Africa", gameId: "game_freefire", ranking: 3, followers: 28_400, wins: 64, losses: 24 },
  { id: "team_vortex", slug: "vortex-gaming", name: "Vortex Gaming", tag: "VTX", logoUrl: teamLogo("vortex-gaming"), country: "NG", region: "West Africa", gameId: "game_freefire", ranking: 4, followers: 22_100, wins: 52, losses: 30 },
  { id: "team_titan", slug: "titan-esports", name: "Titan Esports", tag: "TTN", logoUrl: teamLogo("titan-esports"), country: "KE", region: "East Africa", gameId: "game_codm", ranking: 1, followers: 31_600, wins: 71, losses: 19 },
  { id: "team_specter", slug: "specter-ops", name: "Specter Ops", tag: "SPC", logoUrl: teamLogo("specter-ops"), country: "ZA", region: "Southern Africa", gameId: "game_codm", ranking: 2, followers: 26_300, wins: 60, losses: 22 },
  { id: "team_rogue", slug: "rogue-squadron", name: "Rogue Squadron", tag: "RGE", logoUrl: teamLogo("rogue-squadron"), country: "NG", region: "West Africa", gameId: "game_codm", ranking: 3, followers: 19_800, wins: 48, losses: 26 },
  { id: "team_zenith", slug: "zenith-pubg", name: "Zenith", tag: "ZNT", logoUrl: teamLogo("zenith-pubg"), country: "EG", region: "North Africa", gameId: "game_pubgm", ranking: 1, followers: 29_400, wins: 68, losses: 20 },
  { id: "team_hydra", slug: "hydra-gaming", name: "Hydra Gaming", tag: "HYD", logoUrl: teamLogo("hydra-gaming"), country: "MA", region: "North Africa", gameId: "game_pubgm", ranking: 2, followers: 24_700, wins: 58, losses: 28 },
  { id: "team_vanguard", slug: "vanguard-fc", name: "Vanguard FC", tag: "VGD", logoUrl: teamLogo("vanguard-fc"), country: "NG", region: "West Africa", gameId: "game_eafc", ranking: 1, followers: 18_200, wins: 42, losses: 14 },
  { id: "team_stride", slug: "stride-esports", name: "Stride Esports", tag: "STR", logoUrl: teamLogo("stride-esports"), country: "SN", region: "West Africa", gameId: "game_eafc", ranking: 2, followers: 15_900, wins: 38, losses: 18 },
  { id: "team_eclipse", slug: "eclipse-ff", name: "Eclipse", tag: "ECL", logoUrl: teamLogo("eclipse-ff"), country: "CI", region: "West Africa", gameId: "game_freefire", ranking: 5, followers: 17_300, wins: 40, losses: 36 },
];

export async function listTeams(filter?: { gameId?: string }): Promise<Team[]> {
  await sleep();
  if (filter?.gameId) return teams.filter((t) => t.gameId === filter.gameId);
  return teams;
}

export async function getTeamById(id: string): Promise<Team | null> {
  await sleep();
  return byId(teams, id);
}

export async function getTeamBySlug(slug: string): Promise<Team | null> {
  await sleep();
  return bySlug(teams, slug);
}
