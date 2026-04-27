"use client";

import type { Profile } from "@/lib/types";
import { sleep, hoursAgo, minutesAgo, now } from "./_util";
import { chatAvatar, userAvatar } from "./_media";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type WatchPartyVisibility = "public" | "invite";
export type WatchPartyLanguage = "en" | "fr" | "pt" | "ar" | "ha" | "yo" | "ig" | "sw";

export interface WatchPartyMember {
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  joinedAt: string;
  isHost: boolean;
}

export interface WatchParty {
  id: string;
  name: string;
  streamId: string;
  streamTitle: string;
  streamThumbnailUrl: string;
  hostId: string;
  hostHandle: string;
  hostDisplayName: string;
  hostAvatarUrl: string;
  visibility: WatchPartyVisibility;
  language: WatchPartyLanguage;
  maxGuests: number;
  members: WatchPartyMember[];
  viewerCount: number;
  createdAt: string;
  topic: string;
}

export interface PartyMessage {
  id: string;
  partyId: string;
  userId: string;
  userHandle: string;
  userAvatarUrl: string;
  body: string;
  createdAt: string;
  isSystem?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// LocalStorage keys
// ─────────────────────────────────────────────────────────────────────────────

const PARTIES_KEY = "evotv_watch_parties_v1";
const PARTY_MESSAGES_KEY = "evotv_watch_party_messages_v1";

// ─────────────────────────────────────────────────────────────────────────────
// Seed data
// ─────────────────────────────────────────────────────────────────────────────

const LANGUAGE_LABELS: Record<WatchPartyLanguage, string> = {
  en: "English",
  fr: "French",
  pt: "Portuguese",
  ar: "Arabic",
  ha: "Hausa",
  yo: "Yoruba",
  ig: "Igbo",
  sw: "Swahili",
};

export function partyLanguageLabel(code: WatchPartyLanguage): string {
  return LANGUAGE_LABELS[code] ?? code;
}

export const PARTY_LANGUAGE_OPTIONS: ReadonlyArray<{ value: WatchPartyLanguage; label: string }> =
  Object.entries(LANGUAGE_LABELS).map(([value, label]) => ({
    value: value as WatchPartyLanguage,
    label,
  }));

function makeMember(
  userId: string,
  handle: string,
  displayName: string,
  isHost: boolean,
  joinedMinutesAgo = 30,
): WatchPartyMember {
  return {
    userId,
    handle,
    displayName,
    avatarUrl: userAvatar(handle),
    joinedAt: minutesAgo(joinedMinutesAgo),
    isHost,
  };
}

const seedParties: WatchParty[] = [
  {
    id: "wp_lagos_squad",
    name: "Lagos Squad — Semis Watch",
    streamId: "stream_lagos_final",
    streamTitle: "EVO Lagos Invitational — Semifinal 1 LIVE",
    streamThumbnailUrl: "/esports-pro-league-playoff-match.jpg",
    hostId: "user_premium",
    hostHandle: "pro_watcher",
    hostDisplayName: "Chinedu Pro",
    hostAvatarUrl: userAvatar("pro_watcher"),
    visibility: "public",
    language: "en",
    maxGuests: 50,
    members: [
      makeMember("user_premium", "pro_watcher", "Chinedu Pro", true, 90),
      makeMember("user_10", "viewer10", "Viewer 10", false, 60),
      makeMember("user_11", "viewer11", "Viewer 11", false, 45),
      makeMember("user_12", "viewer12", "Viewer 12", false, 30),
      makeMember("user_13", "viewer13", "Viewer 13", false, 22),
      makeMember("user_14", "viewer14", "Viewer 14", false, 18),
      makeMember("user_15", "viewer15", "Viewer 15", false, 12),
      makeMember("user_16", "viewer16", "Viewer 16", false, 8),
    ],
    viewerCount: 8,
    createdAt: hoursAgo(2),
    topic: "Predictions for the BO5. Alpha or Nova?",
  },
  {
    id: "wp_casablanca_arabic",
    name: "Casablanca Arabic Audio Room",
    streamId: "stream_casablanca",
    streamTitle: "PUBG Mobile Casablanca Classic — Final Day",
    streamThumbnailUrl: "/esports-championship-finals-live-stream.jpg",
    hostId: "user_17",
    hostHandle: "viewer17",
    hostDisplayName: "Karim B.",
    hostAvatarUrl: userAvatar("viewer17"),
    visibility: "public",
    language: "ar",
    maxGuests: 30,
    members: [
      makeMember("user_17", "viewer17", "Karim B.", true, 75),
      makeMember("user_18", "viewer18", "Viewer 18", false, 55),
      makeMember("user_19", "viewer19", "Viewer 19", false, 40),
      makeMember("user_20", "viewer20", "Viewer 20", false, 25),
      makeMember("user_21", "viewer21", "Viewer 21", false, 14),
    ],
    viewerCount: 5,
    createdAt: hoursAgo(1),
    topic: "تعليق عربي للنهائي. Tune in for Arabic commentary.",
  },
  {
    id: "wp_alpha_diehards",
    name: "Team Alpha Diehards",
    streamId: "stream_lagos_final",
    streamTitle: "EVO Lagos Invitational — Semifinal 1 LIVE",
    streamThumbnailUrl: "/esports-pro-league-playoff-match.jpg",
    hostId: "user_22",
    hostHandle: "viewer22",
    hostDisplayName: "AlphaWolf",
    hostAvatarUrl: userAvatar("viewer22"),
    visibility: "public",
    language: "en",
    maxGuests: 25,
    members: [
      makeMember("user_22", "viewer22", "AlphaWolf", true, 50),
      makeMember("user_23", "viewer23", "Viewer 23", false, 32),
      makeMember("user_24", "viewer24", "Viewer 24", false, 28),
      makeMember("user_25", "viewer25", "Viewer 25", false, 12),
    ],
    viewerCount: 4,
    createdAt: hoursAgo(1),
    topic: "Only true Alpha believers. Bring the energy.",
  },
  {
    id: "wp_codm_scrim_room",
    name: "Pre-Cairo Cup Scrim Talk",
    streamId: "stream_codm_scrim",
    streamTitle: "CoD Mobile Scrim Night — Titan vs Rogue",
    streamThumbnailUrl: "/esports-pro-league-event.jpg",
    hostId: "user_26",
    hostHandle: "viewer26",
    hostDisplayName: "Recoil_King",
    hostAvatarUrl: userAvatar("viewer26"),
    visibility: "public",
    language: "en",
    maxGuests: 40,
    members: [
      makeMember("user_26", "viewer26", "Recoil_King", true, 40),
      makeMember("user_27", "viewer27", "Viewer 27", false, 30),
      makeMember("user_28", "viewer28", "Viewer 28", false, 22),
      makeMember("user_29", "viewer29", "Viewer 29", false, 12),
      makeMember("user_10", "viewer10", "Viewer 10", false, 5),
    ],
    viewerCount: 5,
    createdAt: minutesAgo(45),
    topic: "Map pool predictions + analyst notes.",
  },
  {
    id: "wp_eafc_couch",
    name: "Couch Co-stream — EA FC",
    streamId: "stream_eafc_watch",
    streamTitle: "EA FC Continental — Watch Party",
    streamThumbnailUrl: "/esports-tournament-match.jpg",
    hostId: "user_11",
    hostHandle: "viewer11",
    hostDisplayName: "Goal_Engine",
    hostAvatarUrl: userAvatar("viewer11"),
    visibility: "public",
    language: "en",
    maxGuests: 20,
    members: [
      makeMember("user_11", "viewer11", "Goal_Engine", true, 35),
      makeMember("user_30", "viewer30", "Viewer 30", false, 20),
      makeMember("user_31", "viewer31", "Viewer 31", false, 8),
    ],
    viewerCount: 3,
    createdAt: minutesAgo(35),
    topic: "Tactical commentary. No wojaks.",
  },
  {
    id: "wp_film_room_premium",
    name: "Film Room Watch Club",
    streamId: "stream_premium_analysis",
    streamTitle: "Post-match Film Room — Week 4",
    streamThumbnailUrl: "/interview-panel.png",
    hostId: "user_premium",
    hostHandle: "pro_watcher",
    hostDisplayName: "Chinedu Pro",
    hostAvatarUrl: userAvatar("pro_watcher"),
    visibility: "invite",
    language: "en",
    maxGuests: 10,
    members: [
      makeMember("user_premium", "pro_watcher", "Chinedu Pro", true, 22),
      makeMember("user_admin", "evo_admin", "EVO Admin", false, 18),
      makeMember("user_20", "viewer20", "Viewer 20", false, 8),
    ],
    viewerCount: 3,
    createdAt: minutesAgo(22),
    topic: "Premium subs only. Bring notes.",
  },
  {
    id: "wp_french_african_room",
    name: "Salon Francophone",
    streamId: "stream_lagos_final",
    streamTitle: "EVO Lagos Invitational — Semifinal 1 LIVE",
    streamThumbnailUrl: "/esports-pro-league-playoff-match.jpg",
    hostId: "user_32",
    hostHandle: "viewer32",
    hostDisplayName: "Yves D.",
    hostAvatarUrl: userAvatar("viewer32"),
    visibility: "public",
    language: "fr",
    maxGuests: 30,
    members: [
      makeMember("user_32", "viewer32", "Yves D.", true, 28),
      makeMember("user_33", "viewer33", "Viewer 33", false, 18),
      makeMember("user_34", "viewer34", "Viewer 34", false, 11),
      makeMember("user_35", "viewer35", "Viewer 35", false, 5),
    ],
    viewerCount: 4,
    createdAt: minutesAgo(28),
    topic: "Commentaire en français. Bienvenue!",
  },
];

const PARTY_CHAT_BODIES = [
  "alpha taking the rotation 👀",
  "comp pick gonna decide it",
  "yo who's hosting next round",
  "I called this drop spot last week",
  "audio mix is clean today",
  "nova IGL is cracked though",
  "Lagos in the building 🇳🇬",
  "this is why we sub",
  "watching from Casablanca, hi all",
  "aim duels look insane",
  "Goal_Engine has notes lol",
  "anyone got the bracket link?",
  "hype hype hype",
  "pog timing on that smoke",
  "stream lag for anyone else? mine clean",
  "PARTY 🎉",
  "good vibes only ✨",
  "we eating tonight",
  "let's go!",
  "nooo that was a free win",
];

const PARTY_CHAT_SENDERS: Array<{ id: string; handle: string; display: string }> = [
  { id: "user_10", handle: "viewer10", display: "Viewer 10" },
  { id: "user_11", handle: "viewer11", display: "Goal_Engine" },
  { id: "user_premium", handle: "pro_watcher", display: "Chinedu Pro" },
  { id: "user_22", handle: "viewer22", display: "AlphaWolf" },
  { id: "user_26", handle: "viewer26", display: "Recoil_King" },
  { id: "user_17", handle: "viewer17", display: "Karim B." },
  { id: "user_32", handle: "viewer32", display: "Yves D." },
];

function seedMessagesForParty(partyId: string, count = 18): PartyMessage[] {
  return Array.from({ length: count }, (_, i) => {
    const sender = PARTY_CHAT_SENDERS[i % PARTY_CHAT_SENDERS.length]!;
    return {
      id: `partymsg_${partyId}_${i}`,
      partyId,
      userId: sender.id,
      userHandle: sender.handle,
      userAvatarUrl: chatAvatar(sender.handle),
      body: PARTY_CHAT_BODIES[i % PARTY_CHAT_BODIES.length]!,
      createdAt: minutesAgo(count - i),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LocalStorage helpers
// ─────────────────────────────────────────────────────────────────────────────

function readParties(): WatchParty[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PARTIES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as WatchParty[];
  } catch {
    return null;
  }
}

function writeParties(parties: WatchParty[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PARTIES_KEY, JSON.stringify(parties));
  } catch {
    /* noop */
  }
}

function readPartyMessages(): Record<string, PartyMessage[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PARTY_MESSAGES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, PartyMessage[]>;
  } catch {
    return {};
  }
}

function writePartyMessages(map: Record<string, PartyMessage[]>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PARTY_MESSAGES_KEY, JSON.stringify(map));
  } catch {
    /* noop */
  }
}

