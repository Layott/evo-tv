import type { Vod, Clip } from "@/lib/types";
import { sleep, byId, daysAgo, hoursAgo } from "./_util";
import { vodPoster, clipThumb, playerAvatar } from "./_media";

function makeVod(idx: number): Vod {
  const gameIds = ["game_freefire", "game_codm", "game_pubgm", "game_eafc"];
  const gameId = gameIds[idx % 4]!;
  const duration = 1_800 + Math.floor(Math.random() * 7_200);
  return {
    id: `vod_${idx + 1}`,
    streamId: idx < 6 ? `stream_${idx + 1}` : null,
    title: [
      "EVO Championship Week 4 Recap",
      "Best Free Fire Plays — Lagos Invitational",
      "CoD Mobile Cairo Cup Day 1 Highlights",
      "PUBG Mobile Nairobi Open Group Stage",
      "EA FC Continental Cup Bracket Reveal",
      "Evo Talk — The Meta Is Broken",
      "Film Room — Decoding Team Alpha's Rotation",
      "Pro Tips: Mastering Advanced Rotations",
      "Tournament Preview: What To Watch",
      "Pool Day Week 12 — Every Fragment",
      "Rookie Of The Month: Viper's Rise",
      "Behind The Scenes: Continental Finals Setup",
      "How Nova Esports Won Week 3",
      "The State Of African Free Fire — Quarterly Panel",
      "Zenith vs Hydra — Every Chicken Dinner",
      "Ten Best Clutches of the Month",
      "Coaching Clinic — IGL Communication",
      "Mobile Settings Deep Dive — Free Fire",
      "Meet The Casters — Season Premiere",
      "From Local To Continental — Team Alpha's Journey",
      "Sponsor Spotlight: EVO Originals x Free Fire",
      "Cosplay Gallery — EVO Championship",
      "Community Cup #14 Semifinals",
      "Fans' Top Plays — Viewer Submissions",
      "Nightwatch Scrims — CoD Mobile",
      "Technical Breakdown: Vortex's Entry Frags",
      "Retro Review: EVO Season 1",
      "Caster Cam — Unfiltered Finals Reactions",
      "Evo Talk — Rookies vs Vets",
      "Post Game Pressers — Lagos Invitational",
    ][idx]!,
    description:
      "Full episode with commentary, stats overlays and player cams. Produced by EVO Originals.",
    gameId,
    durationSec: duration,
    hlsUrl: "/demo/sample.m3u8",
    mp4Url: "/demo/sample.mp4",
    thumbnailUrl: vodPoster(`vod_${idx + 1}`),
    publishedAt: daysAgo(idx + 1),
    chapters: [
      { label: "Intro", startSec: 0 },
      { label: "Highlights", startSec: Math.floor(duration * 0.15) },
      { label: "Mid-game breakdown", startSec: Math.floor(duration * 0.4) },
      { label: "Key moment", startSec: Math.floor(duration * 0.6) },
      { label: "Final analysis", startSec: Math.floor(duration * 0.8) },
      { label: "Outro", startSec: Math.floor(duration * 0.95) },
    ],
    viewCount: 1_200 + Math.floor(Math.random() * 180_000),
    likeCount: 80 + Math.floor(Math.random() * 12_000),
    isPremium: idx % 7 === 0,
  };
}

export const vods: Vod[] = Array.from({ length: 30 }, (_, i) => makeVod(i));

const clipTitles = [
  "Insane 1v4 clutch",
  "5-kill ace in 8 seconds",
  "Bhop dodge + headshot combo",
  "Zero-hp chicken dinner",
  "Last-second bomb defuse",
  "Cross-map snipe montage",
  "Pro IGL roasts casters live",
  "Unreal comeback final round",
  "Glitch-perfect rotation read",
  "Caster loses it on-air",
];

function makeClip(idx: number): Clip {
  const gameIds = ["game_freefire", "game_codm", "game_pubgm", "game_eafc"];
  return {
    id: `clip_${idx + 1}`,
    vodId: `vod_${(idx % 30) + 1}`,
    streamId: null,
    title: clipTitles[idx % clipTitles.length]!,
    creatorHandle: ["viper", "shadow", "blaze", "havoc", "rex"][idx % 5]!,
    creatorAvatarUrl: playerAvatar(["viper", "shadow", "blaze", "havoc", "rex"][idx % 5]!),
    durationSec: 15 + Math.floor(Math.random() * 60),
    mp4Url: "/demo/sample.mp4",
    thumbnailUrl: clipThumb(`clip_${idx + 1}`),
    viewCount: 400 + Math.floor(Math.random() * 60_000),
    likeCount: 40 + Math.floor(Math.random() * 4_000),
    createdAt: hoursAgo(idx + 1),
    gameId: gameIds[idx % 4]!,
  };
}

export const clips: Clip[] = Array.from({ length: 10 }, (_, i) => makeClip(i));

export async function listVods(filter?: {
  gameId?: string;
  isPremium?: boolean;
  limit?: number;
}): Promise<Vod[]> {
  await sleep();
  let result = vods;
  if (filter?.gameId) result = result.filter((v) => v.gameId === filter.gameId);
  if (typeof filter?.isPremium === "boolean")
    result = result.filter((v) => v.isPremium === filter.isPremium);
  result = result.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  return filter?.limit ? result.slice(0, filter.limit) : result;
}

export async function getVodById(id: string): Promise<Vod | null> {
  await sleep();
  return byId(vods, id);
}

export async function listRelatedVods(vodId: string, limit = 6): Promise<Vod[]> {
  await sleep();
  const base = vods.find((v) => v.id === vodId);
  if (!base) return vods.slice(0, limit);
  return vods.filter((v) => v.id !== vodId && v.gameId === base.gameId).slice(0, limit);
}

export async function listTrendingClips(limit = 10): Promise<Clip[]> {
  await sleep();
  return clips.sort((a, b) => b.viewCount - a.viewCount).slice(0, limit);
}

export async function getClipById(id: string): Promise<Clip | null> {
  await sleep();
  return byId(clips, id);
}
