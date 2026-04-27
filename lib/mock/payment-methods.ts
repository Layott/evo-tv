import { sleep, daysAgo, hoursAgo, minutesAgo } from "./_util";

const STORAGE_KEY = "evotv_payment-methods_v1";

export type PaymentProviderId =
  | "mpesa"
  | "mtn-momo"
  | "airtel-money"
  | "paystack-card";

export type PaymentKind = "mobile-money" | "card" | "ussd";

export type AttemptStatus = "pending" | "success" | "failed";

export interface PaymentProvider {
  id: PaymentProviderId;
  name: string;
  kind: PaymentKind;
  countries: string[];
  /** logo emoji glyph for compact mock visuals — gets rendered in a coloured tile in the UI */
  logo: string;
  /** brand-ish accent colour (used for the tile bg) */
  accent: string;
  feeNgn: number;
  etaSeconds: number;
  description: string;
}

export interface PaymentAttempt {
  id: string;
  provider: PaymentProviderId;
  providerLabel: string;
  phone: string;
  amountNgn: number;
  status: AttemptStatus;
  ref: string;
  createdAt: string;
  completedAt: string | null;
  failureReason?: string;
  /** if true, the attempt is configured to fail when polled (used for the fail-mode toggle) */
  forceFail?: boolean;
  /** in ms — used by pollAttempt() to flip pending → terminal status by timestamp math, not real timers */
  durationMs: number;
  userId: string;
}

