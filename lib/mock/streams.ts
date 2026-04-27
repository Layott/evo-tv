import type { Stream } from "@/lib/types";
import { sleep, byId, hoursAgo } from "./_util";
import { streamThumb } from "./_media";

export const streams: Stream[] = [
  {
    id: "channel_main",
    title: "EVO TV Channel — 24/7 Esports",
    description:
      "The EVO TV flagship channel. Non-stop rotation of highlights, recaps, weekly shows, and simulcasts of headline African esports events.",
    eventId: null,
    gameId: "game_freefire",
    streamerType: "official",
    streamerName: "EVO TV Channel",
    streamerAvatarUrl: "/evo-logo/evo-tv-152.png",
    isLive: true,
    startedAt: hoursAgo(72),
    endedAt: null,
    hlsUrl: "/demo/sample.m3u8",
    thumbnailUrl: "/evo-logo/evo-tv-hero.png",
    viewerCount: 24_300,
    peakViewerCount: 38_900,
    language: "en",
    tags: ["EVO TV", "24/7", "Flagship", "Africa", "Esports"],
    isPremium: false,
  },
  {
    id: "stream_lagos_final",
    title: "EVO Lagos Invitational — Semifinal 1 LIVE",
    description: "Team Alpha vs Nova Esports. Best of 5. English commentary.",
    eventId: "event_ff_lagos",
    gameId: "game_freefire",
    streamerType: "official",
    streamerName: "EVO TV Official",
    streamerAvatarUrl: "/evo-logo/evo-tv-152.png",
    isLive: true,
    startedAt: hoursAgo(1),
    endedAt: null,
    hlsUrl: "/demo/sample.m3u8",
    thumbnailUrl: streamThumb("stream_lagos_final"),
    viewerCount: 18_420,
    peakViewerCount: 21_300,
    language: "en",
    tags: ["Free Fire", "EVO", "Lagos", "Semifinal"],
    isPremium: false,
  },
  {
    id: "stream_casablanca",
    title: "PUBG Mobile Casablanca Classic — Final Day",
    description: "Zenith vs Hydra. Arabic + English dual audio.",
    eventId: "event_pubgm_casablanca",
    gameId: "game_pubgm",
    streamerType: "official",
    streamerName: "EVO TV Official",
    streamerAvatarUrl: "/evo-logo/evo-tv-152.png",
    isLive: true,
    startedAt: hoursAgo(2),
    endedAt: null,
    hlsUrl: "/demo/sample.m3u8",
    thumbnailUrl: streamThumb("stream_casablanca"),
    viewerCount: 7_280,
    peakViewerCount: 9_140,
    language: "ar",
    tags: ["PUBG Mobile", "Casablanca", "Final"],
    isPremium: false,
  },
  {
    id: "stream_codm_scrim",
    title: "CoD Mobile Scrim Night — Titan vs Rogue",
    description: "Pre-Cairo Cup preparation scrims.",
    eventId: null,
    gameId: "game_codm",
    streamerType: "official",
    streamerName: "EVO TV Official",
    streamerAvatarUrl: "/evo-logo/evo-tv-152.png",
    isLive: true,
    startedAt: hoursAgo(1),
    endedAt: null,
    hlsUrl: "/demo/sample.m3u8",
    thumbnailUrl: streamThumb("stream_codm_scrim"),
    viewerCount: 2_140,
    peakViewerCount: 3_020,
    language: "en",
    tags: ["CoD Mobile", "Scrim"],
    isPremium: false,
  },
  {
    id: "stream_premium_analysis",
    title: "Post-match Film Room — Week 4 (PREMIUM)",
    description: "Deep-dive film analysis from former pros. Premium subscribers only.",
    eventId: null,
    gameId: "game_freefire",
    streamerType: "official",
    streamerName: "Film Room",
    streamerAvatarUrl: "/interview-panel.png",
    isLive: true,
    startedAt: hoursAgo(1),
    endedAt: null,
    hlsUrl: "/demo/sample.m3u8",
    thumbnailUrl: streamThumb("stream_premium_analysis"),
    viewerCount: 640,
    peakViewerCount: 920,
    language: "en",
    tags: ["Analysis", "Free Fire", "Premium"],
    isPremium: true,
  },
  {
    id: "stream_talk_show",
    title: "The Evo Talk — Episode 12",
    description: "Weekly roundtable. Guest: Team Alpha IGL.",
    eventId: null,
    gameId: "game_freefire",
    streamerType: "official",
    streamerName: "Evo Talk",
    streamerAvatarUrl: "/interview-panel.png",
    isLive: true,
    startedAt: hoursAgo(1),
    endedAt: null,
    hlsUrl: "/demo/sample.m3u8",
    thumbnailUrl: streamThumb("stream_talk_show"),
    viewerCount: 1_310,
    peakViewerCount: 1_800,
    language: "en",
    tags: ["Talk Show", "Weekly"],
    isPremium: false,
  },
  {
    id: "stream_eafc_watch",
    title: "EA FC Continental — Watch Party",
    description: "Community watch-along with live commentary.",
    eventId: "event_eafc_fc_cup",
    gameId: "game_eafc",
    streamerType: "official",
    streamerName: "EVO TV Football",
    streamerAvatarUrl: "/evo-logo/evo-tv-152.png",
    isLive: true,
    startedAt: hoursAgo(1),
    endedAt: null,
    hlsUrl: "/demo/sample.m3u8",
    thumbnailUrl: streamThumb("stream_eafc_watch"),
    viewerCount: 480,
    peakViewerCount: 720,
    language: "en",
    tags: ["EA FC", "Watch Party"],
    isPremium: false,
  },
];

export async function listLiveStreams(filter?: {
  gameId?: string;
  isPremium?: boolean;
}): Promise<Stream[]> {
  await sleep();
  let result = streams.filter((s) => s.isLive);
  if (filter?.gameId) result = result.filter((s) => s.gameId === filter.gameId);
  if (typeof filter?.isPremium === "boolean")
    result = result.filter((s) => s.isPremium === filter.isPremium);
  return result.sort((a, b) => b.viewerCount - a.viewerCount);
}

export async function getStreamById(id: string): Promise<Stream | null> {
  await sleep();
  return byId(streams, id);
}

export async function listFeaturedStreams(): Promise<Stream[]> {
  await sleep();
  const channel = streams.find((s) => s.id === "channel_main");
  const others = streams.filter((s) => s.isLive && s.id !== "channel_main").slice(0, 2);
  return channel ? [channel, ...others] : others;
}

export async function getMainChannel(): Promise<Stream | null> {
  await sleep(40);
  return streams.find((s) => s.id === "channel_main") ?? null;
}

// In-memory report log (mock only — Phase 2 swaps for ops.audit_log writes).
const reportLog: Array<{ streamId: string; reason: string; reportedBy: string; at: string }> = [];

export async function reportStream(streamId: string, reason = "user-reported", reportedBy = "user_current"): Promise<{ ticketId: string }> {
  await sleep(120);
  const at = new Date().toISOString();
  reportLog.push({ streamId, reason, reportedBy, at });
  return { ticketId: `RPT-${streamId}-${Date.now().toString(36)}` };
}

export function getReportLog() {
  return reportLog.slice();
}
