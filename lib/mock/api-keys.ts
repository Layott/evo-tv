import { sleep, daysAgo, hoursAgo } from "./_util";

export type ApiKeyStatus = "active" | "revoked";

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  fullKey?: string;
  createdAt: string;
  lastUsedAt: string | null;
  status: ApiKeyStatus;
  requestsLastMonth: number;
}

export interface ApiUsageDay {
  date: string; // YYYY-MM-DD
  requests: number;
}

export interface ApiUsageBreakdown {
  endpoint: string;
  method: "GET" | "POST" | "DELETE" | "PUT";
  requests: number;
  errorRate: number; // 0–1
  avgLatencyMs: number;
}

const STORAGE_KEY = "evotv_api_keys_v1";

function genKey(prefix = "evo_live") {
  const tail = Array.from({ length: 32 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)],
  ).join("");
  return `${prefix}_${tail}`;
}

function preset(): ApiKey[] {
  return [
    {
      id: "key_default_prod",
      userId: "user_premium",
      name: "Production",
      prefix: "evo_live_3f8a",
      createdAt: daysAgo(42),
      lastUsedAt: hoursAgo(1),
      status: "active",
      requestsLastMonth: 18_420,
    },
    {
      id: "key_default_staging",
      userId: "user_premium",
      name: "Staging",
      prefix: "evo_live_92cd",
      createdAt: daysAgo(31),
      lastUsedAt: hoursAgo(11),
      status: "active",
      requestsLastMonth: 4_120,
    },
    {
      id: "key_default_old",
      userId: "user_premium",
      name: "Legacy CI",
      prefix: "evo_live_aa01",
      createdAt: daysAgo(120),
      lastUsedAt: daysAgo(45),
      status: "revoked",
      requestsLastMonth: 0,
    },
  ];
}

function load(): ApiKey[] {
  if (typeof window === "undefined") return preset();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return preset();
    const parsed = JSON.parse(raw) as ApiKey[];
    return Array.isArray(parsed) && parsed.length ? parsed : preset();
  } catch {
    return preset();
  }
}

function persist(list: ApiKey[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  await sleep(80);
  return load()
    .filter((k) => k.userId === userId || userId === "user_premium" || userId === "user_admin")
    .map((k) => ({ ...k, fullKey: undefined }));
}

export async function createApiKey(name: string, userId: string): Promise<ApiKey> {
  await sleep(120);
  const fullKey = genKey();
  const prefix = fullKey.slice(0, 12);
  const key: ApiKey = {
    id: `key_${Date.now().toString(36)}`,
    userId,
    name: name.trim() || "Untitled key",
    prefix,
    fullKey,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    status: "active",
    requestsLastMonth: 0,
  };
  const next = [...load(), { ...key, fullKey: undefined }];
  persist(next);
  return key;
}

export async function revokeApiKey(id: string): Promise<void> {
  await sleep(80);
  const list = load();
  const idx = list.findIndex((k) => k.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx]!, status: "revoked", lastUsedAt: list[idx]!.lastUsedAt };
    persist(list);
  }
}

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

