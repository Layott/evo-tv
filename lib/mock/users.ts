import type { Profile, UserPrefs, Role } from "@/lib/types";
import { sleep, byId, daysAgo } from "./_util";
import { userAvatar } from "./_media";

export const profiles: Profile[] = [
  {
    id: "user_current",
    handle: "evo_fan",
    displayName: "Ade Nipebi",
    avatarUrl: userAvatar("evo_fan"),
    bio: "Free Fire diehard. Team Alpha forever. Lagos-based.",
    role: "user",
    country: "NG",
    onboardedAt: daysAgo(14),
    createdAt: daysAgo(30),
  },
  {
    id: "user_admin",
    handle: "evo_admin",
    displayName: "EVO Admin",
    avatarUrl: userAvatar("evo_admin"),
    bio: "Running the show.",
    role: "admin",
    country: "NG",
    onboardedAt: daysAgo(90),
    createdAt: daysAgo(120),
  },
  {
    id: "user_premium",
    handle: "pro_watcher",
    displayName: "Chinedu Pro",
    avatarUrl: userAvatar("pro_watcher"),
    bio: "Premium sub, never misses a finals.",
    role: "premium",
    country: "NG",
    onboardedAt: daysAgo(45),
    createdAt: daysAgo(60),
  },
  ...Array.from({ length: 20 }, (_, i) => ({
    id: `user_${i + 10}`,
    handle: `viewer${i + 10}`,
    displayName: `Viewer ${i + 10}`,
    avatarUrl: userAvatar(`viewer${i + 10}`),
    bio: "",
    role: "user" as Role,
    country: "NG",
    onboardedAt: daysAgo(i + 1),
    createdAt: daysAgo(i + 5),
  })),
];

export const userPrefs: Record<string, UserPrefs> = {
  user_current: {
    userId: "user_current",
    favoriteGames: ["game_freefire"],
    favoriteTeams: ["team_alpha"],
    favoritePlayers: ["player_1"],
    notifOptIn: { goLive: true, eventReminder: true, newVod: true, weeklyDigest: false },
    playback: { defaultQuality: "auto", captions: false, autoplay: true },
    language: "en",
    theme: "dark",
  },
  user_premium: {
    userId: "user_premium",
    favoriteGames: ["game_freefire", "game_codm"],
    favoriteTeams: ["team_alpha", "team_titan"],
    favoritePlayers: ["player_1", "player_5"],
    notifOptIn: { goLive: true, eventReminder: true, newVod: true, weeklyDigest: true },
    playback: { defaultQuality: "1080p", captions: true, autoplay: true },
    language: "en",
    theme: "dark",
  },
};

export async function getCurrentUser(): Promise<Profile | null> {
  await sleep(100);
  return profiles[0]!;
}

export async function getUserById(id: string): Promise<Profile | null> {
  await sleep();
  return byId(profiles, id);
}

export async function getUserByHandle(handle: string): Promise<Profile | null> {
  await sleep();
  return profiles.find((p) => p.handle === handle) ?? null;
}

export async function getUserPrefs(userId: string): Promise<UserPrefs | null> {
  await sleep(50);
  return userPrefs[userId] ?? null;
}

export async function searchUsers(query: string): Promise<Profile[]> {
  await sleep();
  const q = query.toLowerCase();
  return profiles.filter(
    (p) =>
      p.handle.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q)
  );
}

// In-memory account-action queue (mock only — Phase 1A swaps for real BA + worker).
const accountActions: Array<{ kind: "delete" | "export"; userId: string; at: string }> = [];

export async function requestAccountDeletion(userId: string): Promise<{ scheduledForIso: string }> {
  await sleep(150);
  const at = new Date().toISOString();
  accountActions.push({ kind: "delete", userId, at });
  const scheduled = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  return { scheduledForIso: scheduled };
}

export async function requestDataExport(userId: string): Promise<{ ticketId: string }> {
  await sleep(150);
  const at = new Date().toISOString();
  accountActions.push({ kind: "export", userId, at });
  const ticketId = `EXPORT-${userId}-${Date.now().toString(36)}`;
  return { ticketId };
}

export function getAccountActions() {
  return accountActions.slice();
}
