import type {
  EsportsEvent,
  Follow,
  FollowTarget,
  Game,
  NotificationItem,
  Order,
  Player,
  Profile,
  Stream,
  Subscription,
  Team,
  UserPrefs,
  Vod,
} from "@/lib/types";
import { apiGet, apiList, apiSend } from "./_fetch";

/**
 * Mirrors the interface in `lib/api/search.ts`, redeclared here because that
 * module is `server-only` and must not appear in a client import graph.
 */
export interface SearchResults {
  games: Game[];
  teams: Team[];
  players: Player[];
  events: EsportsEvent[];
  streams: Stream[];
  vods: Vod[];
}

/**
 * The signed-in user: profile, follows, notifications, orders, subscription,
 * plus global search.
 *
 * The old mock took a `userId` on almost every call. The real endpoints resolve
 * the session cookie server-side instead, so those arguments are accepted and
 * ignored rather than removed: keeping the signature identical is what lets a
 * page swap over by changing one import line.
 */

/* ── Profile ────────────────────────────────────────────────────────────── */

/**
 * Shape of `/api/users/me`. Deliberately spelled out: it is Better-Auth's user
 * row plus a few profile columns, and it does not match `Profile`.
 */
interface MeResponse {
  id: string;
  email?: string;
  name?: string | null;
  handle?: string | null;
  image?: string | null;
  role?: string;
  bio?: string;
  country?: string;
  onboardedAt?: string | null;
  createdAt?: string | null;
}

export async function getCurrentUser(): Promise<Profile | null> {
  const res = await apiGet<{ user: MeResponse }>("/api/users/me");
  const u = res?.user;
  if (!u) return null;

  /*
   * Map, do not cast.
   *
   * This did `res.user as Profile`, and the two shapes disagree on the two
   * fields most visible to a user: the endpoint returns Better-Auth's `image`
   * and `name`, while `Profile` reads `avatarUrl` and `displayName`. So
   * `profile.avatarUrl` was undefined, every avatar rendered as
   * `<img src="">`, and uploading a new picture changed nothing on screen
   * because the field being read was never populated in the first place.
   *
   * A cast asserts a shape rather than producing one, which is why TypeScript
   * had nothing to say about it.
   */
  return {
    id: u.id,
    handle: u.handle ?? "",
    displayName: u.name ?? u.handle ?? "",
    avatarUrl: u.image ?? "",
    bio: u.bio ?? "",
    role: (u.role as Profile["role"]) ?? "user",
    country: u.country ?? "NG",
    onboardedAt: u.onboardedAt ?? null,
    createdAt: u.createdAt ?? "",
  };
}

export async function getUserByHandle(handle: string): Promise<Profile | null> {
  return apiGet<Profile>(`/api/users/${encodeURIComponent(handle)}`);
}

/**
 * There is no by-id endpoint; handles are the public identifier. Call sites that
 * hold an id and not a handle get null rather than a wrong profile.
 */
export async function getUserById(id: string): Promise<Profile | null> {
  return apiGet<Profile>(`/api/users/${encodeURIComponent(id)}`);
}

export async function getUserPrefs(
  _userId?: string,
): Promise<UserPrefs | null> {
  return apiGet<UserPrefs>("/api/users/me/prefs");
}

export async function updateUserPrefs(
  prefs: Partial<UserPrefs>,
): Promise<UserPrefs | null> {
  return apiSend<UserPrefs>("PATCH", "/api/users/me/prefs", prefs);
}

/**
 * No endpoint searches users. `/api/search` covers games, teams, players,
 * events, streams and VODs only, and there is deliberately no public directory
 * of accounts. Returns empty rather than pretending.
 */
export async function searchUsers(_query: string): Promise<Profile[]> {
  return [];
}

export async function requestDataExport(
  _userId?: string,
): Promise<{ ticketId: string }> {
  return apiSend<{ ticketId: string }>("POST", "/api/users/me/export");
}

/* ── Follows ────────────────────────────────────────────────────────────── */

export async function listFollows(_userId?: string): Promise<Follow[]> {
  const res = await apiGet<{ follows: Follow[] }>("/api/follows");
  return res?.follows ?? [];
}

export async function isFollowing(
  _userId: string,
  targetId: string,
): Promise<boolean> {
  const follows = await listFollows();
  return follows.some(
    (f) => f.targetId === targetId || (f as { channelId?: string }).channelId === targetId,
  );
}

export async function toggleFollow(
  _userId: string,
  targetId: string,
  targetType: FollowTarget = "streamer",
): Promise<boolean> {
  const res = await apiSend<{ following: boolean }>("POST", "/api/follows", {
    targetId,
    targetType,
  });
  return res?.following ?? false;
}

/* ── Notifications ──────────────────────────────────────────────────────── */

export async function listNotifications(
  _userId?: string,
): Promise<NotificationItem[]> {
  const res = await apiGet<{ items: NotificationItem[]; unread: number }>(
    "/api/notifications",
  );
  return res?.items ?? [];
}

/** The endpoint already counts unread, so this does not re-derive it. */
export async function countUnread(_userId?: string): Promise<number> {
  const res = await apiGet<{ items: NotificationItem[]; unread: number }>(
    "/api/notifications",
  );
  return res?.unread ?? 0;
}

export async function markAsRead(id: string): Promise<void> {
  await apiSend<void>("POST", `/api/notifications/${encodeURIComponent(id)}/read`);
}

/** POST to the collection marks every notification read in one request. */
export async function markAllAsRead(_userId?: string): Promise<void> {
  await apiSend<void>("POST", "/api/notifications");
}

/* ── Commerce ───────────────────────────────────────────────────────────── */

export async function listOrdersForUser(_userId?: string): Promise<Order[]> {
  const res = await apiGet<{ orders: Order[] }>("/api/orders");
  return res?.orders ?? [];
}

export async function getOrderById(id: string): Promise<Order | null> {
  return apiGet<Order>(`/api/orders/${encodeURIComponent(id)}`);
}

export async function getActiveSubscription(
  _userId?: string,
): Promise<Subscription | null> {
  const res = await apiGet<{ subscription: Subscription | null }>(
    "/api/subscriptions/me",
  );
  return res?.subscription ?? null;
}

export async function listSubscriptionsForUser(
  _userId?: string,
): Promise<Subscription[]> {
  const active = await getActiveSubscription();
  return active ? [active] : [];
}

/* ── Search ─────────────────────────────────────────────────────────────── */

export async function globalSearch(query: string): Promise<SearchResults> {
  const empty: SearchResults = {
    games: [],
    teams: [],
    players: [],
    events: [],
    streams: [],
    vods: [],
  };
  if (!query.trim()) return empty;
  return (await apiGet<SearchResults>("/api/search", { q: query })) ?? empty;
}

export async function searchSuggestions(
  query: string,
  limit = 8,
): Promise<string[]> {
  if (!query.trim()) return [];
  return apiList<string>("/api/search", { q: query, suggest: 1, limit });
}

/**
 * Account deletion is a GDPR erasure request, not an immediate delete: the
 * `gdpr-purge` cron does the work on its next run. The endpoint records the
 * request and returns when it is scheduled for.
 */
export async function requestAccountDeletion(
  _userId?: string,
): Promise<{ scheduledForIso: string }> {
  return apiSend<{ scheduledForIso: string }>("POST", "/api/users/me/export", {
    erase: true,
  });
}
