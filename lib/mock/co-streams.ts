"use client";

import { sleep } from "./_util";
import { playerAvatar, userAvatar } from "./_media";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CoStreamLanguage = "en" | "fr" | "pt" | "ar" | "ha" | "yo" | "ig" | "sw";

export interface CoStreamTrack {
  id: string;
  streamId: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  language: CoStreamLanguage;
  viewerCount: number;
  bitrateKbps: number;
  delaySeconds: number;
  tagline: string;
  isOfficial: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed pool — used for every stream id, picked deterministically
// ─────────────────────────────────────────────────────────────────────────────

interface CreatorSeed {
  handle: string;
  displayName: string;
  language: CoStreamLanguage;
  tagline: string;
}

const CREATOR_POOL: CreatorSeed[] = [
  {
    handle: "official_evo_audio",
    displayName: "EVO TV Official",
    language: "en",
    tagline: "Pro caster duo. Tournament feed audio.",
  },
  {
    handle: "salem_castz",
    displayName: "Salem Casts",
    language: "ar",
    tagline: "Arabic play-by-play, hype delivered.",
  },
  {
    handle: "papi_clutch",
    displayName: "Papi Clutch",
    language: "fr",
    tagline: "Commentaire francophone, énergie 100%.",
  },
  {
    handle: "kemi_analyst",
    displayName: "Kemi Analyst",
    language: "en",
    tagline: "Tactical breakdowns + post-play audit.",
  },
  {
    handle: "cracked_caster",
    displayName: "Cracked Caster",
    language: "en",
    tagline: "Hype-only. Bring earplugs.",
  },
  {
    handle: "naija_nuke",
    displayName: "Naija Nuke",
    language: "yo",
    tagline: "Yoruba commentary. Lagos finest.",
  },
  {
    handle: "swahili_streamer",
    displayName: "Bahati TV",
    language: "sw",
    tagline: "Swahili call. East Africa watching.",
  },
  {
    handle: "headshot_judge",
    displayName: "HeadshotJudge",
    language: "en",
    tagline: "Watch-along + replay reactions.",
  },
  {
    handle: "lusofone_live",
    displayName: "Lusofone Live",
    language: "pt",
    tagline: "Comentário em Português. Angola ↔ Moçambique.",
  },
  {
    handle: "viper_viewer",
    displayName: "Viper Viewer",
    language: "en",
    tagline: "Casual co-stream, chat-driven.",
  },
];

// Simple deterministic hash → stable picks per streamId.
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickN<T>(list: T[], seed: string, n: number): T[] {
  const h = hashSeed(seed);
  const offset = h % list.length;
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    out.push(list[(offset + i) % list.length]!);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns 5–8 deterministic co-stream tracks per streamId. The first track is
 * always the "Official" feed (audio mux baseline).
 */
export async function listCoStreamTracks(streamId: string): Promise<CoStreamTrack[]> {
  await sleep(140);
  const seedHash = hashSeed(streamId);
  const count = 5 + (seedHash % 4); // 5..8 inclusive
  const picks = pickN(CREATOR_POOL, streamId, count);

  return picks.map((c, idx) => {
    const isOfficial = idx === 0;
    const localHash = hashSeed(`${streamId}_${c.handle}`);
    const baseViewers = isOfficial ? 8_000 + (localHash % 12_000) : 200 + (localHash % 4_500);
    const bitrate = isOfficial ? 6_000 : 2_500 + (localHash % 3_000);
    const delay = isOfficial ? 0 : 2 + (localHash % 12);
    return {
      id: `costream_${streamId}_${c.handle}`,
      streamId,
      handle: isOfficial ? "official_feed" : c.handle,
      displayName: isOfficial ? "Official Tournament Audio" : c.displayName,
      avatarUrl: isOfficial
        ? "/evo-logo/evo-tv-152.png"
        : idx % 2 === 0
        ? userAvatar(c.handle)
        : playerAvatar(c.handle),
      language: c.language,
      viewerCount: baseViewers,
      bitrateKbps: bitrate,
      delaySeconds: delay,
      tagline: isOfficial ? "Tournament broadcast feed. No commentary overlay." : c.tagline,
      isOfficial,
    };
  });
}
