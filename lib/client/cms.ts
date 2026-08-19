import type { Clip, Product, ProductVariant, Vod } from "@/lib/types";
import type { PriceWindow } from "@/lib/shows/pricing";
import { apiGet, apiSend } from "./_fetch";

/**
 * The CMS control surface: shows, seasons, episodes, the weekly grid, and
 * granting a role by email.
 *
 * Rows come back as they sit in Postgres rather than through the public
 * mappers. The admin screens need columns the public shapes drop - `deletedAt`,
 * `isPremium`, the raw slug - and a mapper that hides them would make the CMS
 * unable to show what it is editing.
 *
 * Types are declared here rather than imported from `db/schema`, because the
 * screens are `"use client"` and pulling a Drizzle table into the browser
 * bundle drags a Postgres driver with it.
 */

export type ShowPillar = "esports" | "anime" | "lifestyle";
export type ShowOriginType = "evo_original" | "licensed" | "syndicated";
export type ShowStatus = "airing" | "completed" | "upcoming" | "hiatus";
export type MaturityRating = "kids" | "pg" | "teen" | "mature";

export interface SocialLink {
  platform: string;
  url: string;
}

export interface AdminShow {
  id: string;
  /** Derived from the title. Never entered, so never disagrees with the name. */
  slug: string;
  title: string;
  synopsis: string;
  heroUrl: string;
  posterUrl: string;
  /** Null means unfiled: none of the three, rather than defaulted to esports. */
  pillar: ShowPillar | null;
  originType: ShowOriginType;
  status: ShowStatus;
  primaryCreatorHandle: string;
  socialLinks: SocialLink[];
  totalSeasons: number;
  totalEpisodes: number;
  rating: number;
  releasedAt: string | null;
  tags: string[];
  isPremium: boolean;
  maturityRating: MaturityRating;
  contentTags: string[];
  /** Set when a series has finished for good. Drives the derived status. */
  endedAt: string | null;
  deletedAt: string | null;
}

export interface AdminSeason {
  id: string;
  showId: string;
  seasonNumber: number;
  title: string;
  episodeCount: number;
  releasedAt: string | null;
}

export interface AdminEpisode {
  id: string;
  showId: string;
  seasonId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  synopsis: string;
  thumbnailUrl: string;
  runtimeSec: number;
  hlsUrl: string;
  introStartSec: number | null;
  introEndSec: number | null;
  premiereAt: string | null;
  releasedAt: string | null;
  isPremium: boolean;
  maturityRating: MaturityRating;
  contentTags: string[];
  deletedAt: string | null;
}

/* ── Shows ──────────────────────────────────────────────────────────────── */

export interface AdminShowListOptions {
  q?: string;
  pillar?: ShowPillar;
  status?: ShowStatus;
  originType?: ShowOriginType;
  /** Omit for active only, "include" for both, "only" for the bin. */
  deleted?: "only" | "include";
  limit?: number;
  offset?: number;
}

export async function adminListShows(
  opts: AdminShowListOptions = {},
): Promise<{ shows: AdminShow[]; total: number }> {
  const res = await apiGet<{ shows: AdminShow[]; total: number }>(
    "/api/admin/shows",
    {
      q: opts.q,
      pillar: opts.pillar,
      status: opts.status,
      originType: opts.originType,
      deleted: opts.deleted,
      limit: opts.limit ?? 100,
      offset: opts.offset ?? 0,
    },
  );
  return res ?? { shows: [], total: 0 };
}

export interface AdminShowDetail {
  show: AdminShow;
  seasons: AdminSeason[];
  episodes: AdminEpisode[];
  priceWindows: PriceWindow[];
}

/** The whole tree in one round trip, so opening a show is not a request per season. */
export async function adminGetShow(id: string): Promise<AdminShowDetail | null> {
  return apiGet<AdminShowDetail>(`/api/admin/shows/${encodeURIComponent(id)}`);
}

/**
 * What the CMS may set on a show.
 *
 * No `slug`: it is derived from the title, so there is no second place to say
 * what the show is called. No `status`: it is derived from the episodes and the
 * grid, so it cannot claim a series is airing months after the last one.
 */
