import type {
  Ad,
  FeatureFlag,
  EsportsEvent,
  Game,
  Order,
  Player,
  Poll,
  Product,
  Profile,
  Stream,
  Team,
  Vod,
} from "@/lib/types";
import type { PlatformRole } from "@/lib/auth/role-catalog";
import { apiGet, apiSend } from "./_fetch";

/**
 * The admin control surface.
 *
 * This is the loop that matters for launch: an admin creates a stream, event,
 * product or ad here, it lands in Postgres, and the public site reads it back
 * through `lib/client/catalog.ts`. Nothing here is seeded or invented.
 *
 * Every route under `/api/admin/*` requires an admin session and 403s otherwise,
 * so these calls throw for a non-admin rather than silently doing nothing.
 */

/* ── Streams ────────────────────────────────────────────────────────────── */

export interface AdminListOptions {
  limit?: number;
  offset?: number;
  /** Omit for active only, "include" for both, "only" for deleted. */
  deleted?: "only" | "include";
}

export async function adminListStreams(
  opts: AdminListOptions & { gameId?: string; isLive?: boolean } = {},
): Promise<{ streams: Stream[]; total: number }> {
  const res = await apiGet<{ streams: Stream[]; total: number }>(
    "/api/admin/streams",
    {
      gameId: opts.gameId,
      isLive: opts.isLive,
      deleted: opts.deleted,
      limit: opts.limit ?? 100,
      offset: opts.offset ?? 0,
    },
  );
  return res ?? { streams: [], total: 0 };
}

export interface CreateStreamInput {
  title: string;
  /** Null for anime, lifestyle and podcast programmes, which have no game. */
  gameId?: string | null;
  /** What the programme is. Drives the schedule and week-grid filters. */
  pillar?: "esports" | "anime" | "lifestyle";
  streamerName: string;
  description?: string;
  eventId?: string | null;
  streamerAvatarUrl?: string;
  /** Poster shown wherever the stream is listed before it goes live. */
  thumbnailUrl?: string;
  language?: string;
  tags?: string[];
  isPremium?: boolean;
  maturityRating?: "kids" | "pg" | "teen" | "mature";
  contentTags?: string[];
}

/** Returns the created stream and its one-time stream key. */
/**
 * What an operator puts into OBS. Both fields, because a key on its own is
 * useless: OBS wants Server and Stream Key and will not start without both.
 */
export interface IngestDetails {
  kind: "manual" | "cloudflare" | "rtmp";
  /** OBS: Settings, Stream, Service Custom, Server. */
  server: string | null;
  /** OBS: Stream Key. */
  streamKey: string | null;
  srtUrl?: string | null;
  /** Where viewers watch. Empty until the ingest is provisioned. */
  hlsUrl: string;
  /** False when the key is stored as a hash and cannot be shown twice. */
  keyRetrievable: boolean;
}

export async function adminCreateStream(
  input: CreateStreamInput & { ingestKind?: IngestDetails["kind"] },
): Promise<{
  id: string;
  ingest: IngestDetails;
  streamKey?: string;
  ingestError?: string | null;
  warning?: string | null;
}> {
  return apiSend("POST", "/api/admin/streams", input);
}

/**
 * Re-read the OBS settings for a stream that already exists.
 *
 * Create shows them once. An operator who closed that dialog, or who is setting
 * up a second encoder, had no way back to them.
 */
export async function adminGetStreamIngest(
  id: string,
): Promise<IngestDetails | null> {
  const res = await apiGet<{ ingest: IngestDetails }>(
    `/api/admin/streams/${encodeURIComponent(id)}/ingest`,
  );
  return res?.ingest ?? null;
}

export async function adminUpdateStream(
  id: string,
  patch: Partial<CreateStreamInput> & {
    isLive?: boolean;
    /** Promote this stream to the flagship. The API demotes the incumbent. */
    isMainChannel?: boolean;
    posterUrl?: string;
    tagline?: string;
    /** Force-end a broadcast, or bring one back on air. */
    endedAt?: string | null;
    /** Where the scheduled playout reads the file from. */
    playoutFilePath?: string | null;
    scheduledStartAt?: string | null;
    scheduledDurationMin?: number | null;
    /** The manifest viewers play, for a manually configured ingest. */
    hlsPath?: string;
  },
): Promise<{ stream: Stream }> {
  return apiSend("PATCH", `/api/admin/streams/${encodeURIComponent(id)}`, patch);
}

