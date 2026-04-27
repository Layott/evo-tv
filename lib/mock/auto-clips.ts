import { sleep, byId, hoursAgo, minutesAgo } from "./_util";
import { clipThumb } from "./_media";
import { streams } from "./streams";
import { vods } from "./vods";

export type AutoClipTrigger = "chat-spike" | "score-event" | "killstreak" | "highlight-tag" | "casters-hyped";
export type AutoClipStatus = "pending" | "approved" | "discarded";

export interface AutoClip {
  id: string;
  streamId: string;
  streamTitle: string;
  vodId: string | null;
  trigger: AutoClipTrigger;
  startSec: number;
  endSec: number;
  thumbnailUrl: string;
  status: AutoClipStatus;
  detectedAt: string;
  caption: string;
  confidence: number;
  highlightLabel: string;
}

export interface AutoClipperSettings {
  chatSpikeMessagesPerSec: number;
  killstreakMinKills: number;
  scoreEventTypes: ("ace" | "clutch" | "comeback" | "first-blood")[];
  minClipDurationSec: number;
  maxClipDurationSec: number;
  autoApproveAboveConfidence: number;
  enabled: boolean;
}

const HIGHLIGHTS: Record<AutoClipTrigger, { label: string; captions: string[] }> = {
  "chat-spike": {
    label: "Chat spike",
    captions: [
      "Chat exploded — 14× baseline messages in 6s",
      "Hype meter pegged red, viewers reacting hard",
      "Massive emote spam, something just happened",
    ],
  },
  "score-event": {
    label: "Score event",
    captions: [
      "Decisive round-winning play",
      "Map point converted",
      "Comeback kill chain",
    ],
  },
  "killstreak": {
    label: "Killstreak",
    captions: [
      "5-piece killstreak in under 8 seconds",
      "Quad-kill, last enemy traded",
      "Triple in mid, 1v3 conversion",
    ],
  },
  "highlight-tag": {
    label: "Caster tag",
    captions: [
      "Caster tagged this moment for highlights",
      "Production cut — flagged as feature clip",
      "Director clip — bracketed with replay",
    ],
  },
  "casters-hyped": {
    label: "Casters hyped",
    captions: [
      "Caster volume spike — they lost it on-air",
      "Booth went off after the play",
      "Co-caster screamed live",
    ],
  },
};

const TRIGGERS: AutoClipTrigger[] = [
  "chat-spike",
  "score-event",
  "killstreak",
  "highlight-tag",
  "casters-hyped",
];

const STATUSES: AutoClipStatus[] = [
  "pending",
  "pending",
  "pending",
  "approved",
  "approved",
  "discarded",
];

function seedRng(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSeed(): AutoClip[] {
  const list: AutoClip[] = [];
  const rng = seedRng(101);
  for (let i = 0; i < 24; i++) {
    const stream = streams[i % streams.length]!;
    const trig = TRIGGERS[i % TRIGGERS.length]!;
    const captions = HIGHLIGHTS[trig].captions;
    const start = Math.round(60 + rng() * 1_200);
    const dur = Math.round(20 + rng() * 40);
    const ageMin = i < 8 ? Math.round(rng() * 90) : Math.round(rng() * 720);
    list.push({
      id: `autoclip_${(i + 1).toString().padStart(3, "0")}`,
      streamId: stream.id,
      streamTitle: stream.title,
      vodId: i % 3 === 0 ? vods[i % vods.length]!.id : null,
      trigger: trig,
      startSec: start,
      endSec: start + dur,
      thumbnailUrl: clipThumb(`autoclip_${i}`),
      status: STATUSES[i % STATUSES.length]!,
      detectedAt: ageMin < 60 ? minutesAgo(ageMin) : hoursAgo(Math.round(ageMin / 60)),
      caption: captions[i % captions.length]!,
      confidence: Math.round((0.55 + rng() * 0.45) * 100) / 100,
      highlightLabel: HIGHLIGHTS[trig].label,
    });
  }
  return list;
}

const STORAGE_CLIPS = "evotv_auto_clips_v1";
const STORAGE_SETTINGS = "evotv_auto_clipper_settings_v1";

function load(): AutoClip[] {
  if (typeof window === "undefined") return buildSeed();
  try {
    const raw = window.localStorage.getItem(STORAGE_CLIPS);
    if (raw) return JSON.parse(raw) as AutoClip[];
  } catch {
    /* noop */
  }
  const seed = buildSeed();
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_CLIPS, JSON.stringify(seed));
    }
  } catch {
    /* noop */
  }
  return seed;
}

function persist(list: AutoClip[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_CLIPS, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

const DEFAULT_SETTINGS: AutoClipperSettings = {
  chatSpikeMessagesPerSec: 12,
  killstreakMinKills: 4,
  scoreEventTypes: ["ace", "clutch", "comeback"],
  minClipDurationSec: 15,
  maxClipDurationSec: 60,
  autoApproveAboveConfidence: 0.92,
  enabled: true,
};

function loadSettings(): AutoClipperSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_SETTINGS);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as AutoClipperSettings) };
  } catch {
    /* noop */
  }
  return DEFAULT_SETTINGS;
}

function persistSettings(s: AutoClipperSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

export async function listAutoClips(filter?: {
  status?: AutoClipStatus;
  streamId?: string;
  trigger?: AutoClipTrigger;
}): Promise<AutoClip[]> {
  await sleep(80);
  let list = load();
  if (filter?.status) list = list.filter((c) => c.status === filter.status);
  if (filter?.streamId) list = list.filter((c) => c.streamId === filter.streamId);
  if (filter?.trigger) list = list.filter((c) => c.trigger === filter.trigger);
  return [...list].sort(
    (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
  );
}

export async function previewClip(id: string): Promise<AutoClip | null> {
  await sleep(50);
  return byId(load(), id);
}

export async function approveAutoClip(id: string): Promise<AutoClip | null> {
  await sleep(80);
  const list = load();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx]!, status: "approved" };
  persist(list);
  return list[idx]!;
}

export async function discardAutoClip(id: string): Promise<AutoClip | null> {
  await sleep(80);
  const list = load();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx]!, status: "discarded" };
  persist(list);
  return list[idx]!;
}

export async function getAutoClipperSettings(): Promise<AutoClipperSettings> {
  await sleep(40);
  return loadSettings();
}

export async function updateAutoClipperSettings(
  patch: Partial<AutoClipperSettings>,
): Promise<AutoClipperSettings> {
  await sleep(60);
  const next = { ...loadSettings(), ...patch };
  persistSettings(next);
  return next;
}

export const AUTO_CLIP_TRIGGERS = TRIGGERS;
export const AUTO_CLIP_STATUSES = ["pending", "approved", "discarded"] as const;
