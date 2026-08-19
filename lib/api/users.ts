import "server-only";
import { and, count, desc, eq, isNull, or, like } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Profile, UserPrefs, Role } from "@/lib/types";
import { getCurrentUser as sessionUser } from "@/lib/auth/guards";
import { firstNonEmpty, resolveAvatarUrl } from "@/lib/avatar";

type UserRow = typeof schema.user.$inferSelect;
type ProfileRow = typeof schema.profiles.$inferSelect;

export function toProfile(u: UserRow, p: ProfileRow | null | undefined): Profile {
  const role: Role = ((u.role as Role | null) ?? "user") as Role;
  const createdAt =
    typeof u.createdAt === "string" ? u.createdAt : new Date(u.createdAt).toISOString();
  return {
    id: u.id,
    handle: firstNonEmpty(u.handle, u.email.split("@")[0]) ?? u.id,
    email: u.email,
    /**
     * The email is the last resort and it is a poor one: it puts an address on
     * screen next to a public handle. It is still better than a blank where a
     * name should be, which is the "some names are missing" report.
     */
    displayName:
      firstNonEmpty(u.name, p?.displayName, u.handle) ?? u.email,
    /**
     * `??` here was the bug. Four code paths insert a `profiles` row with
     * `avatar_url: ""` when there is nothing to write, and `??` only falls
     * through on null, so an empty string won over a perfectly good
     * `user.image` and the UI got "" to put in `<img src>`. See lib/avatar.ts.
     */
    avatarUrl: resolveAvatarUrl(p?.avatarUrl, u.image) ?? "",
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

export interface PublicProfileClip {
  id: string;
  title: string;
  thumbnailUrl: string;
  durationSec: number;
  /** Staff only, stripped server-side. Absent is not the same as 0. */
  viewCount?: number;
  createdAt: string;
}

export interface PublicProfileVod {
  id: string;
  title: string;
  thumbnailUrl: string;
  durationSec: number;
  /** Staff only, stripped server-side. Absent is not the same as 0. */
  viewCount?: number;
  publishedAt: string;
}

export interface PublicProfileChannel {
  id: string;
  slug: string;
  name: string;
  logoUrl: string;
  category: string;
  isVerified: boolean;
  followerCount: number;
}

export interface PublicProfile {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  country: string;
  joinedAt: string;
  role: Role;
  followerCount: number;
  isFollowing: boolean;
  channels: PublicProfileChannel[];
  recentClips: PublicProfileClip[];
  recentVods: PublicProfileVod[];
}

/**
 * Public profile lookup by handle. Excludes soft-deleted users, never leaks
 * email or other private fields. Pulls follower count + recent creator clips
 * + owned channels for surfaces like `/u/[handle]`.
 *
 * `viewerId` (optional) - when present, hydrates `isFollowing` so signed-in
 * callers don't need a second round-trip.
 */
export async function getPublicProfileByHandle(
  handle: string,
  viewerId?: string,
): Promise<PublicProfile | null> {
  const rows = await db
    .select()
    .from(schema.user)
    .leftJoin(schema.profiles, eq(schema.user.id, schema.profiles.userId))
    .where(and(eq(schema.user.handle, handle), isNull(schema.user.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const base = toProfile(row.user, row.profiles);
  const userId = row.user.id;

  const [followerCountRow] = await db
    .select({ n: count() })
    .from(schema.follows)
    .where(
      and(
        eq(schema.follows.targetType, "streamer"),
        eq(schema.follows.targetId, userId),
      ),
    );
  const followerCount = Number(followerCountRow?.n ?? 0);

  let isFollowing = false;
  if (viewerId && viewerId !== userId) {
    const existing = await db
      .select({ userId: schema.follows.userId })
      .from(schema.follows)
      .where(
        and(
          eq(schema.follows.userId, viewerId),
          eq(schema.follows.targetType, "streamer"),
          eq(schema.follows.targetId, userId),
        ),
      )
      .limit(1);
    isFollowing = existing.length > 0;
  }

  const memberRows = await db
    .select({ publisherId: schema.publisherMembers.publisherId })
    .from(schema.publisherMembers)
    .where(eq(schema.publisherMembers.userId, userId));
  const publisherIds = memberRows.map((m) => m.publisherId);

  let channels: PublicProfileChannel[] = [];
  if (publisherIds.length > 0) {
    const chans = await db
      .select()
      .from(schema.channels)
      .where(
        and(
          isNull(schema.channels.suspendedAt),
          or(...publisherIds.map((pid) => eq(schema.channels.publisherId, pid))),
        ),
      );
    channels = chans.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      logoUrl: c.logoUrl ?? "",
      category: c.category ?? "",
      isVerified: c.isVerified ?? false,
      followerCount: c.followerCount ?? 0,
    }));
  }

  const clipRows = await db
    .select({
      id: schema.clips.id,
      title: schema.clips.title,
      thumbnailUrl: schema.clips.thumbnailUrl,
      durationSec: schema.clips.durationSec,
      viewCount: schema.clips.viewCount,
      createdAt: schema.clips.createdAt,
    })
    .from(schema.clips)
    .where(
      and(
        eq(schema.clips.creatorHandle, handle),
        isNull(schema.clips.deletedAt),
      ),
    )
    .orderBy(desc(schema.clips.createdAt))
    .limit(6);

  let recentVods: PublicProfileVod[] = [];
  if (channels.length > 0) {
    const vodRows = await db
      .select({
        id: schema.vods.id,
        title: schema.vods.title,
        thumbnailUrl: schema.vods.thumbnailUrl,
        durationSec: schema.vods.durationSec,
        viewCount: schema.vods.viewCount,
        publishedAt: schema.vods.publishedAt,
      })
      .from(schema.vods)
      .where(
        and(
          isNull(schema.vods.deletedAt),
          or(...channels.map((c) => eq(schema.vods.channelId, c.id))),
        ),
      )
      .orderBy(desc(schema.vods.publishedAt))
      .limit(6);
    recentVods = vodRows;
  }

  return {
    id: base.id,
    handle: base.handle,
    displayName: base.displayName,
    avatarUrl: base.avatarUrl,
    bio: base.bio,
    country: base.country,
    joinedAt: base.createdAt,
    role: base.role,
    followerCount,
    isFollowing,
    channels,
    recentClips: clipRows,
    recentVods,
  };
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