export async function getApiUsage(
  userId: string,
  days: number,
): Promise<{ daily: ApiUsageDay[]; breakdown: ApiUsageBreakdown[]; quota: number; used: number }> {
  await sleep(60);
  const rng = seedRng(userId.length * 17 + days);
  const now = new Date();
  const daily: ApiUsageDay[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(now.getTime() - (days - 1 - i) * 86_400_000);
    const base = 600 + Math.round(rng() * 800);
    const weekend = d.getDay() === 0 || d.getDay() === 6 ? 0.6 : 1;
    return {
      date: d.toISOString().slice(0, 10),
      requests: Math.round(base * weekend + (i === days - 2 ? 1_400 : 0)),
    };
  });

  const used = daily.reduce((acc, d) => acc + d.requests, 0);

  const breakdown: ApiUsageBreakdown[] = [
    { endpoint: "/v1/streams", method: "GET", requests: Math.round(used * 0.34), errorRate: 0.004, avgLatencyMs: 92 },
    { endpoint: "/v1/events", method: "GET", requests: Math.round(used * 0.21), errorRate: 0.002, avgLatencyMs: 88 },
    { endpoint: "/v1/teams", method: "GET", requests: Math.round(used * 0.16), errorRate: 0.001, avgLatencyMs: 64 },
    { endpoint: "/v1/players", method: "GET", requests: Math.round(used * 0.12), errorRate: 0.003, avgLatencyMs: 71 },
    { endpoint: "/v1/vods", method: "GET", requests: Math.round(used * 0.08), errorRate: 0.005, avgLatencyMs: 110 },
    { endpoint: "/v1/clips", method: "GET", requests: Math.round(used * 0.05), errorRate: 0.006, avgLatencyMs: 95 },
    { endpoint: "/v1/streams/{id}/odds", method: "GET", requests: Math.round(used * 0.04), errorRate: 0.012, avgLatencyMs: 134 },
  ];

  return {
    daily,
    breakdown,
    quota: 50_000,
    used,
  };
}

export const API_DOC_ENDPOINTS = [
  {
    section: "Streams",
    items: [
      {
        id: "list-streams",
        method: "GET" as const,
        path: "/v1/streams",
        title: "List live streams",
        description: "Returns the array of currently live streams. Filter by gameId and isPremium.",
        params: ["gameId", "isPremium", "page", "pageSize"],
        sample: [
          {
            id: "stream_lagos_final",
            title: "EVO Lagos Invitational — Semifinal 1 LIVE",
            gameId: "game_freefire",
            isLive: true,
            viewerCount: 18420,
            language: "en",
          },
        ],
      },
      {
        id: "get-stream",
        method: "GET" as const,
        path: "/v1/streams/{id}",
        title: "Get stream by id",
        description: "Returns full metadata for a single stream including HLS URL.",
        params: ["id"],
        sample: {
          id: "stream_lagos_final",
          title: "EVO Lagos Invitational — Semifinal 1 LIVE",
          hlsUrl: "https://cdn.evo.tv/live/stream_lagos_final.m3u8",
          viewerCount: 18420,
        },
      },
    ],
  },
  {
    section: "Events",
    items: [
      {
        id: "list-events",
        method: "GET" as const,
        path: "/v1/events",
        title: "List events",
        description: "Filter by status (scheduled/live/completed) and gameId.",
        params: ["status", "gameId"],
        sample: [
          {
            id: "event_ff_lagos",
            title: "Free Fire Lagos Invitational",
            status: "live",
            tier: "a",
            prizePoolNgn: 25_000_000,
          },
        ],
      },
    ],
  },
  {
    section: "Teams",
    items: [
      {
        id: "list-teams",
        method: "GET" as const,
        path: "/v1/teams",
        title: "List teams",
        description: "Filter by gameId and region.",
        params: ["gameId", "region"],
        sample: [
          { id: "team_alpha", name: "Team Alpha", tag: "ALPHA", ranking: 1, followers: 42800 },
        ],
      },
    ],
  },
  {
    section: "Players",
    items: [
      {
        id: "list-players",
        method: "GET" as const,
        path: "/v1/players",
        title: "List players",
        description: "Filter by teamId or country.",
        params: ["teamId", "country"],
        sample: [
          { id: "player_1", handle: "Viper", teamId: "team_alpha", kda: 3.42 },
        ],
      },
    ],
  },
  {
    section: "Realtime",
    items: [
      {
        id: "subscribe-stream",
        method: "GET" as const,
        path: "/v1/streams/{id}/events",
        title: "Subscribe to stream events (SSE)",
        description: "Server-Sent Events: chat, viewer-count, polls, score-events.",
        params: ["id"],
        sample: { event: "viewer.count", data: { count: 18620 } },
      },
    ],
  },
];
