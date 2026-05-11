import "server-only";
import { eq, or, like } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Profile, UserPrefs, Role } from "@/lib/types";
import { getCurrentUser as sessionUser } from "@/lib/auth/guards";

type UserRow = typeof schema.user.$inferSelect;
type ProfileRow = typeof schema.profiles.$inferSelect;

function toProfile(u: UserRow, p: ProfileRow | null | undefined): Profile {
  const role: Role = ((u.role as Role | null) ?? "user") as Role;
  const createdAt =
    typeof u.createdAt === "string" ? u.createdAt : new Date(u.createdAt).toISOString();
  return {
    id: u.id,
    handle: u.handle ?? u.email.split("@")[0] ?? u.id,
    displayName: u.name || p?.displayName || u.email,
    avatarUrl: p?.avatarUrl ?? u.image ?? "",
    bio: p?.bio ?? "",
    role,
    country: p?.country ?? "NG",
    onboardedAt: p?.onboardedAt ?? null,
    createdAt,
  };
}

export async function getCurrentUser(): Promise<Profile | null> {
  const session = await sessionUser();
  if (!session) return null;
  return getUserById(session.id);
}

export async function getUserById(id: string): Promise<Profile | null> {
  const rows = await db
    .select()
    .from(schema.user)
    .leftJoin(schema.profiles, eq(schema.user.id, schema.profiles.userId))
    .where(eq(schema.user.id, id));
  const row = rows[0];
  if (!row) return null;
  return toProfile(row.user, row.profiles);
}

export async function getUserByHandle(handle: string): Promise<Profile | null> {
  const rows = await db
    .select()
    .from(schema.user)
    .leftJoin(schema.profiles, eq(schema.user.id, schema.profiles.userId))
    .where(eq(schema.user.handle, handle));
  const row = rows[0];
  if (!row) return null;
  return toProfile(row.user, row.profiles);
}

export async function getUserPrefs(userId: string): Promise<UserPrefs | null> {
  const row = (
    await db
      .select()
      .from(schema.userPrefs)
      .where(eq(schema.userPrefs.userId, userId))
      .limit(1)
  )[0];
  if (!row) return null;
  return {
    userId: row.userId,
    favoriteGames: row.favoriteGames,
    favoriteTeams: row.favoriteTeams,
    favoritePlayers: row.favoritePlayers,
    notifOptIn: row.notifOptIn,
    playback: row.playback,
    language: row.language as UserPrefs["language"],
    theme: row.theme as UserPrefs["theme"],
  };
}

export async function searchUsers(query: string): Promise<Profile[]> {
  const q = `%${query.toLowerCase()}%`;
  const rows = await db
    .select()
    .from(schema.user)
    .leftJoin(schema.profiles, eq(schema.user.id, schema.profiles.userId))
    .where(
      or(
        like(schema.user.handle, q),
        like(schema.user.name, q),
        like(schema.user.email, q)
      )
    );
  return rows.map((r) => toProfile(r.user, r.profiles));
}

export async function upsertPrefs(
  userId: string,
  prefs: Omit<UserPrefs, "userId">
): Promise<void> {
  await db
    .insert(schema.userPrefs)
    .values({ userId, ...prefs })
    .onConflictDoUpdate({
      target: schema.userPrefs.userId,
      set: prefs,
    });
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, "displayName" | "avatarUrl" | "bio" | "country">>
): Promise<void> {
  if (patch.displayName !== undefined) {
    await db
      .update(schema.user)
      .set({ name: patch.displayName, updatedAt: new Date() })
      .where(eq(schema.user.id, userId));
  }
  const existing = (
    await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1)
  )[0];
  if (existing) {
    await db
      .update(schema.profiles)
      .set({
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
        ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
        ...(patch.country !== undefined ? { country: patch.country } : {}),
      })
      .where(eq(schema.profiles.userId, userId));
  } else {
    await db
      .insert(schema.profiles)
      .values({
        userId,
        displayName: patch.displayName ?? "",
        avatarUrl: patch.avatarUrl ?? "",
        bio: patch.bio ?? "",
        country: patch.country ?? "NG",
        onboardedAt: null,
        createdAt: new Date().toISOString(),
      });
  }
}

export async function markOnboarded(userId: string): Promise<void> {
  const iso = new Date().toISOString();
  const existing = (
    await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1)
  )[0];
  if (existing) {
    await db
      .update(schema.profiles)
      .set({ onboardedAt: iso })
      .where(eq(schema.profiles.userId, userId));
  } else {
    const u = (await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1))[0];
    await db
      .insert(schema.profiles)
      .values({
        userId,
        displayName: u?.name ?? "",
        avatarUrl: u?.image ?? "",
        bio: "",
        country: "NG",
        onboardedAt: iso,
        createdAt: iso,
      });
  }
}
