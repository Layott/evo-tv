import { sleep, daysAgo, daysAhead, hoursAgo, minutesAgo } from "./_util";
import { vods } from "./vods";

const STORAGE_KEY = "evotv_downloads_v1";

export type DownloadStatus =
  | "queued"
  | "downloading"
  | "paused"
  | "ready"
  | "expired"
  | "failed";

export interface OfflineDownload {
  id: string;
  vodId: string;
  title: string;
  thumbnailUrl: string;
  sizeBytes: number;
  /** snapshot of progress at startedAt — pre-computed, real progress derives from elapsed time */
  progressPct: number;
  status: DownloadStatus;
  queuedAt: string;
  /** when active downloading started (used for time-based progress) */
  startedAt: string | null;
  readyAt: string | null;
  expiresAt: string;
  /** seconds total to finish from startedAt (10s typical) */
  durationMs: number;
  userId: string;
}

const SEED_USER_ID = "user_current";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function load(): OfflineDownload[] {
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

function save(arr: OfflineDownload[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    /* noop */
  }
}

function newId(): string {
  return `dl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function thirtyDaysAhead(): string {
  return daysAhead(30);
}

function pickVodSize(seed: string): number {
  // hash seed → 320–950 MB range, in bytes
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const mb = 320 + (h % 631);
  return mb * 1024 * 1024;
}

function defaultThumb(vodId: string): { title: string; thumb: string; size: number } {
  const v = vods.find((x) => x.id === vodId);
  return {
    title: v?.title ?? "Untitled VOD",
    thumb: v?.thumbnailUrl ?? "/placeholder.svg",
    size: pickVodSize(vodId),
  };
}

function seed(existing: OfflineDownload[]): OfflineDownload[] {
  if (existing.some((d) => d.id.startsWith("seed_dl_"))) return existing;
  const seedRows: OfflineDownload[] = [
    // 1: ready, near expiry
    {
      id: "seed_dl_1",
      vodId: "vod_2",
      title: defaultThumb("vod_2").title,
      thumbnailUrl: defaultThumb("vod_2").thumb,
      sizeBytes: defaultThumb("vod_2").size,
      progressPct: 100,
      status: "ready",
      queuedAt: daysAgo(28),
      startedAt: daysAgo(28),
      readyAt: daysAgo(28),
      expiresAt: daysAhead(2),
      durationMs: 10_000,
      userId: SEED_USER_ID,
    },
    // 2: ready, fresh
    {
      id: "seed_dl_2",
      vodId: "vod_5",
      title: defaultThumb("vod_5").title,
      thumbnailUrl: defaultThumb("vod_5").thumb,
      sizeBytes: defaultThumb("vod_5").size,
      progressPct: 100,
      status: "ready",
      queuedAt: daysAgo(3),
      startedAt: daysAgo(3),
      readyAt: daysAgo(3),
      expiresAt: daysAhead(27),
      durationMs: 10_000,
      userId: SEED_USER_ID,
    },
    // 3: actively downloading — startedAt 4s ago, 10s duration → ~40% on first listing
    {
      id: "seed_dl_3",
      vodId: "vod_9",
      title: defaultThumb("vod_9").title,
      thumbnailUrl: defaultThumb("vod_9").thumb,
      sizeBytes: defaultThumb("vod_9").size,
      progressPct: 0,
      status: "downloading",
      queuedAt: minutesAgo(1),
      startedAt: new Date(Date.now() - 4_000).toISOString(),
      readyAt: null,
      expiresAt: daysAhead(30),
      durationMs: 10_000,
      userId: SEED_USER_ID,
    },
    // 4: queued — not started
    {
      id: "seed_dl_4",
      vodId: "vod_14",
      title: defaultThumb("vod_14").title,
      thumbnailUrl: defaultThumb("vod_14").thumb,
      sizeBytes: defaultThumb("vod_14").size,
      progressPct: 0,
      status: "queued",
      queuedAt: hoursAgo(1),
      startedAt: null,
      readyAt: null,
      expiresAt: daysAhead(30),
      durationMs: 10_000,
      userId: SEED_USER_ID,
    },
    // 5: paused — show interruptable state
    {
      id: "seed_dl_5",
      vodId: "vod_18",
      title: defaultThumb("vod_18").title,
      thumbnailUrl: defaultThumb("vod_18").thumb,
      sizeBytes: defaultThumb("vod_18").size,
      progressPct: 62,
      status: "paused",
      queuedAt: hoursAgo(4),
      startedAt: hoursAgo(4),
      readyAt: null,
      expiresAt: daysAhead(30),
      durationMs: 10_000,
      userId: SEED_USER_ID,
    },
    // 6: expired
    {
      id: "seed_dl_6",
      vodId: "vod_21",
      title: defaultThumb("vod_21").title,
      thumbnailUrl: defaultThumb("vod_21").thumb,
      sizeBytes: defaultThumb("vod_21").size,
      progressPct: 100,
      status: "expired",
      queuedAt: daysAgo(45),
      startedAt: daysAgo(45),
      readyAt: daysAgo(45),
      expiresAt: daysAgo(15),
      durationMs: 10_000,
      userId: SEED_USER_ID,
    },
  ];
  const merged = [...seedRows, ...existing];
  save(merged);
  return merged;
}

/**
 * Pure helper: derive the live progress + status snapshot from an OfflineDownload row + now.
 * Doesn't mutate storage; callers persist the rolled-up status when they read.
 */
function projectProgress(d: OfflineDownload, now: number): OfflineDownload {
  // expiry overrides everything except already-expired/failed
  if (now >= new Date(d.expiresAt).getTime() && d.status !== "expired") {
    return { ...d, status: "expired", progressPct: 100 };
  }
  if (d.status !== "downloading") return d;
  if (!d.startedAt) return { ...d, status: "queued", progressPct: 0 };
  const elapsed = now - new Date(d.startedAt).getTime();
  if (elapsed <= 0) return { ...d, progressPct: 0 };
  const pct = Math.min(100, Math.round((elapsed / d.durationMs) * 100));
  if (pct >= 100) {
    return {
      ...d,
      status: "ready",
      progressPct: 100,
      readyAt: new Date().toISOString(),
    };
  }
  return { ...d, progressPct: pct };
}

function projectAndPersist(rows: OfflineDownload[]): OfflineDownload[] {
  const now = Date.now();
  let mutated = false;
  const next = rows.map((d) => {
    const projected = projectProgress(d, now);
    if (
      projected.status !== d.status ||
      projected.progressPct !== d.progressPct
    ) {
      mutated = true;
      return projected;
    }
    return d;
  });
  if (mutated) save(next);
  return next;
}

export async function listDownloads(userId: string): Promise<OfflineDownload[]> {
  await sleep(80);
  const all = seed(load());
  const projected = projectAndPersist(all);
  return projected
    .filter((d) => d.userId === userId)
    .sort((a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime());
}

export async function getDownload(id: string): Promise<OfflineDownload | null> {
  await sleep(60);
  const all = seed(load());
  const projected = projectAndPersist(all);
  return projected.find((d) => d.id === id) ?? null;
}

export async function enqueueDownload(
  vodId: string,
  userId: string = SEED_USER_ID
): Promise<OfflineDownload> {
  await sleep(120);
  const meta = defaultThumb(vodId);
  const dl: OfflineDownload = {
    id: newId(),
    vodId,
    title: meta.title,
    thumbnailUrl: meta.thumb,
    sizeBytes: meta.size,
    progressPct: 0,
    status: "downloading",
    queuedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    readyAt: null,
    expiresAt: thirtyDaysAhead(),
    durationMs: 10_000,
    userId,
  };
  const all = load();
  all.unshift(dl);
  save(all);
  return dl;
}

export async function resumeDownload(id: string): Promise<OfflineDownload | null> {
  await sleep(80);
  const all = load();
  const idx = all.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  const cur = all[idx]!;
  if (cur.status !== "paused" && cur.status !== "queued") return cur;
  // resume = start fresh duration relative to current progress so existing % isn't lost
  const remainingPct = Math.max(0, 100 - cur.progressPct);
  const remainingMs = (remainingPct / 100) * cur.durationMs;
  const startedAt = new Date(Date.now() - (cur.durationMs - remainingMs)).toISOString();
  const next: OfflineDownload = {
    ...cur,
    status: "downloading",
    startedAt,
  };
  all[idx] = next;
  save(all);
  return next;
}

export async function pauseDownload(id: string): Promise<OfflineDownload | null> {
  await sleep(80);
  const all = load();
  const idx = all.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  const cur = projectProgress(all[idx]!, Date.now());
  if (cur.status !== "downloading") {
    all[idx] = cur;
    save(all);
    return cur;
  }
  const next: OfflineDownload = { ...cur, status: "paused" };
  all[idx] = next;
  save(all);
  return next;
}

export async function deleteDownload(id: string): Promise<boolean> {
  await sleep(80);
  const all = load();
  const idx = all.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  all.splice(idx, 1);
  save(all);
  return true;
}

/** Pretty-format a byte count in MB/GB. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function _resetDownloads(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
