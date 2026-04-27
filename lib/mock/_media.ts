// Centralized gaming-themed media URLs for mock data.
// Strategy: prefer local assets in /public, fall back to DiceBear for unique avatars.

const STREAM_THUMBS = [
  "/esports-live-stream-match.jpg",
  "/esports-championship-finals-live-stream.jpg",
  "/esports-casual-gameplay-stream.jpg",
  "/esports-pro-league-playoff-match.jpg",
  "/esports-tournament-match.jpg",
  "/match-live-1.jpg",
  "/esports-pro-league-event.jpg",
];

const SHOW_THUMBS = [
  "/esports-pro-tips-tutorial.jpg",
  "/esports-tournament-analysis.jpg",
  "/esports-weekly-highlights.jpg",
  "/interview-panel.png",
];

const VOD_THUMBS = [
  "/vod-thumb-1.jpg",
  "/vod-thumb-2.jpg",
  "/vod-thumb-3.jpg",
  "/esports-match-highlight.jpg",
  "/esports-best-plays-highlights.jpg",
  "/esports-highlights-compilation.jpg",
  "/esports-tournament-recap.jpg",
  "/esports-ranked-gameplay.jpg",
  "/esports-tournament-qualifier.jpg",
];

const CLIP_THUMBS = [
  "/esports-highlight-clutch-play.jpg",
  "/esports-best-plays-highlights.jpg",
  "/esports-match-highlight.jpg",
  "/esports-highlights-compilation.jpg",
  "/match-live-1.jpg",
];

const EVENT_BANNERS = [
  "/esports-championship-finals-event.jpg",
  "/esports-pro-league-event.jpg",
  "/esports-regional-qualifier-event.jpg",
  "/esports-championship-winning-moment.jpg",
  "/esports-regional-qualifier-tournament.jpg",
  "/esports-tournament-qualifier.jpg",
];

const TEAM_LOGOS_LOCAL = [
  "/team-alpha-logo.jpg",
  "/team-beta-logo.jpg",
  "/team-gamma-logo.jpg",
  "/team-delta-logo.jpg",
  "/fnatic-logo.jpg",
  "/g2-esports-logo.png",
  "/navi-logo.png",
  "/vitality-logo.png",
  "/esports-team-logo-2.jpg",
  "/esports-team-logo-3.jpg",
  "/esports-team-logo-4.jpg",
];

const GAMER_AVATARS = [
  "/gamer-avatar-1.png",
  "/gamer-avatar-2.png",
  "/gamer-avatar-3.png",
  "/gamer-avatar-4.png",
];

const GAME_COVER_LOCAL: Record<string, string> = {
  "free-fire": "/esports-championship-finals-live-stream.jpg",
  "cod-mobile": "/cs2-game.jpg",
  "pubg-mobile": "/valorant-game.jpg",
  "ea-fc-mobile": "/rocket-league-game.jpg",
};

const GAME_ICON_LOCAL: Record<string, string> = {
  "free-fire": "/esports-tournament-logo.png",
  "cod-mobile": "/cs2-tournament-logo.jpg",
  "pubg-mobile": "/valorant-tournament-logo.jpg",
  "ea-fc-mobile": "/rocket-league-tournament-logo.jpg",
};

function hashSeed(seed: string | number): number {
  if (typeof seed === "number") return Math.abs(seed);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: string | number): T {
  return arr[hashSeed(seed) % arr.length]!;
}

export function streamThumb(seed: string | number): string {
  return pick(STREAM_THUMBS, seed);
}

export function showThumb(seed: string | number): string {
  return pick(SHOW_THUMBS, seed);
}

export function vodPoster(seed: string | number): string {
  return pick(VOD_THUMBS, seed);
}

export function clipThumb(seed: string | number): string {
  return pick(CLIP_THUMBS, seed);
}

export function eventBanner(seed: string | number): string {
  return pick(EVENT_BANNERS, seed);
}

export function eventThumb(seed: string | number): string {
  return pick(EVENT_BANNERS, seed);
}

export function gameCover(slug: string): string {
  return GAME_COVER_LOCAL[slug] ?? "/esports-championship-finals-event.jpg";
}

export function gameIcon(slug: string): string {
  return GAME_ICON_LOCAL[slug] ?? "/esports-tournament-logo.png";
}

export function teamLogo(seed: string): string {
  return pick(TEAM_LOGOS_LOCAL, seed);
}

export function userAvatar(seed: string): string {
  // Mix local gamer avatars with DiceBear for variety + uniqueness on overflow.
  const h = hashSeed(seed);
  if (h % 3 === 0) return pick(GAMER_AVATARS, seed);
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&radius=50`;
}

export function playerAvatar(handle: string): string {
  // Bottts gives gamer-tag energy; deterministic per handle.
  return `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(handle)}&radius=50`;
}

export function chatAvatar(handle: string): string {
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(handle)}&radius=50`;
}

export function notifIcon(seed: string): string {
  return pick(VOD_THUMBS, seed);
}

export function adCreative(seed: string): string {
  return "/gaming-product-advertisement-banner.jpg";
}

export function productPhoto(slug: string): string {
  return pick(VOD_THUMBS, slug);
}

// YouTube embed URL injected on every live stream so clicking any livestream Rick-rolls the viewer.
export const RICK_ROLL_YOUTUBE_ID = "dQw4w9WgXcQ";
export const RICK_ROLL_EMBED_URL = `https://www.youtube.com/embed/${RICK_ROLL_YOUTUBE_ID}?autoplay=1&rel=0&modestbranding=1`;
