import type { Follow, FollowTarget } from "@/lib/types";
import { sleep, now, daysAgo } from "./_util";

export const follows: Follow[] = [
  { userId: "user_current", targetType: "team", targetId: "team_alpha", createdAt: daysAgo(12) },
  { userId: "user_current", targetType: "player", targetId: "player_1", createdAt: daysAgo(10) },
  { userId: "user_premium", targetType: "team", targetId: "team_alpha", createdAt: daysAgo(40) },
  { userId: "user_premium", targetType: "team", targetId: "team_titan", createdAt: daysAgo(30) },
];

export async function listFollows(userId: string): Promise<Follow[]> {
  await sleep(50);
  return follows.filter((f) => f.userId === userId);
}

export async function isFollowing(
  userId: string,
  targetType: FollowTarget,
  targetId: string
): Promise<boolean> {
  await sleep(30);
  return follows.some(
    (f) =>
      f.userId === userId && f.targetType === targetType && f.targetId === targetId
  );
}

export async function toggleFollow(
  userId: string,
  targetType: FollowTarget,
  targetId: string
): Promise<boolean> {
  await sleep(80);
  const idx = follows.findIndex(
    (f) =>
      f.userId === userId && f.targetType === targetType && f.targetId === targetId
  );
  if (idx >= 0) {
    follows.splice(idx, 1);
    return false;
  }
  follows.push({ userId, targetType, targetId, createdAt: now() });
  return true;
}
