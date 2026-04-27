import { sleep, byId, hoursAgo, daysAgo } from "./_util";
import { streams } from "./streams";
import { profiles } from "./users";

export type ForensicAction =
  | "none"
  | "warned"
  | "session-revoked"
  | "account-suspended"
  | "legal-takedown";

export interface ForensicMark {
  id: string;
  sessionId: string;
  userId: string;
  userHandle: string;
  streamId: string;
  streamTitle: string;
  code: string;
  capturedAt: string;
  action: ForensicAction;
  source: "telegram-leak" | "twitter-clip" | "torrent-tracker" | "youtube-mirror";
  matchConfidence: number; // 0–1
}

function makeCode(seed: number) {
  const segments = [
    seed.toString(36).slice(-4).toUpperCase().padStart(4, "0"),
    Math.round(Math.random() * 0xffff)
      .toString(16)
      .toUpperCase()
      .padStart(4, "0"),
    Math.round(Math.random() * 0xffff)
      .toString(16)
      .toUpperCase()
      .padStart(4, "0"),
    Math.round(Math.random() * 0xffff)
      .toString(16)
      .toUpperCase()
      .padStart(4, "0"),
  ];
  return segments.join("-");
}

const ACTIONS: ForensicAction[] = [
  "none",
  "warned",
  "warned",
  "session-revoked",
  "session-revoked",
  "account-suspended",
  "legal-takedown",
];
const SOURCES: ForensicMark["source"][] = [
  "telegram-leak",
  "twitter-clip",
  "torrent-tracker",
  "youtube-mirror",
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

const sourceStreams = streams.filter((s) => s.isPremium || s.isLive);

export const forensicMarks: ForensicMark[] = (() => {
  const rng = seedRng(7919);
  const realProfiles = profiles.filter((p) => p.role !== "admin");
  const list: ForensicMark[] = [];
  for (let i = 0; i < 36; i++) {
    const profile = realProfiles[Math.floor(rng() * realProfiles.length)]!;
    const stream = sourceStreams[Math.floor(rng() * sourceStreams.length)]!;
    const ageHours = i % 6 === 0 ? Math.round(rng() * 240) : Math.round(rng() * 48);
    list.push({
      id: `fmark_${(i + 1).toString().padStart(3, "0")}`,
      sessionId: `sess_${makeCode(i * 13).toLowerCase().replace(/-/g, "").slice(0, 12)}`,
      userId: profile.id,
      userHandle: profile.handle,
      streamId: stream.id,
      streamTitle: stream.title,
      code: makeCode(i),
      capturedAt: ageHours > 72 ? daysAgo(Math.round(ageHours / 24)) : hoursAgo(ageHours),
      action: ACTIONS[i % ACTIONS.length]!,
      source: SOURCES[i % SOURCES.length]!,
      matchConfidence: Math.round((0.74 + rng() * 0.25) * 100) / 100,
    });
  }
  return list;
})();

export async function listForensicMarks(streamId?: string): Promise<ForensicMark[]> {
  await sleep(80);
  const all = streamId
    ? forensicMarks.filter((m) => m.streamId === streamId)
    : forensicMarks;
  return [...all].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
  );
}

export async function getForensicMark(id: string): Promise<ForensicMark | null> {
  await sleep(40);
  return byId(forensicMarks, id);
}

export async function searchForensicMarksByCode(code: string): Promise<ForensicMark[]> {
  await sleep(60);
  if (!code) return [];
  const q = code.toLowerCase().replace(/[-\s]/g, "");
  return forensicMarks.filter((m) =>
    m.code.toLowerCase().replace(/-/g, "").includes(q),
  );
}