const PROVIDERS: PaymentProvider[] = [
  {
    id: "mpesa",
    name: "M-Pesa",
    kind: "mobile-money",
    countries: ["KE", "TZ", "UG"],
    logo: "M",
    accent: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    feeNgn: 50,
    etaSeconds: 10,
    description: "Safaricom mobile money — Kenya, Tanzania & Uganda.",
  },
  {
    id: "mtn-momo",
    name: "MTN MoMo",
    kind: "mobile-money",
    countries: ["NG", "GH", "CI", "UG", "CM"],
    logo: "Y",
    accent: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
    feeNgn: 75,
    etaSeconds: 10,
    description: "MTN Mobile Money across West & Central Africa.",
  },
  {
    id: "airtel-money",
    name: "Airtel Money",
    kind: "mobile-money",
    countries: ["NG", "KE", "UG", "RW", "MW"],
    logo: "A",
    accent: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
    feeNgn: 60,
    etaSeconds: 10,
    description: "Airtel Money — Nigeria, Kenya, Uganda, Rwanda & Malawi.",
  },
  {
    id: "paystack-card",
    name: "Paystack Card",
    kind: "card",
    countries: ["NG", "GH", "ZA", "KE"],
    logo: "P",
    accent: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30",
    feeNgn: 100,
    etaSeconds: 5,
    description: "Visa, Mastercard, Verve via Paystack.",
  },
];

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function loadAttempts(): PaymentAttempt[] {
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

function saveAttempts(arr: PaymentAttempt[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    /* noop */
  }
}

function newRef(provider: PaymentProviderId): string {
  const tag = provider.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "PAY";
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  return `${tag}_${ts}${rand}`;
}

const SEED_USER_ID = "user_current";

function seedAttempts(existing: PaymentAttempt[]): PaymentAttempt[] {
  if (existing.some((a) => a.id.startsWith("seed_pay_"))) return existing;
  const seeds: PaymentAttempt[] = [
    {
      id: "seed_pay_1",
      provider: "mpesa",
      providerLabel: "M-Pesa",
      phone: "+254 712 345 678",
      amountNgn: 4_500,
      status: "success",
      ref: "MPE_X42K77P",
      createdAt: daysAgo(2),
      completedAt: daysAgo(2),
      durationMs: 10_000,
      userId: SEED_USER_ID,
    },
    {
      id: "seed_pay_2",
      provider: "mtn-momo",
      providerLabel: "MTN MoMo",
      phone: "+234 803 555 4422",
      amountNgn: 4_500,
      status: "success",
      ref: "MTN_Q12B0Z2",
      createdAt: daysAgo(15),
      completedAt: daysAgo(15),
      durationMs: 10_000,
      userId: SEED_USER_ID,
    },
    {
      id: "seed_pay_3",
      provider: "airtel-money",
      providerLabel: "Airtel Money",
      phone: "+234 901 222 3344",
      amountNgn: 4_500,
      status: "failed",
      ref: "AIR_F09NN1",
      createdAt: daysAgo(7),
      completedAt: daysAgo(7),
      durationMs: 10_000,
      failureReason: "Insufficient balance",
      userId: SEED_USER_ID,
    },
    {
      id: "seed_pay_4",
      provider: "paystack-card",
      providerLabel: "Paystack",
      phone: "—",
      amountNgn: 4_500,
      status: "success",
      ref: "PSK_LRT8C7",
      createdAt: hoursAgo(3),
      completedAt: hoursAgo(3),
      durationMs: 5_000,
      userId: SEED_USER_ID,
    },
    {
      id: "seed_pay_5",
      provider: "mtn-momo",
      providerLabel: "MTN MoMo",
      phone: "+234 803 555 4422",
      amountNgn: 9_000,
      status: "success",
      ref: "MTN_BV0QR4",
      createdAt: minutesAgo(40),
      completedAt: minutesAgo(40),
      durationMs: 10_000,
      userId: SEED_USER_ID,
    },
  ];
  const merged = [...seeds, ...existing];
  saveAttempts(merged);
  return merged;
}

export async function listPaymentProviders(country?: string): Promise<PaymentProvider[]> {
  await sleep(60);
  if (!country) return [...PROVIDERS];
  const cc = country.toUpperCase();
  return PROVIDERS.filter((p) => p.countries.includes(cc));
}

export function getPaymentProvider(id: PaymentProviderId): PaymentProvider | null {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

interface InitMobileMoneyOptions {
  forceFail?: boolean;
  userId?: string;
}

export async function initMobileMoney(
  providerId: PaymentProviderId,
  phone: string,
  amountNgn: number,
  options: InitMobileMoneyOptions = {}
): Promise<PaymentAttempt> {
  await sleep(120);
  const provider = getPaymentProvider(providerId);
  if (!provider) throw new Error("Unknown payment provider");
  const ref = newRef(providerId);
  const attempt: PaymentAttempt = {
    id: `pay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    provider: providerId,
    providerLabel: provider.name,
    phone: phone.trim(),
    amountNgn,
    status: "pending",
    ref,
    createdAt: new Date().toISOString(),
    completedAt: null,
    durationMs: provider.etaSeconds * 1_000,
    forceFail: options.forceFail === true,
    userId: options.userId ?? SEED_USER_ID,
  };
  const all = loadAttempts();
  all.unshift(attempt);
  saveAttempts(all);
  return attempt;
}

export async function pollAttempt(ref: string): Promise<PaymentAttempt | null> {
  await sleep(80);
  const all = loadAttempts();
  const idx = all.findIndex((a) => a.ref === ref);
  if (idx === -1) return null;
  const a = all[idx]!;
  if (a.status !== "pending") return a;
  const elapsed = Date.now() - new Date(a.createdAt).getTime();
  if (elapsed >= a.durationMs) {
    const next: PaymentAttempt = a.forceFail
      ? {
          ...a,
          status: "failed",
          completedAt: new Date().toISOString(),
          failureReason: "Customer cancelled prompt",
        }
      : { ...a, status: "success", completedAt: new Date().toISOString() };
    all[idx] = next;
    saveAttempts(all);
    return next;
  }
  return a;
}

export async function listMyPayments(userId: string): Promise<PaymentAttempt[]> {
  await sleep(80);
  const all = seedAttempts(loadAttempts());
  return all
    .filter((a) => a.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Reset the local attempts store (used by tests + dev tools). Not exposed by index re-export
 * since the spec asks not to touch index.ts.
 */
export function _resetPaymentAttempts(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
