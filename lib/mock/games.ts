import type { Game } from "@/lib/types";
import { sleep, byId, bySlug } from "./_util";
import { gameCover, gameIcon } from "./_media";

export const games: Game[] = [
  {
    id: "game_freefire",
    slug: "free-fire",
    name: "Garena Free Fire",
    shortName: "Free Fire",
    coverUrl: gameCover("free-fire"),
    iconUrl: gameIcon("free-fire"),
    category: "br",
    platform: "mobile",
    activePlayers: 3_400_000,
  },
  {
    id: "game_codm",
    slug: "cod-mobile",
    name: "Call of Duty: Mobile",
    shortName: "CoD Mobile",
    coverUrl: gameCover("cod-mobile"),
    iconUrl: gameIcon("cod-mobile"),
    category: "fps",
    platform: "mobile",
    activePlayers: 1_800_000,
  },
  {
    id: "game_pubgm",
    slug: "pubg-mobile",
    name: "PUBG Mobile",
    shortName: "PUBG Mobile",
    coverUrl: gameCover("pubg-mobile"),
    iconUrl: gameIcon("pubg-mobile"),
    category: "br",
    platform: "mobile",
    activePlayers: 2_200_000,
  },
  {
    id: "game_eafc",
    slug: "ea-fc-mobile",
    name: "EA Sports FC Mobile",
    shortName: "EA FC Mobile",
    coverUrl: gameCover("ea-fc-mobile"),
    iconUrl: gameIcon("ea-fc-mobile"),
    category: "sports",
    platform: "mobile",
    activePlayers: 950_000,
  },
];

export async function listGames(): Promise<Game[]> {
  await sleep();
  return games;
}

export async function getGameById(id: string): Promise<Game | null> {
  await sleep();
  return byId(games, id);
}

export async function getGameBySlug(slug: string): Promise<Game | null> {
  await sleep();
  return bySlug(games, slug);
}