export interface CreateShowInput {
  title: string;
  synopsis?: string;
  pillar?: ShowPillar | null;
  originType?: ShowOriginType;
  primaryCreatorHandle?: string;
  socialLinks?: SocialLink[];
  posterUrl?: string;
  heroUrl?: string;
  tags?: string[];
  isPremium?: boolean;
  /** The price ladder for a paid show. Replaced wholesale when sent. */
  priceWindows?: PriceWindow[];
  maturityRating?: MaturityRating;
  contentTags?: string[];
  releasedAt?: string | null;
  endedAt?: string | null;
  rating?: number;
}

export async function adminCreateShow(input: CreateShowInput): Promise<AdminShow> {
  return apiSend("POST", "/api/admin/shows", input);
}

export async function adminUpdateShow(
  id: string,
  patch: Partial<CreateShowInput>,
): Promise<AdminShow> {
  const res = await apiSend<{ show: AdminShow }>(
    "PATCH",
    `/api/admin/shows/${encodeURIComponent(id)}`,
    patch,
  );
  return res.show;
}

export async function adminDeleteShow(id: string): Promise<void> {
  await apiSend("DELETE", `/api/admin/shows/${encodeURIComponent(id)}`);
}

/* ── Seasons ────────────────────────────────────────────────────────────── */

export async function adminCreateSeason(
  showId: string,
  input: { seasonNumber?: number; title?: string; releasedAt?: string | null } = {},
): Promise<AdminSeason> {
  const res = await apiSend<{ season: AdminSeason }>(
    "POST",
    `/api/admin/shows/${encodeURIComponent(showId)}/seasons`,
    input,
  );
  return res.season;
}

export async function adminUpdateSeason(
  id: string,
  patch: { seasonNumber?: number; title?: string; releasedAt?: string | null },
): Promise<AdminSeason> {
  const res = await apiSend<{ season: AdminSeason }>(
    "PATCH",
    `/api/admin/seasons/${encodeURIComponent(id)}`,
    patch,
  );
  return res.season;
}

/** Refused while the season still holds episodes, because the cascade would take them. */
export async function adminDeleteSeason(id: string): Promise<void> {
  await apiSend("DELETE", `/api/admin/seasons/${encodeURIComponent(id)}`);
}

/* ── Episodes ───────────────────────────────────────────────────────────── */

export interface CreateEpisodeInput {
  seasonId: string;
  /** Omit to take the next free number in that season. */
  episodeNumber?: number;
  title: string;
  synopsis?: string;
  thumbnailUrl?: string;
  hlsUrl?: string;
  runtimeSec?: number;
  /** Omit to inherit the show's tier rather than defaulting to free. */
  isPremium?: boolean;
  maturityRating?: MaturityRating;
  contentTags?: string[];
  introStartSec?: number | null;
  introEndSec?: number | null;
  premiereAt?: string | null;
  releasedAt?: string | null;
}

export async function adminCreateEpisode(
  showId: string,
  input: CreateEpisodeInput,
): Promise<AdminEpisode> {
  const res = await apiSend<{ episode: AdminEpisode }>(
    "POST",
    `/api/admin/shows/${encodeURIComponent(showId)}/episodes`,
    input,
  );
  return res.episode;
}

export async function adminUpdateEpisode(
  id: string,
  patch: Partial<Omit<CreateEpisodeInput, "seasonId">>,
): Promise<AdminEpisode> {
  const res = await apiSend<{ episode: AdminEpisode }>(
    "PATCH",
    `/api/admin/episodes/${encodeURIComponent(id)}`,
    patch,
  );
  return res.episode;
}

export async function adminDeleteEpisode(id: string): Promise<void> {
  await apiSend("DELETE", `/api/admin/episodes/${encodeURIComponent(id)}`);
}

/* ── The weekly grid ────────────────────────────────────────────────────── */

