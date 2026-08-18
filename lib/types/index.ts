export type UUID = string;
export type ISODate = string;

export type Role = "guest" | "user" | "premium" | "creator" | "admin";

/**
 * Content maturity rating. Ordered kids<pg<teen<mature
 * (ranks kids=0, pg=1, teen=2, mature=3).
 */
export type MaturityRating = "kids" | "pg" | "teen" | "mature";

export interface Profile {
  id: UUID;
  handle: string;
  /**
   * The address this account signs in with.
   *
   * Absent from this type until now, so the client dropped it when mapping
   * `/api/users/me`, and the settings screen invented `${handle}@evo.tv` to
   * fill the gap. It showed every user an address that does not exist and is
   * not theirs.
   */
  email: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  role: Role;
  country: string;
  onboardedAt: ISODate | null;
  createdAt: ISODate;
}

export interface UserPrefs {
  userId: UUID;
  favoriteGames: UUID[];
  favoriteTeams: UUID[];
  favoritePlayers: UUID[];
  notifOptIn: {
    goLive: boolean;
    eventReminder: boolean;
    newVod: boolean;
    weeklyDigest: boolean;
  };
  playback: {
    defaultQuality: "auto" | "1080p" | "720p" | "480p" | "360p";
    captions: boolean;
    autoplay: boolean;
  };
  language: "en" | "fr" | "pt" | "ha" | "yo" | "ig" | "sw";
  theme: "system" | "light" | "dark";
  maturityPreference?: MaturityRating;
}

export interface Game {
  id: UUID;
  slug: string;
  name: string;
  shortName: string;
  coverUrl: string;
  iconUrl: string;
  category: "br" | "fps" | "moba" | "sports" | "fighting";
  platform: "mobile" | "pc" | "console";
  activePlayers: number;
  enabled: boolean;
  featured: boolean;
  displayOrder: number;
}

export interface Team {
  id: UUID;
  slug: string;
  name: string;
  tag: string;
  logoUrl: string;
  country: string;
  region: string;
  gameId: UUID;
  ranking: number;
  followers: number;
  wins: number;
  losses: number;
}

export interface Player {
  id: UUID;
  handle: string;
  realName: string;
  avatarUrl: string;
  teamId: UUID | null;
  gameId: UUID;
  role: string;
  country: string;
  kda: number;
  followers: number;
}

export type EventStatus = "scheduled" | "live" | "completed" | "cancelled";
export type EventTier = "s" | "a" | "b" | "c";

export interface EsportsEvent {
  id: UUID;
  slug: string;
  title: string;
  gameId: UUID;
  startsAt: ISODate;
  endsAt: ISODate;
  status: EventStatus;
  tier: EventTier;
  bannerUrl: string;
  thumbnailUrl: string;
  description: string;
  prizePoolNgn: number;
  teamIds: UUID[];
  region: string;
  format: string;
  viewerCount?: number;
}

export type MatchState = "scheduled" | "live" | "completed";

export interface Match {
  id: UUID;
  eventId: UUID;
  teamAId: UUID;
  teamBId: UUID;
  scheduledAt: ISODate;
  state: MatchState;
  scoreA: number;
  scoreB: number;
  round: string;
  bestOf: number;
}

export type StreamerType = "official" | "creator";

/** Phase 9a - top-level content pillar. */
export type ContentPillar = "esports" | "anime" | "lifestyle";

export interface Stream {
  id: UUID;
  title: string;
  description: string;
  eventId: UUID | null;
  /**
   * Where this stream's broadcast arrives from: a Cloudflare Stream live
   * input, our own nginx-rtmp, or a manifest URL pasted by hand.
   */
  ingestKind: "manual" | "cloudflare" | "rtmp";
  /** The flagship channel. At most one stream carries this. */
  isMainChannel?: boolean;
  /** Null for anime, lifestyle and podcast programmes. */
  gameId: UUID | null;
  channelId?: UUID | null;
  streamerType: StreamerType;
  streamerName: string;
  streamerAvatarUrl: string;
  isLive: boolean;
  startedAt: ISODate | null;
  endedAt: ISODate | null;
  hlsUrl: string;
  thumbnailUrl: string;
  viewerCount: number;
  peakViewerCount: number;
  language: string;
  tags: string[];
  isPremium: boolean;
  pillar?: ContentPillar;
  maturityRating?: MaturityRating;
  contentTags?: string[];
  /** Pre-announced airtime for EPG. NULL for unscheduled or live-only streams. */
  scheduledStartAt?: ISODate | null;
  /** Pre-announced duration in minutes. Pairs with scheduledStartAt. */
  scheduledDurationMin?: number | null;
}

export interface VodChapter {
  label: string;
  startSec: number;
}

export interface Vod {
  id: UUID;
  streamId: UUID | null;
  /** URL slug. Null on rows created before migration 0035; address those by id. */
  slug: string | null;
  title: string;
  description: string;
  /** Null for anime, lifestyle and podcast programmes. */
  gameId: UUID | null;
  durationSec: number;
  hlsUrl: string;
  mp4Url: string;
  thumbnailUrl: string;
  publishedAt: ISODate;
  chapters: VodChapter[];
  viewCount: number;
  likeCount: number;
  isPremium: boolean;
  pillar?: ContentPillar;
  maturityRating?: MaturityRating;
  contentTags?: string[];
}

