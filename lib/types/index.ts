export type UUID = string;
export type ISODate = string;

export type Role = "guest" | "user" | "premium" | "admin";

export interface Profile {
  id: UUID;
  handle: string;
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

export interface Stream {
  id: UUID;
  title: string;
  description: string;
  eventId: UUID | null;
  gameId: UUID;
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
}

export interface VodChapter {
  label: string;
  startSec: number;
}

export interface Vod {
  id: UUID;
  streamId: UUID | null;
  title: string;
  description: string;
  gameId: UUID;
  durationSec: number;
  hlsUrl: string;
  mp4Url: string;
  thumbnailUrl: string;
  publishedAt: ISODate;
  chapters: VodChapter[];
  viewCount: number;
  likeCount: number;
  isPremium: boolean;
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
}

export interface ChatMessage {
  id: UUID;
  streamId: UUID;
  userId: UUID;
  userHandle: string;
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

export type AdPlacement = "home_banner" | "stream_preroll" | "sidebar" | "between_content";

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