export interface AdminEpgSlot {
  id: string;
  /** The show being scheduled. Null only on rows imported before the link existed. */
  showId: string | null;
  dayOfWeek: number;
  startMinute: number;
  durationMin: number;
  title: string;
  pillar: ShowPillar;
  parentalRating: number | null;
  genreId: number | null;
  subgenreId: number | null;
  slotCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Scheduling picks a show. The title and pillar on the row are copies of that
 * show's, filled in server-side, so the grid can never announce a programme
 * under a name the catalogue does not know.
 */
export interface SlotInput {
  dayOfWeek: number;
  startMinute: number;
  durationMin: number;
  showId: string;
  parentalRating: number | null;
}

export async function adminListSlots(): Promise<AdminEpgSlot[]> {
  const res = await apiGet<{ slots: AdminEpgSlot[] }>("/api/admin/epg");
  return res?.slots ?? [];
}

/**
 * Create and update both return warnings alongside the row. An overlap is a
 * warning rather than a rejection - back-to-back programming is normal, and the
 * only thing the database refuses outright is two slots on the same minute.
 */
export interface SlotWriteResult {
  slot: AdminEpgSlot;
  warnings: string[];
}

export async function adminCreateSlot(input: SlotInput): Promise<SlotWriteResult> {
  return apiSend("POST", "/api/admin/epg", input);
}

export async function adminUpdateSlot(
  id: string,
  patch: Partial<SlotInput>,
): Promise<SlotWriteResult> {
  return apiSend("PATCH", `/api/admin/epg/${encodeURIComponent(id)}`, patch);
}

export async function adminDeleteSlot(id: string): Promise<void> {
  await apiSend("DELETE", `/api/admin/epg/${encodeURIComponent(id)}`);
}

/* ── The library: videos and clips ──────────────────────────────────────── */

export interface CreateVodInput {
  title: string;
  gameId: string;
  mp4Url: string;
  hlsUrl?: string;
  thumbnailUrl: string;
  durationSec: number;
  description?: string;
  pillar?: ShowPillar | null;
  maturityRating?: MaturityRating;
  isPremium?: boolean;
  /** When it should appear. Null or absent means now. */
  publishAt?: string | null;
  contentTags?: string[];
}

export async function adminCreateVod(input: CreateVodInput): Promise<Vod> {
  return apiSend("POST", "/api/admin/vods", input);
}

/** A marker in a long recording, so it can be navigated rather than scrubbed. */
export interface VodChapterInput {
  label: string;
  startSec: number;
}

/**
 * Everything about a VOD, not just its classification.
 *
 * The route used to take three fields, which meant a video published with a
 * typo kept it and a file uploaded to the wrong row could never be replaced.
 */
export async function adminUpdateVod(
  id: string,
  patch: Partial<CreateVodInput> & { chapters?: VodChapterInput[] },
): Promise<Vod> {
  return apiSend("PATCH", `/api/admin/vods/${encodeURIComponent(id)}`, patch);
}

/**
 * A clip as the admin list returns it, which is the row plus the columns added
 * by migration 0037: what it was cut from.
 */
export interface AdminClip extends Clip {
  slug: string | null;
  showId: string | null;
  episodeId: string | null;
  channelId: string | null;
  deletedAt: string | null;
}

export async function adminListClips(
  opts: { deleted?: "only" | "include"; limit?: number; offset?: number } = {},
): Promise<{ clips: AdminClip[]; total: number }> {
  const res = await apiGet<{ clips: AdminClip[]; total: number }>(
    "/api/admin/clips",
    {
      deleted: opts.deleted,
      limit: opts.limit ?? 100,
      offset: opts.offset ?? 0,
    },
  );
  return res ?? { clips: [], total: 0 };
}

export interface CreateClipInput {
  title: string;
  gameId: string;
  mp4Url: string;
  thumbnailUrl: string;
  durationSec: number;
  creatorHandle: string;
  creatorAvatarUrl?: string;
  pillar?: ShowPillar | null;
  maturityRating?: MaturityRating;
  contentTags?: string[];
  /** What it was cut from. An episode fills in its own show server-side. */
  vodId?: string | null;
  showId?: string | null;
  episodeId?: string | null;
}

export async function adminCreateClip(input: CreateClipInput): Promise<AdminClip> {
  const res = await apiSend<{ clip: AdminClip }>("POST", "/api/admin/clips", input);
  return res.clip;
}

export async function adminDeleteClip(id: string): Promise<void> {
  await apiSend("DELETE", `/api/admin/clips/${encodeURIComponent(id)}`);
}

export async function adminRestoreClip(id: string): Promise<void> {
  await apiSend("POST", `/api/admin/clips/${encodeURIComponent(id)}/restore`);
}

/* ── Subscriptions ──────────────────────────────────────────────────────── */

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "paused";

export interface AdminSubscription {
  id: string;
  userId: string;
  tier: string;
  status: SubscriptionStatus;
  provider: string;
  providerSubId: string | null;
  currentPeriodEnd: string | null;
  priceNgn: number;
  createdAt: string;
  userEmail: string;
  userName: string | null;
  userHandle: string | null;
}

export async function adminListSubscriptions(
  opts: { status?: SubscriptionStatus; limit?: number; offset?: number } = {},
): Promise<{ subscriptions: AdminSubscription[]; total: number }> {
  const res = await apiGet<{ subscriptions: AdminSubscription[]; total: number }>(
    "/api/admin/subscriptions",
    {
      status: opts.status,
      limit: opts.limit ?? 100,
      offset: opts.offset ?? 0,
    },
  );
  return res ?? { subscriptions: [], total: 0 };
}

/**
 * Cancel access at the end of the period, and drop the account's premium role
 * if nothing else keeps it. Money is not touched: a refund happens in Paystack.
 */
export async function adminCancelSubscription(id: string): Promise<void> {
  await apiSend("PATCH", `/api/admin/subscriptions/${encodeURIComponent(id)}`, {
    action: "cancel",
  });
}

/** Push the period end out by N days. Used for goodwill and for outages. */
export async function adminExtendSubscription(
  id: string,
  days: number,
): Promise<void> {
  await apiSend("PATCH", `/api/admin/subscriptions/${encodeURIComponent(id)}`, {
    action: "extend",
    days,
  });
}

/* ── The shop ───────────────────────────────────────────────────────────── */

export interface ProductInput {
  name: string;
  description?: string;
  category: Product["category"];
  priceNgn: number;
  images?: string[];
  variants?: ProductVariant[];
  featured?: boolean;
  active?: boolean;
  teamId?: string | null;
  inventory?: number;
}

/**
 * The admin catalogue, which is not the public one.
 *
 * `adminListProducts` in `admin.ts` reads `/api/products`, and that endpoint
 * only returns what a shopper should see. An operator needs the inactive rows
 * too, or a product taken off the shop becomes invisible to the person who
 * took it off.
 */
export async function adminListShopProducts(): Promise<Product[]> {
  const res = await apiGet<{ products: Product[] }>("/api/admin/products");
  return res?.products ?? [];
}

export async function adminCreateProduct(input: ProductInput): Promise<Product> {
  const res = await apiSend<{ product: Product }>("POST", "/api/admin/products", input);
  return res.product;
}

export async function adminUpdateProduct(
  id: string,
  patch: Partial<ProductInput>,
): Promise<Product> {
  const res = await apiSend<{ product: Product }>(
    "PATCH",
    `/api/admin/products/${encodeURIComponent(id)}`,
    patch,
  );
  return res.product;
}

/**
 * Take a product off the shop.
 *
 * Deletes the row outright only when nobody has ever ordered it; otherwise it
 * is deactivated, because every order stores its line items with the product id
 * and a deleted row would leave old orders pointing at nothing. The response
 * says which happened.
 */
export async function adminRemoveProduct(
  id: string,
): Promise<{ deactivated: boolean; message?: string }> {
  return apiSend("DELETE", `/api/admin/products/${encodeURIComponent(id)}`);
}

/* ── Announcements ──────────────────────────────────────────────────────── */

export type AnnouncementAudience =
  | { kind: "everyone" }
  | { kind: "role"; role: string }
  | { kind: "user"; email: string }
  /** A named set, pasted in. */
  | { kind: "users"; emails: string[] }
  /** Read from the subscriptions table, not the role column. */
  | { kind: "subscribers" }
  | { kind: "free" };

/**
 * Where tapping it goes, chosen rather than typed.
 *
 * The path is composed server-side from whatever is picked here, so nobody
 * ever writes a route by hand and a renamed route cannot leave a dead link
 * behind in a message.
 */
export type AnnouncementDestination =
  | { kind: "none" }
  | { kind: "page"; page: string }
  | { kind: "show"; id: string }
  | { kind: "stream"; id: string }
  | { kind: "video"; id: string }
  | { kind: "external"; url: string };

export interface AnnouncementChannels {
  /** The notification list is always written; these are the extras. */
  push: boolean;
  email: boolean;
}

export interface AnnouncementInput {
  title: string;
  body: string;
  destination: AnnouncementDestination;
  audience: AnnouncementAudience;
  channels: AnnouncementChannels;
}

export interface DestinationOptions {
  pages: Array<{ value: string; label: string }>;
  shows: Array<{ id: string; label: string; detail?: string }>;
  streams: Array<{ id: string; label: string; detail?: string }>;
  videos: Array<{ id: string; label: string; detail?: string }>;
}

/** Everything a message can point at, by name. */
export async function adminListDestinations(): Promise<DestinationOptions> {
  const data = await apiGet<DestinationOptions>("/api/admin/destinations");
  return data ?? { pages: [], shows: [], streams: [], videos: [] };
}

export interface AnnouncementPreview {
  preview: true;
  recipients: number;
  description: string;
  /** How many of them have a device that could receive a push at all. */
  withPushTokens: number;
  /** Where tapping it will take them, in words. */
  destination: string;
}

export interface AnnouncementResult {
  ok: true;
  recipients: number;
  notified: number;
  expoDelivered: number;
  webDelivered: number;
  emailed: number;
  description: string;
  destination: string;
}

/** Counts who it would reach and sends nothing. There is no unsend. */
export async function adminPreviewAnnouncement(
  input: AnnouncementInput,
): Promise<AnnouncementPreview> {
  return apiSend("POST", "/api/admin/announcements", { ...input, preview: true });
}

export async function adminSendAnnouncement(
  input: AnnouncementInput,
): Promise<AnnouncementResult> {
  return apiSend("POST", "/api/admin/announcements", { ...input, preview: false });
}

/* ── Roster ─────────────────────────────────────────────────────────────── */

/**
 * Grant a role to an existing account by email.
 *
 * Throws with the server's message on 404, which is the ordinary case: the
 * person has not signed up yet. That reads better as a toast than as an empty
 * search result.
 */
export async function adminGrantRoleByEmail(
  email: string,
  role: string,
): Promise<{ id: string; email: string; role: string }> {
  return apiSend("POST", "/api/admin/users/promote", { email, role });
}

/* ── Publishing an upload ──────────────────────────────────────────────── */

export interface PublishVideoInput {
  /** The file, already PUT to storage by the browser. */
  hlsUrl: string;
  title: string;
  synopsis?: string;
  thumbnailUrl?: string;
  runtimeSec?: number;
  isPremium?: boolean;
  maturityRating?: MaturityRating;
  pillar?: ShowPillar | null;
  /** When it should appear. Null means now. */
  publishAt?: string | null;
  /** File it on a show that already exists. */
  showId?: string;
  /** Or describe one, and it is created with this upload as its first episode. */
  newShow?: {
    title: string;
    synopsis?: string;
    pillar?: ShowPillar | null;
    originType?: ShowOriginType;
    posterUrl?: string;
    heroUrl?: string;
    isPremium?: boolean;
    maturityRating?: MaturityRating;
  };
  seasonNumber?: number;
  /** Omit for the next free number in that season. */
  episodeNumber?: number;
}

export interface PublishVideoResult {
  kind: "vod" | "episode";
  vodId?: string;
  showId?: string;
  episodeId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  createdShow?: boolean;
}

/**
 * One call for the upload form.
 *
 * Filing a video on a series used to mean making the show, then a season, then
 * the episode, on a different screen, with the URL pasted twice. The server
 * does all three in one transaction now, so a half-made show cannot be left
 * behind by somebody who stopped halfway.
 */
export async function publishVideo(
  input: PublishVideoInput,
): Promise<PublishVideoResult> {
  const res = await fetch("/api/admin/library/publish", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Could not publish the video");
  }
  return res.json();
}
