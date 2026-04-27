import type { Player } from "@/lib/types";
import { sleep, byId } from "./_util";
import { playerAvatar } from "./_media";

const handles = [
  "Viper", "Shadow", "Blaze", "Havoc", "Rex", "Zen", "Kairo", "Drift",
  "Nebula", "Echo", "Thorn", "Vex", "Onyx", "Raze", "Saber", "Kite",
  "Glint", "Mira", "Talon", "Pulse", "Rift", "Crux", "Ember", "Flux",
  "Ghost", "Halo", "Ink", "Juno", "Koda", "Lyric", "Mace", "Nyx",
  "Orbit", "Prism", "Quake", "Rune", "Scar", "Tyro", "Umbra", "Volt",
];

const realNames = [
  "Samuel Okafor", "Chinedu Eze", "Tunde Bakare", "Musa Ibrahim",
  "Kwame Asante", "Kofi Mensah", "Kelechi Obi", "Femi Adeyemi",
  "Ahmed Hassan", "Mohamed Ali", "Nelson Mwangi", "David Otieno",
  "Paul Nkomo", "Sipho Dlamini", "Liam Dubois", "Amadou Diallo",
  "Isaac Nwankwo", "Emeka Onu", "Daniel Okoro", "Segun Adebayo",
  "Rashid Bello", "Yusuf Lawal", "Ibrahim Sani", "Ismail Tijani",
  "Peter Owusu", "Richmond Amoah", "Kojo Boateng", "Nana Agyeman",
  "Eric Mbeki", "Thabo Moloi", "Zane Pretorius", "Jabari Ndovu",
  "Khalid Amin", "Mostafa Said", "Omar Farouk", "Tarek Hamdi",
  "Zoheir Ben", "Karim Ait", "Youssef Rachid", "Anas Tazi",
];

const roles = [
  "IGL", "Rusher", "Sniper", "Support", "Fragger", "Flex",
  "Entry", "Awper", "Assault", "Scout",
];

const countries = ["NG", "GH", "KE", "ZA", "EG", "MA", "SN", "CI"];

function makePlayer(idx: number): Player {
  const teamIdx = idx % 12;
  const gameIdx = Math.floor(teamIdx / 3);
  const gameIds = ["game_freefire", "game_codm", "game_pubgm", "game_eafc"];
  const teamIds = [
    "team_alpha", "team_nova", "team_apex", "team_vortex",
    "team_titan", "team_specter", "team_rogue",
    "team_zenith", "team_hydra",
    "team_vanguard", "team_stride", "team_eclipse",
  ];
  return {
    id: `player_${idx + 1}`,
    handle: handles[idx]!,
    realName: realNames[idx]!,
    avatarUrl: playerAvatar(handles[idx]!),
    teamId: teamIds[teamIdx]!,
    gameId: gameIds[gameIdx % gameIds.length]!,
    role: roles[idx % roles.length]!,
    country: countries[idx % countries.length]!,
    kda: Math.round((1.2 + Math.random() * 3.8) * 100) / 100,
    followers: Math.round(2_000 + Math.random() * 28_000),
  };
}

export const players: Player[] = Array.from({ length: 40 }, (_, i) => makePlayer(i));

export async function listPlayers(filter?: { gameId?: string; teamId?: string }): Promise<Player[]> {
  await sleep();
  let result = players;
  if (filter?.gameId) result = result.filter((p) => p.gameId === filter.gameId);
  if (filter?.teamId) result = result.filter((p) => p.teamId === filter.teamId);
  return result;
}

export async function getPlayerById(id: string): Promise<Player | null> {
  await sleep();
  return byId(players, id);
}
