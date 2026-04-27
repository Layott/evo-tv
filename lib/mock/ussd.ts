import { sleep, daysAgo, hoursAgo, minutesAgo } from "./_util";

const STORAGE_KEY = "evotv_ussd_v1";

export type UssdProviderId = "mtn" | "airtel" | "glo" | "9mobile";
export type UssdStatus = "awaiting" | "confirmed" | "expired";

export interface UssdProvider {
  id: UssdProviderId;
  name: string;
  shortCode: string;
  accent: string;
  /** what to type after dial-up */
  steps: string[];
}

export interface UssdSession {
  id: string;
  code: string; // 6-digit linking code
  provider: UssdProviderId;
  providerLabel: string;
  shortCode: string;
  amountNgn: number;
  status: UssdStatus;
  startedAt: string;
  expiresAt: string;
  confirmedAt?: string | null;
  userId: string;
  /** ms from startedAt at which the next poll should flip to confirmed */
  confirmAfterMs: number;
}

const PROVIDERS: UssdProvider[] = [
  {
    id: "mtn",
    name: "MTN",
    shortCode: "*745*1*1#",
    accent: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
    steps: [
      "Dial *745*1*1# from your MTN line",
      "Choose 'Subscribe' from the menu",
      "Enter your 6-digit linking code below",
      "Approve the ₦4,500 charge",
    ],
  },
  {
    id: "airtel",
    name: "Airtel",
    shortCode: "*222*5*2#",
    accent: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
    steps: [
      "Dial *222*5*2# from your Airtel line",
      "Pick 'Pay merchant'",
      "Enter linking code below",
      "Confirm with your Airtel PIN",
    ],
  },
  {
    id: "glo",
    name: "Glo",
    shortCode: "*322*4#",
    accent: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    steps: [
      "Dial *322*4# from your Glo line",
      "Select 'Subscribe to EVO TV'",
      "Type your linking code",
      "Confirm with PIN",
    ],
  },
  {
    id: "9mobile",
    name: "9mobile",
    shortCode: "*229*5*1#",
    accent: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30",
    steps: [
      "Dial *229*5*1# from your 9mobile line",
      "Pick 'Streaming services'",
      "Enter linking code shown below",
      "Confirm payment",
    ],
  },
];

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function load(): UssdSession[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(arr: UssdSession[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    /* noop */
  }
}

function newCode(): string {
  return Math.floor(100_000 + Math.random() * 900_000).toString();
}

const SEED_USER_ID = "user_current";

function seed(existing: UssdSession[]): UssdSession[] {
  if (existing.some((s) => s.id.startsWith("seed_ussd_"))) return existing;
  const seeds: UssdSession[] = [
    {
      id: "seed_ussd_1",
      code: "238104",
      provider: "mtn",
      providerLabel: "MTN",
      shortCode: "*745*1*1#",
      amountNgn: 4_500,
      status: "confirmed",
      startedAt: daysAgo(1),
      expiresAt: daysAgo(1),
      confirmedAt: daysAgo(1),
      userId: SEED_USER_ID,
      confirmAfterMs: 30_000,
    },
    {
      id: "seed_ussd_2",
      code: "991472",
      provider: "airtel",
      providerLabel: "Airtel",
      shortCode: "*222*5*2#",
      amountNgn: 4_500,
      status: "confirmed",
      startedAt: daysAgo(6),
      expiresAt: daysAgo(6),
      confirmedAt: daysAgo(6),
      userId: SEED_USER_ID,
      confirmAfterMs: 30_000,
    },
    {
      id: "seed_ussd_3",
      code: "402188",
      provider: "glo",
      providerLabel: "Glo",
      shortCode: "*322*4#",
      amountNgn: 4_500,
      status: "expired",
      startedAt: hoursAgo(20),
      expiresAt: hoursAgo(19),
      userId: "user_other_1",
      confirmAfterMs: 30_000,
    },
    {
      id: "seed_ussd_4",
      code: "713920",
      provider: "9mobile",
      providerLabel: "9mobile",
      shortCode: "*229*5*1#",
      amountNgn: 4_500,
      status: "awaiting",
      startedAt: minutesAgo(2),
      expiresAt: minutesAgo(-13), // 13min ahead
      userId: "user_other_2",
      confirmAfterMs: 30_000,
    },
    {
      id: "seed_ussd_5",
      code: "608341",
      provider: "mtn",
      providerLabel: "MTN",
      shortCode: "*745*1*1#",
      amountNgn: 4_500,
      status: "awaiting",
      startedAt: minutesAgo(5),
      expiresAt: minutesAgo(-10),
      userId: "user_other_3",
      confirmAfterMs: 30_000,
    },
  ];
  const merged = [...seeds, ...existing];
  save(merged);
  return merged;
}

export async function listUssdProviders(): Promise<UssdProvider[]> {
  await sleep(60);
  return [...PROVIDERS];
}

export function getUssdProvider(id: UssdProviderId): UssdProvider | null {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

export async function startUssdSession(
  providerId: UssdProviderId,
  amountNgn = 4_500,
  userId: string = SEED_USER_ID
): Promise<UssdSession> {
  await sleep(120);
  const provider = getUssdProvider(providerId);
  if (!provider) throw new Error("Unknown USSD provider");
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + 15 * 60 * 1000);
  const session: UssdSession = {
    id: `ussd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    code: newCode(),
    provider: providerId,
    providerLabel: provider.name,
    shortCode: provider.shortCode,
    amountNgn,
    status: "awaiting",
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    confirmedAt: null,
    userId,
    confirmAfterMs: 30_000,
  };
  const all = load();
  all.unshift(session);
  save(all);
  return session;
}

export async function pollUssdSession(code: string): Promise<UssdSession | null> {
  await sleep(80);
  const all = load();
  const idx = all.findIndex((s) => s.code === code);
  if (idx === -1) return null;
  const s = all[idx]!;
  if (s.status !== "awaiting") return s;
  const now = Date.now();
  const elapsed = now - new Date(s.startedAt).getTime();
  if (now > new Date(s.expiresAt).getTime()) {
    const next: UssdSession = { ...s, status: "expired" };
    all[idx] = next;
    save(all);
    return next;
  }
  if (elapsed >= s.confirmAfterMs) {
    const next: UssdSession = {
      ...s,
      status: "confirmed",
      confirmedAt: new Date().toISOString(),
    };
    all[idx] = next;
    save(all);
    return next;
  }
  return s;
}

export async function listAllUssdSessions(): Promise<UssdSession[]> {
  await sleep(80);
  const all = seed(load());
  return all.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

export async function listMyUssdSessions(userId: string): Promise<UssdSession[]> {
  await sleep(80);
  const all = seed(load());
  return all
    .filter((s) => s.userId === userId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

/** Admin: manually flip a session to confirmed. */
export async function overrideUssdSession(
  id: string,
  status: Exclude<UssdStatus, "awaiting">
): Promise<UssdSession | null> {
  await sleep(80);
  const all = load();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const next: UssdSession = {
    ...all[idx]!,
    status,
    confirmedAt: status === "confirmed" ? new Date().toISOString() : null,
  };
  all[idx] = next;
  save(all);
  return next;
}

export function _resetUssd(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