export interface Clip {
  id: UUID;
  vodId: UUID | null;
  streamId: UUID | null;
  title: string;
  creatorHandle: string;
  creatorAvatarUrl: string;
  durationSec: number;
  mp4Url: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  createdAt: ISODate;
  gameId: UUID;
  pillar?: ContentPillar;
  maturityRating?: MaturityRating;
  contentTags?: string[];
}

/* ── Phase 9b - Shows / Seasons / Episodes ───────────────────────────── */

export type ShowOriginType = "evo_original" | "licensed" | "syndicated";
export type ShowStatus = "airing" | "completed" | "upcoming" | "hiatus";
export type WatchlistStatus =
  | "watching"
  | "completed"
  | "on_hold"
  | "dropped"
  | "plan_to_watch";

export interface Show {
  id: UUID;
  slug: string;
  title: string;
  synopsis: string;
  heroUrl: string;
  posterUrl: string;
  pillar: ContentPillar;
  originType: ShowOriginType;
  status: ShowStatus;
  primaryCreatorHandle: string;
  totalSeasons: number;
  totalEpisodes: number;
  rating: number;
  releasedAt: ISODate;
  tags: string[];
  /**
   * Free or paid, same flag `Stream` and `Vod` carry. Optional because rows
   * written before the column existed have nothing to report, and a caller
   * that treats a missing value as free matches the column default.
   */
  isPremium?: boolean;
  maturityRating?: MaturityRating;
  contentTags?: string[];
}

export interface Season {
  id: UUID;
  showId: UUID;
  seasonNumber: number;
  title: string;
  episodeCount: number;
  releasedAt: ISODate;
}

export interface Episode {
  id: UUID;
  showId: UUID;
  seasonId: UUID;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  synopsis: string;
  thumbnailUrl: string;
  runtimeSec: number;
  hlsUrl: string;
  introStartSec?: number;
  introEndSec?: number;
  premiereAt: ISODate;
  releasedAt: ISODate;
  /** Overrides the show's tier for this one episode. See `Show.isPremium`. */
  isPremium?: boolean;
  maturityRating?: MaturityRating;
  contentTags?: string[];
}

export interface ChatMessage {
  id: UUID;
  streamId: UUID;
  userId: UUID;
  /**
   * Null when the account has never set a handle, which is the default state
   * of every new account. This was typed as a plain string, so nothing warned
   * when a null reached the renderer and threw inside React.
   */
  userHandle: string | null;
  userAvatarUrl: string;
  userRole: Role;
  body: string;
  createdAt: ISODate;
  isDeleted: boolean;
  isPinned: boolean;
}

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface Poll {
  id: UUID;
  streamId: UUID;
  question: string;
  options: PollOption[];
  createdAt: ISODate;
  closesAt: ISODate;
  isClosed: boolean;
  totalVotes: number;
}

export type FollowTarget = "team" | "player" | "streamer";

export interface Follow {
  userId: UUID;
  targetType: FollowTarget;
  targetId: UUID;
  createdAt: ISODate;
}

export type SubscriptionTier = "free" | "premium";
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "paused";

export interface Subscription {
  id: UUID;
  userId: UUID;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  provider: "paystack" | "stripe" | "mock";
  providerSubId: string;
  currentPeriodEnd: ISODate;
  priceNgn: number;
  createdAt: ISODate;
}

export interface ProductVariant {
  id: string;
  label: string;
  priceNgn: number;
  inventory: number;
}

export interface Product {
  id: UUID;
  slug: string;
  name: string;
  description: string;
  category: "jersey" | "apparel" | "accessory" | "digital" | "collectible";
  priceNgn: number;
  images: string[];
  variants: ProductVariant[];
  featured: boolean;
  active: boolean;
  teamId: UUID | null;
  /** The show this came out of, when it came out of one. */
  showId: UUID | null;
  inventory: number;
}

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface OrderItem {
  productId: UUID;
  productName: string;
  variantId: string | null;
  variantLabel: string | null;
  qty: number;
  unitPriceNgn: number;
  thumbnailUrl: string;
}

export interface Order {
  id: UUID;
  userId: UUID;
  status: OrderStatus;
  items: OrderItem[];
  subtotalNgn: number;
  shippingNgn: number;
  totalNgn: number;
  shipping: {
    fullName: string;
    phone: string;
    address1: string;
    address2: string;
    city: string;
    state: string;
    country: string;
  };
  paymentProvider: "paystack" | "stripe";
  paymentRef: string;
  createdAt: ISODate;
  trackingNumber: string | null;
}

export type AdPlacement =
  | "home_banner"
  | "stream_preroll"
  /** A break during the always-on channel, at the interval admins set. */
  | "mid_roll"
  /** What covers the player when the live feed drops. */
  | "live_filler"
  | "sidebar"
  | "between_content";

export interface Ad {
  id: UUID;
  placement: AdPlacement;
  mediaUrl: string;
  clickUrl: string;
  advertiser: string;
  active: boolean;
  startAt: ISODate;
  endAt: ISODate;
  weight: number;
  impressions: number;
  clicks: number;
}

export type NotificationType =
  | "stream_live"
  | "event_starting"
  | "new_vod"
  | "follow"
  | "order_update"
  | "subscription"
  | "system";

export interface NotificationItem {
  id: UUID;
  userId: UUID;
  type: NotificationType;
  title: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
  readAt: ISODate | null;
  createdAt: ISODate;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
}