export async function adminDeleteStream(id: string): Promise<void> {
  await apiSend("DELETE", `/api/admin/streams/${encodeURIComponent(id)}`);
}

export async function adminRestoreStream(id: string): Promise<void> {
  await apiSend("POST", `/api/admin/streams/${encodeURIComponent(id)}/restore`);
}

export async function adminForceEndStream(id: string): Promise<void> {
  await apiSend("POST", `/api/admin/streams/${encodeURIComponent(id)}/force-end`);
}

export async function adminRegenerateStreamKey(
  id: string,
): Promise<{ streamKey: string }> {
  return apiSend(
    "POST",
    `/api/admin/streams/${encodeURIComponent(id)}/regenerate-key`,
  );
}

/* ── Catalogue: games, teams, players, events ───────────────────────────── */

export async function adminListGames(): Promise<Game[]> {
  const res = await apiGet<{ games: Game[] } | Game[]>("/api/admin/games");
  return Array.isArray(res) ? res : (res?.games ?? []);
}

export async function adminCreateGame(input: Partial<Game>): Promise<Game> {
  return apiSend("POST", "/api/admin/games", input);
}

/**
 * `/api/admin/teams` is create-only. Listing goes through the public route,
 * which reads the same rows.
 */
export async function adminListTeams(): Promise<Team[]> {
  const res = await apiGet<Team[]>("/api/teams");
  return Array.isArray(res) ? res : [];
}

export async function adminCreateTeam(input: Partial<Team>): Promise<Team> {
  return apiSend("POST", "/api/admin/teams", input);
}

/** As with teams, the admin route is create-only. */
export async function adminListPlayers(): Promise<Player[]> {
  const res = await apiGet<Player[]>("/api/players");
  return Array.isArray(res) ? res : [];
}

export async function adminCreatePlayer(
  input: Partial<Player>,
): Promise<Player> {
  return apiSend("POST", "/api/admin/players", input);
}

/** As with teams, the admin route is create-only. */
/**
 * The catalogue is editable, and deletable when nothing points at the row.
 *
 * PATCH and DELETE have existed on all four of these routes since they were
 * written. The CMS called neither and told the operator that editing "is not
 * supported yet", which was true of the screen and never of the API. Deleting
 * is guarded server-side: a game with clips or recordings under it answers 409
 * naming them rather than cascading them into oblivion.
 */
export async function adminUpdateGame(
  id: string,
  patch: Partial<Game>,
): Promise<Game> {
  return apiSend("PATCH", `/api/admin/games/${encodeURIComponent(id)}`, patch);
}

export async function adminDeleteGame(id: string): Promise<void> {
  await apiSend("DELETE", `/api/admin/games/${encodeURIComponent(id)}`);
}

export async function adminUpdateTeam(
  id: string,
  patch: Partial<Team>,
): Promise<Team> {
  return apiSend("PATCH", `/api/admin/teams/${encodeURIComponent(id)}`, patch);
}

export async function adminDeleteTeam(id: string): Promise<void> {
  await apiSend("DELETE", `/api/admin/teams/${encodeURIComponent(id)}`);
}

export async function adminUpdatePlayer(
  id: string,
  patch: Partial<Player>,
): Promise<Player> {
  return apiSend("PATCH", `/api/admin/players/${encodeURIComponent(id)}`, patch);
}

export async function adminDeletePlayer(id: string): Promise<void> {
  await apiSend("DELETE", `/api/admin/players/${encodeURIComponent(id)}`);
}

export async function adminUpdateEvent(
  id: string,
  patch: Partial<EsportsEvent>,
): Promise<EsportsEvent> {
  return apiSend("PATCH", `/api/admin/events/${encodeURIComponent(id)}`, patch);
}

export async function adminDeleteEvent(id: string): Promise<void> {
  await apiSend("DELETE", `/api/admin/events/${encodeURIComponent(id)}`);
}

export async function adminListEvents(): Promise<EsportsEvent[]> {
  const res = await apiGet<EsportsEvent[]>("/api/events");
  return Array.isArray(res) ? res : [];
}