function ensureSeeded(): WatchParty[] {
  const existing = readParties();
  if (existing && existing.length > 0) return existing;
  writeParties(seedParties);
  // Also seed messages for each party
  const msgMap = readPartyMessages();
  if (Object.keys(msgMap).length === 0) {
    const next: Record<string, PartyMessage[]> = {};
    for (const p of seedParties) next[p.id] = seedMessagesForParty(p.id);
    writePartyMessages(next);
  }
  return seedParties;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function listWatchParties(filter?: {
  hostedBy?: string;
  joinedBy?: string;
  visibility?: WatchPartyVisibility;
}): Promise<WatchParty[]> {
  await sleep(150);
  let parties = ensureSeeded();
  if (filter?.hostedBy) parties = parties.filter((p) => p.hostId === filter.hostedBy);
  if (filter?.joinedBy)
    parties = parties.filter((p) => p.members.some((m) => m.userId === filter.joinedBy));
  if (filter?.visibility) parties = parties.filter((p) => p.visibility === filter.visibility);
  // Sort by most recent activity (createdAt desc)
  return [...parties].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getWatchPartyById(id: string): Promise<WatchParty | null> {
  await sleep(120);
  const parties = ensureSeeded();
  return parties.find((p) => p.id === id) ?? null;
}

export interface CreateWatchPartyInput {
  name: string;
  streamId: string;
  streamTitle: string;
  streamThumbnailUrl: string;
  visibility: WatchPartyVisibility;
  language: WatchPartyLanguage;
  maxGuests: number;
  topic?: string;
  host: Pick<Profile, "id" | "handle" | "displayName" | "avatarUrl">;
}

export async function createWatchParty(input: CreateWatchPartyInput): Promise<WatchParty> {
  await sleep(200);
  const parties = ensureSeeded();
  const id = `wp_local_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
  const hostMember: WatchPartyMember = {
    userId: input.host.id,
    handle: input.host.handle,
    displayName: input.host.displayName,
    avatarUrl: input.host.avatarUrl,
    joinedAt: now(),
    isHost: true,
  };
  const party: WatchParty = {
    id,
    name: input.name.trim(),
    streamId: input.streamId,
    streamTitle: input.streamTitle,
    streamThumbnailUrl: input.streamThumbnailUrl,
    hostId: input.host.id,
    hostHandle: input.host.handle,
    hostDisplayName: input.host.displayName,
    hostAvatarUrl: input.host.avatarUrl,
    visibility: input.visibility,
    language: input.language,
    maxGuests: Math.max(2, Math.min(100, input.maxGuests)),
    members: [hostMember],
    viewerCount: 1,
    createdAt: now(),
    topic: (input.topic ?? "").trim(),
  };
  const next = [party, ...parties];
  writeParties(next);
  // Seed empty message list for room
  const msgMap = readPartyMessages();
  msgMap[id] = [
    {
      id: `partymsg_${id}_sys_${Date.now()}`,
      partyId: id,
      userId: "system",
      userHandle: "system",
      userAvatarUrl: "/evo-logo/evo-tv-152.png",
      body: `${input.host.displayName} created the party. Welcome.`,
      createdAt: now(),
      isSystem: true,
    },
  ];
  writePartyMessages(msgMap);
  return party;
}

export async function joinWatchParty(
  partyId: string,
  user: Pick<Profile, "id" | "handle" | "displayName" | "avatarUrl">,
): Promise<WatchParty | null> {
  await sleep(150);
  const parties = ensureSeeded();
  const idx = parties.findIndex((p) => p.id === partyId);
  if (idx < 0) return null;
  const party = parties[idx]!;
  if (party.members.some((m) => m.userId === user.id)) return party;
  if (party.members.length >= party.maxGuests) return party;
  const updated: WatchParty = {
    ...party,
    members: [
      ...party.members,
      {
        userId: user.id,
        handle: user.handle,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        joinedAt: now(),
        isHost: false,
      },
    ],
    viewerCount: party.viewerCount + 1,
  };
  const next = [...parties];
  next[idx] = updated;
  writeParties(next);
  // Append system message
  const map = readPartyMessages();
  const msgs = map[partyId] ?? [];
  msgs.push({
    id: `partymsg_${partyId}_join_${Date.now()}`,
    partyId,
    userId: "system",
    userHandle: "system",
    userAvatarUrl: "/evo-logo/evo-tv-152.png",
    body: `${user.displayName} joined the party.`,
    createdAt: now(),
    isSystem: true,
  });
  map[partyId] = msgs;
  writePartyMessages(map);
  return updated;
}

export async function leaveWatchParty(partyId: string, userId: string): Promise<WatchParty | null> {
  await sleep(120);
  const parties = ensureSeeded();
  const idx = parties.findIndex((p) => p.id === partyId);
  if (idx < 0) return null;
  const party = parties[idx]!;
  const member = party.members.find((m) => m.userId === userId);
  if (!member) return party;
  // Host leaving deletes the party entirely (mock behaviour).
  if (member.isHost) {
    const next = parties.filter((p) => p.id !== partyId);
    writeParties(next);
    const map = readPartyMessages();
    delete map[partyId];
    writePartyMessages(map);
    return null;
  }
  const updated: WatchParty = {
    ...party,
    members: party.members.filter((m) => m.userId !== userId),
    viewerCount: Math.max(0, party.viewerCount - 1),
  };
  const next = [...parties];
  next[idx] = updated;
  writeParties(next);
  const map = readPartyMessages();
  const msgs = map[partyId] ?? [];
  msgs.push({
    id: `partymsg_${partyId}_leave_${Date.now()}`,
    partyId,
    userId: "system",
    userHandle: "system",
    userAvatarUrl: "/evo-logo/evo-tv-152.png",
    body: `${member.displayName} left.`,
    createdAt: now(),
    isSystem: true,
  });
  map[partyId] = msgs;
  writePartyMessages(map);
  return updated;
}

export async function listPartyMessages(partyId: string): Promise<PartyMessage[]> {
  await sleep(80);
  ensureSeeded();
  const map = readPartyMessages();
  if (!map[partyId]) {
    const seeded = seedMessagesForParty(partyId);
    map[partyId] = seeded;
    writePartyMessages(map);
    return seeded;
  }
  return map[partyId]!;
}

export async function addPartyMessage(
  partyId: string,
  msg: Omit<PartyMessage, "id" | "partyId" | "createdAt">,
): Promise<PartyMessage> {
  await sleep(40);
  const map = readPartyMessages();
  const list = map[partyId] ?? [];
  const full: PartyMessage = {
    ...msg,
    id: `partymsg_${partyId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    partyId,
    createdAt: now(),
  };
  list.push(full);
  map[partyId] = list;
  writePartyMessages(map);
  return full;
}

/** Generates a fake incoming message for ambient party chatter. Pure (no persistence). */
export function makeIncomingPartyMessage(partyId: string): PartyMessage {
  const sender = PARTY_CHAT_SENDERS[Math.floor(Math.random() * PARTY_CHAT_SENDERS.length)]!;
  return {
    id: `partymsg_${partyId}_inc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    partyId,
    userId: sender.id,
    userHandle: sender.handle,
    userAvatarUrl: chatAvatar(sender.handle),
    body: PARTY_CHAT_BODIES[Math.floor(Math.random() * PARTY_CHAT_BODIES.length)]!,
    createdAt: now(),
  };
}
