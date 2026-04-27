// Creator Program mock module.
// Phase F mock — every helper preserves the signature it will keep when swapped to lib/api/creators.

import { sleep, daysAgo, hoursAgo, minutesAgo } from "./_util";
import { clipThumb, vodPoster } from "./_media";

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------
export type ApplicationStatus = "submitted" | "in_review" | "approved" | "rejected";

export interface CreatorApplication {
  id: string;
  userId: string;
  bio: string;
  country: string;
  primaryGameId: string;
  socialPlatform: "youtube" | "twitch" | "tiktok" | "kick" | "other";
  socialHandle: string;
  followerCount: number;
  agreementAccepted: boolean;
  status: ApplicationStatus;
  submittedAt: string;
  reviewedAt: string | null;
}

export type PayoutStatus = "paid" | "processing" | "scheduled" | "held";

export interface CreatorPayout {
  id: string;
  userId: string;
  monthIso: string; // first of month e.g. 2025-12-01
  monthLabel: string; // "Dec 2025"
  grossCoins: number;
  platformFeeCoins: number;
  netCoins: number;
  status: PayoutStatus;
  payoutMethod: "paystack" | "bank_transfer" | "evo_wallet";
}

export type ClipStatus = "pending" | "approved" | "discarded" | "published";

export interface CreatorClipDraft {
  id: string;
  userId: string;
  title: string;
  thumbnailUrl: string;
  durationSec: number;
  capturedAt: string;
  vodSourceTitle: string;
  status: ClipStatus;
  highlightScore: number; // 0..100 — mock auto-clipper confidence
}

export interface CreatorMetrics {
  userId: string;
  monthLabel: string;
  hoursStreamed: number;
  averageConcurrent: number;
  peakConcurrent: number;
  totalTipsCoins: number;
  followerGrowth: number;
  followerGrowthPct: number;
  newSubs: number;
  watchHours: number;
}

export interface AudienceStat {
  countries: Array<{ code: string; label: string; viewers: number }>;
  ages: Array<{ bucket: string; pct: number }>;
  peakHours: Array<{ hour: string; viewers: number }>;
  devices: Array<{ device: string; pct: number }>;
}

// -------------------------------------------------------------------
// Persistence
// -------------------------------------------------------------------
const STORAGE_KEY = "evotv_creators_v1";

interface PersistedState {
  applications: CreatorApplication[];
  appliedUserIds: string[];
  clipStatus: Record<string, ClipStatus>; // override keyed by clipId
  seeded: boolean;
}

function emptyState(): PersistedState {
  return { applications: [], appliedUserIds: [], clipStatus: {}, seeded: false };
}

function loadState(): PersistedState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      applications: parsed.applications ?? [],
      appliedUserIds: parsed.appliedUserIds ?? [],
      clipStatus: parsed.clipStatus ?? {},
      seeded: !!parsed.seeded,
    };
  } catch {
    return emptyState();
  }
}