export async function adminCreateEvent(
  input: Partial<EsportsEvent>,
): Promise<EsportsEvent> {
  return apiSend("POST", "/api/admin/events", input);
}

/* ── VODs ───────────────────────────────────────────────────────────────── */

export async function adminListVods(
  opts: AdminListOptions = {},
): Promise<{ vods: Vod[]; total: number }> {
  const res = await apiGet<{ vods: Vod[]; total: number }>("/api/admin/vods", {
    deleted: opts.deleted,
    limit: opts.limit ?? 100,
    offset: opts.offset ?? 0,
  });
  return res ?? { vods: [], total: 0 };
}

export async function adminDeleteVod(id: string): Promise<void> {
  await apiSend("DELETE", `/api/admin/vods/${encodeURIComponent(id)}`);
}

export async function adminRestoreVod(id: string): Promise<void> {
  await apiSend("POST", `/api/admin/vods/${encodeURIComponent(id)}/restore`);
}

/* ── Ads ────────────────────────────────────────────────────────────────── */

export async function adminListAds(): Promise<Ad[]> {
  const res = await apiGet<{ ads: Ad[] } | Ad[]>("/api/admin/ads");
  return Array.isArray(res) ? res : (res?.ads ?? []);
}

export async function adminCreateAd(input: Partial<Ad>): Promise<Ad> {
  return apiSend("POST", "/api/admin/ads", input);
}

export async function adminUpdateAd(
  id: string,
  patch: Partial<Ad>,
): Promise<Ad> {
  return apiSend("PATCH", `/api/admin/ads/${encodeURIComponent(id)}`, patch);
}

export async function adminDeleteAd(id: string): Promise<void> {
  await apiSend("DELETE", `/api/admin/ads/${encodeURIComponent(id)}`);
}

/* ── Polls ──────────────────────────────────────────────────────────────── */

export async function adminListPolls(): Promise<Poll[]> {
  const res = await apiGet<{ polls: Poll[] } | Poll[]>("/api/admin/polls");
  return Array.isArray(res) ? res : (res?.polls ?? []);
}

export async function adminClosePoll(id: string): Promise<void> {
  await apiSend("POST", `/api/polls/${encodeURIComponent(id)}/close`);
}

/* ── Orders, users, moderation ──────────────────────────────────────────── */

export async function adminListOrders(
  opts: AdminListOptions = {},
): Promise<{ orders: Order[]; total: number }> {
  const res = await apiGet<{ orders: Order[]; total: number }>(
    "/api/admin/orders",
    { limit: opts.limit ?? 100, offset: opts.offset ?? 0 },
  );
  return res ?? { orders: [], total: 0 };
}

export async function adminMarkOrderShipped(id: string): Promise<void> {
  await apiSend("POST", `/api/admin/orders/${encodeURIComponent(id)}/mark-shipped`);
}

/**
 * The rows carry more than a public `Profile`: the admin table needs the email,
 * whether the account is suspended, and when it was last seen.
 */
export type AdminUserRow = Profile & {
  email: string;
  emailVerified: boolean;
  suspended: boolean;
  lastActive: string | null;
  deletedAt: string | null;
};

export async function adminListUsers(
  opts: AdminListOptions & { q?: string; role?: string } = {},
): Promise<{ users: AdminUserRow[]; total: number }> {
  const res = await apiGet<{ users: AdminUserRow[]; total: number }>(
    "/api/admin/users",
    {
      // The endpoint reads `search`. This sent `q`, so typing in the admin
      // search box filtered nothing and quietly returned the unfiltered page.
      search: opts.q,
      role: opts.role,
      limit: opts.limit ?? 100,
      offset: opts.offset ?? 0,
    },
  );
  return res ?? { users: [], total: 0 };
}

export async function adminListReports(): Promise<
  Array<Record<string, unknown>>
> {
  const res = await apiGet<{ reports: Array<Record<string, unknown>> }>(
    "/api/admin/reports",
  );
  return res?.reports ?? [];
}

export async function adminResolveReport(
  id: string,
  action: string,
): Promise<void> {
  await apiSend("PATCH", `/api/admin/reports/${encodeURIComponent(id)}`, {
    action,
  });
}

/* ── Products ───────────────────────────────────────────────────────────── */

