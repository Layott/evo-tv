import { sleep, now } from "./_util";

export type BotKind = "discord" | "telegram";

export interface ChannelMappings {
  goLive: string;
  matchResults: string;
  drops: string;
}

export interface BotIntegration {
  id: string;
  userId: string;
  kind: BotKind;
  /** Server / group ID — Discord guild ID or Telegram chat ID. */
  serverId: string;
  /** Display label shown on the integrations list. */
  serverName: string;
  /** The token field; never echoed back to the user in full. */
  token: string;
  channelMappings: ChannelMappings;
  connectedAt: string;
  lastEventAt: string | null;
  eventCount: number;
}

const STORAGE_KEY = "evotv_integrations_v1";

interface PersistedShape {
  bots: BotIntegration[];
}

function loadFromStorage(): BotIntegration[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedShape;
    return Array.isArray(parsed?.bots) ? parsed.bots : [];
  } catch {
    return [];
  }
}

function saveToStorage(bots: BotIntegration[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ bots } satisfies PersistedShape));
  } catch {
    /* noop */
  }
}

export function maskToken(token: string): string {
  if (!token) return "";
  if (token.length <= 8) return "•".repeat(token.length);
  return `${token.slice(0, 4)}${"•".repeat(Math.max(4, token.length - 8))}${token.slice(-4)}`;
}

const TOKEN_PATTERNS: Record<BotKind, RegExp> = {
  // Discord bot tokens are split into 3 base64ish chunks separated by dots; rough.
  discord: /^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{20,}$/,
  // Telegram tokens look like 1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11.
  telegram: /^\d{6,12}:[A-Za-z0-9_-]{30,}$/,
};

export function validateBotToken(kind: BotKind, token: string): boolean {
  return TOKEN_PATTERNS[kind].test(token.trim());
}

const SERVER_ID_PATTERNS: Record<BotKind, RegExp> = {
  discord: /^\d{17,20}$/,
  telegram: /^-?\d{4,15}$/,
};

export function validateServerId(kind: BotKind, id: string): boolean {
  return SERVER_ID_PATTERNS[kind].test(id.trim());
}

export interface ConnectBotPayload {
  serverId: string;
  serverName?: string;
  token: string;
  channelMappings: ChannelMappings;
}

export async function listBots(userId: string): Promise<BotIntegration[]> {
  await sleep(80);
  return loadFromStorage().filter((b) => b.userId === userId);
}

export async function getBotForKind(
  userId: string,
  kind: BotKind,
): Promise<BotIntegration | null> {
  await sleep(60);
  return loadFromStorage().find((b) => b.userId === userId && b.kind === kind) ?? null;
}

export async function connectBot(
  userId: string,
  kind: BotKind,
  payload: ConnectBotPayload,
): Promise<BotIntegration> {
  await sleep(700);
  if (!validateBotToken(kind, payload.token)) {
    throw new Error(
      kind === "discord"
        ? "That doesn't look like a valid Discord bot token."
        : "That doesn't look like a valid Telegram bot token.",
    );
  }
  if (!validateServerId(kind, payload.serverId)) {
    throw new Error(
      kind === "discord"
        ? "Discord server IDs are 17–20 digits."
        : "Telegram chat IDs are numeric (use -100… for supergroups).",
    );
  }
  const all = loadFromStorage();
  // Replace any existing integration of the same kind for this user.
  const filtered = all.filter((b) => !(b.userId === userId && b.kind === kind));
  const integration: BotIntegration = {
    id: `bot_${kind}_${Math.random().toString(36).slice(2, 9)}`,
    userId,
    kind,
    serverId: payload.serverId,
    serverName:
      payload.serverName?.trim() ||
      (kind === "discord" ? "Discord Server" : "Telegram Group"),
    token: payload.token,
    channelMappings: payload.channelMappings,
    connectedAt: now(),
    lastEventAt: null,
    eventCount: 0,
  };
  filtered.push(integration);
  saveToStorage(filtered);
  return integration;
}

export async function disconnectBot(id: string): Promise<void> {
  await sleep(200);
  const all = loadFromStorage();
  saveToStorage(all.filter((b) => b.id !== id));
}

export async function updateBotMappings(
  id: string,
  mappings: ChannelMappings,
): Promise<BotIntegration | null> {
  await sleep(180);
  const all = loadFromStorage();
  const idx = all.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx]!, channelMappings: mappings };
  saveToStorage(all);
  return all[idx]!;
}

export async function triggerTestEvent(botId: string): Promise<{ deliveredAt: string }> {
  await sleep(550);
  const all = loadFromStorage();
  const idx = all.findIndex((b) => b.id === botId);
  if (idx === -1) throw new Error("Integration not found");
  const deliveredAt = now();
  all[idx] = {
    ...all[idx]!,
    lastEventAt: deliveredAt,
    eventCount: all[idx]!.eventCount + 1,
  };
  saveToStorage(all);
  return { deliveredAt };
}

export const INTEGRATION_CATALOG: Array<{
  kind: BotKind | "slack" | "twitter" | "webhook";
  label: string;
  blurb: string;
  status: "available" | "coming-soon";
  href: string;
}> = [
  {
    kind: "discord",
    label: "Discord",
    blurb: "Post go-live alerts, match results, and drops to your community server.",
    status: "available",
    href: "/integrations/discord",
  },
  {
    kind: "telegram",
    label: "Telegram",
    blurb: "Pipe stream events into your supporter group via @BotFather.",
    status: "available",
    href: "/integrations/telegram",
  },
  {
    kind: "slack",
    label: "Slack",
    blurb: "Internal workspace alerts for your production crew.",
    status: "coming-soon",
    href: "#",
  },
  {
    kind: "twitter",
    label: "X / Twitter",
    blurb: "Auto-tweet when your stream goes live.",
    status: "coming-soon",
    href: "#",
  },
  {
    kind: "webhook",
    label: "Custom webhook",
    blurb: "Receive POST callbacks for any EVO TV event.",
    status: "coming-soon",
    href: "#",
  },
];
