import { sleep } from "./_util";

export type AiVoicePresetId = "analyst-male" | "analyst-female" | "hype-male";

export interface AiVoicePreset {
  id: AiVoicePresetId;
  label: string;
  blurb: string;
  sample: string;
}

export interface AiCommentaryConfig {
  streamId: string | null;
  voicePreset: AiVoicePresetId;
  language: string; // matches UserPrefs.language enum
  enabled: boolean;
}

export const VOICE_PRESETS: AiVoicePreset[] = [
  {
    id: "analyst-male",
    label: "Analyst — Male",
    blurb: "Calm, measured pace. Stat-driven. Best for pro matches.",
    sample: "Alpha's win-rate after taking mid is up 18% this split.",
  },
  {
    id: "analyst-female",
    label: "Analyst — Female",
    blurb: "Tactical breakdown. Calm tone. Great for film-room style.",
    sample: "Notice how Nova staggers their entry to bait the rotation.",
  },
  {
    id: "hype-male",
    label: "Hype — Male",
    blurb: "High energy, peak-moment focused. Fits highlights and tournaments.",
    sample: "OH MY DAYS — that 1v4 from Viper just shifted the bracket!",
  },
];

const STORAGE_KEY = "evotv_ai_commentary_v1";

let cache: Record<string, AiCommentaryConfig> | null = null;

function load(): Record<string, AiCommentaryConfig> {
  if (cache) return cache;
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as Record<string, AiCommentaryConfig>) : {};
  } catch {
    cache = {};
  }
  return cache!;
}

function save(map: Record<string, AiCommentaryConfig>) {
  cache = map;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* noop */
  }
}

const DEFAULT: AiCommentaryConfig = {
  streamId: null,
  voicePreset: "analyst-male",
  language: "en",
  enabled: false,
};

export async function listVoicePresets(): Promise<AiVoicePreset[]> {
  await sleep(50);
  return VOICE_PRESETS;
}

export async function getAiCommentaryConfig(
  streamId: string | null = null,
): Promise<AiCommentaryConfig> {
  await sleep(40);
  const map = load();
  const key = streamId ?? "_global";
  return { ...DEFAULT, ...(map[key] ?? {}), streamId };
}

export async function setAiCommentaryConfig(
  patch: Partial<AiCommentaryConfig>,
  streamId: string | null = null,
): Promise<AiCommentaryConfig> {
  await sleep(40);
  const map = load();
  const key = streamId ?? "_global";
  const next = { ...DEFAULT, ...(map[key] ?? {}), ...patch, streamId };
  save({ ...map, [key]: next });
  return next;
}

const COMMENTARY_BY_GAME: Record<string, string[]> = {
  game_freefire: [
    "Alpha pushing aggressive at 0:45, exposing flank to Vortex.",
    "Nova's IGL just dropped a vector — telegraphed the rotation perfectly.",
    "Map heat-map flipped: 70% of fights now in zone B.",
    "Viper's TTK has dropped 12% since the patch. Watch this peek.",
    "Eclipse running 4-stack stagger; risky on a small zone.",
    "Predicted final-circle in NW corner — Apex already pre-rotated.",
    "Stat note: Alpha wins 78% of fights they initiate within 50m.",
    "Two utility advantages remaining for Nova entering the fight.",
    "Probability model gives Vortex a 64% chance to take this round.",
    "Free Fire engine note: bullet drop minimal at this range.",
  ],
  game_codm: [
    "Titan pushing hardpoint with full ult economy — high-percentage play.",
    "Specter's score-per-life is leading the lobby at 1.34.",
    "Anchor positions favor Rogue here, expect a slow rotate.",
    "Killstreak prediction: Titan ready to cash in within 30 seconds.",
    "Map control swung: Specter holding 62% of mid.",
    "Stat watch: Rogue is 0-for-3 on hardpoint contests this map.",
    "Crosshair placement note — pre-aiming common angle pays off.",
  ],
  game_pubgm: [
    "Zenith plays the edge, Hydra holds compound — classic mismatch.",
    "Final ten teams, blue zone closing in 90 seconds.",
    "Vehicle audio just popped — possible third-party from the south.",
    "Hydra's late-circle survival is league-leading at 58%.",
    "Stat overlay: Zenith averages 4.2 fights per match this split.",
  ],
  game_eafc: [
    "Vanguard switching to a 4-3-3 high press — bold call.",
    "Stride's pass completion under pressure dropped to 62%.",
    "Set-piece probability up: Vanguard converts 38% of corners.",
    "Watch the diagonal run from the striker — that lane is open.",
  ],
};

export function getCommentaryLines(gameId: string): string[] {
  return COMMENTARY_BY_GAME[gameId] ?? COMMENTARY_BY_GAME.game_freefire!;
}