export async function adminListProducts(): Promise<Product[]> {
  // There is no admin-only products route; the public list is the same rows.
  const res = await apiGet<Product[]>("/api/products");
  return Array.isArray(res) ? res : [];
}

/* ── Feature flags ──────────────────────────────────────────────────────── */

/** The endpoint returns a bare array, not a wrapper. */
export async function adminListFlags(): Promise<FeatureFlag[]> {
  const data = await apiGet<FeatureFlag[]>("/api/admin/feature-flags");
  return Array.isArray(data) ? data : [];
}

export async function adminSetFlag(
  key: string,
  enabled: boolean,
): Promise<void> {
  await apiSend("PATCH", `/api/admin/feature-flags/${encodeURIComponent(key)}`, {
    enabled,
  });
}

/* ── Analytics ──────────────────────────────────────────────────────────── */

export async function adminOverview(): Promise<Record<string, unknown> | null> {
  return apiGet<Record<string, unknown>>("/api/admin/analytics/overview");
}

/**
 * Change an account's platform role.
 *
 * Takes the whole ladder, not the four roles the roster screen used to offer:
 * `moderator`, `support_admin` and `finance_admin` are checked by guards all
 * over the API and were unassignable from the dashboard, which made them
 * theoretical.
 *
 * The API refuses to demote yourself, to grant above your own tier, and to
 * demote the last account that can administer the platform.
 */
export async function adminSetUserRole(
  userId: string,
  role: PlatformRole,
): Promise<void> {
  await apiSend("PATCH", "/api/admin/users", { userId, role });
}

/**
 * Suspend an account, or lift a suspension.
 *
 * Suspension is a sanction record rather than a column, so lifting one deletes
 * the active sanction instead of setting a flag back to false.
 */
export async function adminSuspendUser(
  userId: string,
  reason = "Suspended by an administrator",
): Promise<void> {
  await apiSend("POST", `/api/admin/users/${encodeURIComponent(userId)}/sanction`, {
    kind: "suspended",
    reason,
  });
}

export async function adminLiftSanction(
  userId: string,
  sanctionId: string,
): Promise<void> {
  await apiSend(
    "DELETE",
    `/api/admin/users/${encodeURIComponent(userId)}/sanction/${encodeURIComponent(sanctionId)}`,
  );
}

export interface AdminOverviewMetrics {
  liveStreams: number;
  todaySignups: number;
  activePremiumSubs: number;
  mrrNgn: number;
}

/** Real counts out of Postgres: live streams, signups today, active subs, MRR. */
export async function adminOverviewMetrics(): Promise<AdminOverviewMetrics> {
  return (
    (await apiGet<AdminOverviewMetrics>("/api/admin/analytics/overview")) ?? {
      liveStreams: 0,
      todaySignups: 0,
      activePremiumSubs: 0,
      mrrNgn: 0,
    }
  );
}

/**
 * Daily view counts. The endpoint returns `{ date, views }` where date is
 * YYYY-MM-DD; `day` is carried alongside so chart components that key on either
 * name work without a mapping step at each call site.
 */
export async function adminViewsOverTime(
  days = 30,
): Promise<Array<{ date: string; day: string; views: number }>> {
  const data = await apiGet<Array<{ date: string; views: number }>>(
    "/api/admin/analytics/views",
    { days },
  );
  return Array.isArray(data)
    ? data.map((p) => ({ ...p, day: p.date }))
    : [];
}

export interface AdminSanction {
  id: string;
  userId: string;
  kind: string;
  reason: string;
  createdAt: string;
  expiresAt: string | null;
  liftedAt: string | null;
}

/** Active and historical sanctions: suspensions, bans, chat bans. */
export async function adminListSanctions(): Promise<AdminSanction[]> {
  const res = await apiGet<{ sanctions: AdminSanction[] }>("/api/admin/sanctions");
  return res?.sanctions ?? [];
}

/* ── Analytics ──────────────────────────────────────────────────────────── */

export interface AdminRevenuePoint {
  month: string;
  ngn: number;
}

export async function adminRevenueByMonth(
  months = 6,
): Promise<AdminRevenuePoint[]> {
  const d = await apiGet<AdminRevenuePoint[]>("/api/admin/analytics/revenue", {
    months,
  });
  return Array.isArray(d) ? d : [];
}