function saveState(s: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

// -------------------------------------------------------------------
// Seed data
// -------------------------------------------------------------------
const MONTHS = [
  { iso: "2025-05-01", label: "May 2025" },
  { iso: "2025-06-01", label: "Jun 2025" },
  { iso: "2025-07-01", label: "Jul 2025" },
  { iso: "2025-08-01", label: "Aug 2025" },
  { iso: "2025-09-01", label: "Sep 2025" },
  { iso: "2025-10-01", label: "Oct 2025" },
  { iso: "2025-11-01", label: "Nov 2025" },
  { iso: "2025-12-01", label: "Dec 2025" },
  { iso: "2026-01-01", label: "Jan 2026" },
  { iso: "2026-02-01", label: "Feb 2026" },
  { iso: "2026-03-01", label: "Mar 2026" },
  { iso: "2026-04-01", label: "Apr 2026" },
];

function buildPayouts(userId: string): CreatorPayout[] {
  return MONTHS.map((m, i) => {
    const gross = 18_000 + i * 4_200 + ((i * 13) % 7) * 1_100;
    const fee = Math.round(gross * 0.3);
    const net = gross - fee;
    let status: PayoutStatus = "paid";
    if (i === MONTHS.length - 1) status = "processing";
    else if (i === MONTHS.length - 2) status = "scheduled";
    return {
      id: `payout_${userId}_${m.iso}`,
      userId,
      monthIso: m.iso,
      monthLabel: m.label,
      grossCoins: gross,
      platformFeeCoins: fee,
      netCoins: net,
      status,
      payoutMethod: i % 3 === 0 ? "bank_transfer" : i % 3 === 1 ? "paystack" : "evo_wallet",
    };
  });
}

function buildClipDrafts(userId: string): CreatorClipDraft[] {
  const titles = [
    "Insane 1v4 clutch — final ring",
    "Triple kill in 4 seconds",
    "Caster reaction: GOAT moment",
    "Squad wipe at A-site",
    "No-scope from 200m",
    "Last-second goal — extra time",
    "Mythic blueprint reveal",
    "First open-mic moment of the season",
    "Game-winning play vs Nova Esports",
    "Crowd erupts after grand-final win",
    "Trick-shot compilation — Day 1",
    "Failed wallhack cosplay (lol)",
  ];
  const sourceVods = [
    "EVO Lagos Final",
    "PUBGM Casablanca Day 2",
    "CoD Mobile Cairo Cup",
    "Free Fire Continental",
    "EA FC Ultimate Team",
  ];
  return titles.map((title, i) => ({
    id: `clip_${userId}_${i + 1}`,
    userId,
    title,
    thumbnailUrl: clipThumb(`creator_clip_${i}`),
    durationSec: 18 + (i % 6) * 6,
    capturedAt: i < 3 ? hoursAgo(i + 1) : daysAgo(Math.max(1, i - 1)),
    vodSourceTitle: sourceVods[i % sourceVods.length]!,
    status: "pending",
    highlightScore: 60 + (i * 7) % 38,
  }));
}

const AUDIENCE_FOR_USER: Record<string, AudienceStat> = {};

function buildAudience(userId: string): AudienceStat {
  if (AUDIENCE_FOR_USER[userId]) return AUDIENCE_FOR_USER[userId]!;
  const stat: AudienceStat = {
    countries: [
      { code: "NG", label: "Nigeria", viewers: 4_280 },
      { code: "ZA", label: "South Africa", viewers: 1_640 },
      { code: "KE", label: "Kenya", viewers: 1_220 },
      { code: "GH", label: "Ghana", viewers: 980 },
      { code: "MA", label: "Morocco", viewers: 720 },
      { code: "EG", label: "Egypt", viewers: 640 },
      { code: "Other", label: "Other", viewers: 880 },
    ],
    ages: [
      { bucket: "13–17", pct: 12 },
      { bucket: "18–24", pct: 41 },
      { bucket: "25–34", pct: 32 },
      { bucket: "35–44", pct: 11 },
      { bucket: "45+", pct: 4 },
    ],
    peakHours: Array.from({ length: 24 }, (_, h) => {
      // Two peaks: lunch + evening prime time
      const lunch = h >= 12 && h <= 14 ? 1.6 : 1;
      const prime = h >= 19 && h <= 23 ? 2.1 : 1;
      const dip = h >= 2 && h <= 6 ? 0.3 : 1;
      const base = 80 + ((h * 41) % 60);
      return {
        hour: `${h.toString().padStart(2, "0")}:00`,
        viewers: Math.round(base * lunch * prime * dip),
      };
    }),
    devices: [
      { device: "Mobile", pct: 78 },
      { device: "Desktop", pct: 14 },
      { device: "TV", pct: 8 },
    ],
  };
  AUDIENCE_FOR_USER[userId] = stat;
  return stat;
}

// -------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------
export async function submitApplication(payload: {
  userId: string;
  bio: string;
  country: string;
  primaryGameId: string;
  socialPlatform: CreatorApplication["socialPlatform"];
  socialHandle: string;
  followerCount: number;
  agreementAccepted: boolean;
}): Promise<{ success: boolean; application?: CreatorApplication; reason?: string }> {
  await sleep(280);
  if (!payload.agreementAccepted) return { success: false, reason: "Agreement required" };
  if (payload.bio.trim().length < 20)
    return { success: false, reason: "Bio must be at least 20 characters" };
  if (!payload.socialHandle.trim())
    return { success: false, reason: "Social handle required" };
  if (payload.followerCount < 0)
    return { success: false, reason: "Invalid follower count" };

  const state = loadState();
  const existing = state.applications.find((a) => a.userId === payload.userId);
  if (existing) {
    return { success: false, reason: "Application already submitted", application: existing };
  }
  const application: CreatorApplication = {
    id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    userId: payload.userId,
    bio: payload.bio.trim(),
    country: payload.country,
    primaryGameId: payload.primaryGameId,
    socialPlatform: payload.socialPlatform,
    socialHandle: payload.socialHandle.trim(),
    followerCount: payload.followerCount,
    agreementAccepted: payload.agreementAccepted,
    status: "submitted",
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
  };
  state.applications.unshift(application);
  if (!state.appliedUserIds.includes(payload.userId)) {
    state.appliedUserIds.push(payload.userId);
  }
  saveState(state);
  return { success: true, application };
}

export async function listApplications(): Promise<CreatorApplication[]> {
  await sleep(120);
  const state = loadState();
  return state.applications.slice();
}

export async function getMyApplication(userId: string): Promise<CreatorApplication | null> {
  await sleep(80);
  const state = loadState();
  return state.applications.find((a) => a.userId === userId) ?? null;
}

export async function getCreatorMetrics(userId: string): Promise<CreatorMetrics> {
  await sleep(120);
  return {
    userId,
    monthLabel: "Apr 2026",
    hoursStreamed: 87,
    averageConcurrent: 1_240,
    peakConcurrent: 3_180,
    totalTipsCoins: 24_580,
    followerGrowth: 1_840,
    followerGrowthPct: 18,
    newSubs: 96,
    watchHours: 72_400,
  };
}

export async function listPayouts(userId: string): Promise<CreatorPayout[]> {
  await sleep(140);
  return buildPayouts(userId);
}

export async function listClipDrafts(userId: string): Promise<CreatorClipDraft[]> {
  await sleep(160);
  const state = loadState();
  const list = buildClipDrafts(userId);
  return list.map((c) => ({ ...c, status: state.clipStatus[c.id] ?? c.status }));
}

export async function approveClip(clipId: string): Promise<{ success: boolean }> {
  await sleep(120);
  const state = loadState();
  state.clipStatus[clipId] = "approved";
  saveState(state);
  return { success: true };
}

export async function publishClip(clipId: string): Promise<{ success: boolean }> {
  await sleep(160);
  const state = loadState();
  state.clipStatus[clipId] = "published";
  saveState(state);
  return { success: true };
}

export async function discardClip(clipId: string): Promise<{ success: boolean }> {
  await sleep(120);
  const state = loadState();
  state.clipStatus[clipId] = "discarded";
  saveState(state);
  return { success: true };
}

export async function getAudienceBreakdown(userId: string): Promise<AudienceStat> {
  await sleep(120);
  return buildAudience(userId);
}

export async function getCreatorActivity(userId: string): Promise<
  Array<{ id: string; kind: "tip" | "follower" | "clip" | "milestone"; label: string; at: string }>
> {
  await sleep(80);
  return [
    { id: "act_1", kind: "tip", label: "evo_fan tipped 500 EVO Coins", at: minutesAgo(12) },
    { id: "act_2", kind: "follower", label: "+47 new followers in the last hour", at: hoursAgo(1) },
    { id: "act_3", kind: "clip", label: "Auto-clipper queued 3 highlights from your last stream", at: hoursAgo(3) },
    { id: "act_4", kind: "milestone", label: "Hit 50,000 lifetime watch-hours", at: daysAgo(1) },
    { id: "act_5", kind: "tip", label: "moneybag_zee tipped 1,000 EVO Coins", at: daysAgo(2) },
    { id: "act_6", kind: "follower", label: "+312 new followers this week", at: daysAgo(2) },
  ];
}