export async function adminRetention(weeks = 8): Promise<{
  cohorts: { weekStart: string; size: number }[];
  matrix: number[][];
}> {
  return (
    (await apiGet<{
      cohorts: { weekStart: string; size: number }[];
      matrix: number[][];
    }>("/api/admin/analytics/retention", { weeks })) ?? { cohorts: [], matrix: [] }
  );
}

export async function adminTopVods(
  limit = 10,
): Promise<Array<{ id: string; title: string; viewCount: number }>> {
  const d = await apiGet<Array<{ id: string; title: string; viewCount: number }>>(
    "/api/admin/analytics/top-vods",
    { limit },
  );
  return Array.isArray(d) ? d : [];
}

export async function adminConversion(): Promise<{
  totalUsers: number;
  convertedUsers: number;
  pct: number;
}> {
  return (
    (await apiGet<{ totalUsers: number; convertedUsers: number; pct: number }>(
      "/api/admin/analytics/conversion",
    )) ?? { totalUsers: 0, convertedUsers: 0, pct: 0 }
  );
}

/**
 * Create a poll on a stream. Polls belong to a stream, not to the platform, and
 * the endpoint takes an absolute `closesAt` rather than a duration.
 */
export async function adminCreatePoll(
  streamId: string,
  input: { question: string; options: string[]; durationMinutes: number },
): Promise<Poll> {
  const closesAt = new Date(
    Date.now() + input.durationMinutes * 60_000,
  ).toISOString();
  const res = await apiSend<{ poll: Poll } | Poll>(
    "POST",
    `/api/streams/${encodeURIComponent(streamId)}/polls`,
    {
      question: input.question,
      options: input.options.map((label, i) => ({ id: `opt_${i}`, label })),
      closesAt,
    },
  );
  return (res as { poll?: Poll })?.poll ?? (res as Poll);
}

export async function adminSaveEmailTemplate(
  key: string,
  subject: string,
  body: string,
): Promise<{ savedAt: string }> {
  return apiSend("PUT", `/api/admin/email-templates/${encodeURIComponent(key)}`, {
    subject,
    body,
  });
}

/* ── Per-video analytics ────────────────────────────────────────────────── */

export interface AdminVideoSummary {
  type: "vod" | "episode";
  id: string;
  title: string;
  thumbnailUrl: string;
  durationSec: number;
  publishedAt: string | null;
  views: number;
  watchTimeSec: number;
  avgPercentViewed: number;
}

export interface AdminVideoAnalytics {
  video: {
    type: "vod" | "episode";
    id: string;
    title: string;
    thumbnailUrl: string;
    durationSec: number;
    publishedAt: string | null;
  };
  views: number;
  uniqueViewers: number;
  signedOutViews: number;
  watchTimeSec: number;
  avgViewDurationSec: number;
  avgPercentViewed: number;
  completionRate: number;
  likes: number;
  retention: number[];
  viewsByDay: { date: string; views: number }[];
  topCountries: { country: string; views: number }[];
  devices: { device: string; views: number }[];
}

export async function adminVideoSummaries(
  days = 28,
): Promise<AdminVideoSummary[]> {
  const res = await apiGet<{ videos: AdminVideoSummary[] }>(
    "/api/admin/video-analytics",
    { days },
  );
  return res?.videos ?? [];
}

export async function adminVideoAnalytics(
  type: "vod" | "episode",
  id: string,
  days = 28,
): Promise<AdminVideoAnalytics | null> {
  return apiGet<AdminVideoAnalytics>("/api/admin/video-analytics", {
    type,
    id,
    days,
  });
}

/* ── Admin landing page ─────────────────────────────────────────────────── */

export interface AdminOverviewData {
  liveStreams: number;
  liveViewers: number;
  viewsToday: number;
  viewsYesterday: number;
  watchTimeSec7d: number;
  signupsToday: number;
  signups7d: number;
  activePremiumSubs: number;
  mrrNgn: number;
  revenueThisMonthNgn: number;
  viewsByDay: { date: string; views: number }[];
  attention: {
    id: string;
    tone: "red" | "amber";
    title: string;
    body: string;
    href: string;
  }[];
}

export async function adminOverviewPage(): Promise<AdminOverviewData | null> {
  return apiGet<AdminOverviewData>("/api/admin/overview");
}
