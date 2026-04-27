import { sleep } from "./_util";

export type AppKind = "tv" | "android" | "ios" | "windows" | "macos" | "linux";
export type AppStatus = "available" | "beta" | "coming-soon";

export interface AppPlatform {
  id: string;
  name: string;
  kind: AppKind;
  /** Family this kind belongs to (used to group on landing pages). */
  family: "tv" | "mobile" | "desktop";
  status: AppStatus;
  storeUrl?: string;
  version?: string;
  size?: string;
  blurb: string;
  screenshots: string[];
  /** Sub-platforms shown on the parent landing (e.g. Apple TV, Roku for TV). */
  subPlatforms?: { id: string; name: string; status: AppStatus }[];
}

const SHOTS = [
  "/esports-live-stream-match.jpg",
  "/esports-championship-finals-live-stream.jpg",
  "/esports-tournament-match.jpg",
  "/esports-pro-league-event.jpg",
  "/esports-best-plays-highlights.jpg",
  "/esports-highlights-compilation.jpg",
];

export const appPlatforms: AppPlatform[] = [
  {
    id: "app_tv",
    name: "EVO TV for Smart TV",
    kind: "tv",
    family: "tv",
    status: "beta",
    version: "0.9.2",
    size: "32 MB",
    blurb:
      "The lean-back EVO TV experience. 4K-ready, optimized for the remote, and fully D-pad navigable.",
    screenshots: SHOTS,
    subPlatforms: [
      { id: "androidtv", name: "Android TV", status: "beta" },
      { id: "appletv", name: "Apple TV", status: "beta" },
      { id: "firetv", name: "Amazon Fire TV", status: "beta" },
      { id: "roku", name: "Roku", status: "coming-soon" },
      { id: "tizen", name: "Samsung Tizen", status: "coming-soon" },
      { id: "webos", name: "LG webOS", status: "coming-soon" },
    ],
  },
  {
    id: "app_android",
    name: "EVO TV for Android",
    kind: "android",
    family: "mobile",
    status: "available",
    storeUrl: "https://play.google.com/store/apps/details?id=tv.evo",
    version: "1.4.0",
    size: "48 MB",
    blurb:
      "Stream every African esport from your pocket. Picture-in-picture, mobile data saver, and Premium 1080p.",
    screenshots: SHOTS,
  },
  {
    id: "app_ios",
    name: "EVO TV for iOS",
    kind: "ios",
    family: "mobile",
    status: "available",
    storeUrl: "https://apps.apple.com/app/evo-tv/id000000000",
    version: "1.4.0",
    size: "61 MB",
    blurb:
      "Built for iPhone and iPad. Native AirPlay, Picture-in-Picture, and SharePlay Watch Together.",
    screenshots: SHOTS,
  },
  {
    id: "app_windows",
    name: "EVO TV for Windows",
    kind: "windows",
    family: "desktop",
    status: "beta",
    version: "0.7.1",
    size: "112 MB",
    blurb: "Watch every match in a dedicated window with a slim chat dock and global hotkeys.",
    screenshots: SHOTS,
  },
  {
    id: "app_macos",
    name: "EVO TV for macOS",
    kind: "macos",
    family: "desktop",
    status: "beta",
    version: "0.7.1",
    size: "98 MB",
    blurb: "Universal binary for Apple Silicon. Lives nicely on your menu bar.",
    screenshots: SHOTS,
  },
  {
    id: "app_linux",
    name: "EVO TV for Linux",
    kind: "linux",
    family: "desktop",
    status: "coming-soon",
    size: "-- MB",
    blurb: "AppImage and .deb packages. Coming once the desktop core stabilises.",
    screenshots: SHOTS,
  },
];

export async function listAppPlatforms(): Promise<AppPlatform[]> {
  await sleep();
  return appPlatforms;
}

export async function getAppPlatform(kind: AppKind): Promise<AppPlatform | null> {
  await sleep(80);
  return appPlatforms.find((p) => p.kind === kind) ?? null;
}

const PAIR_LIFETIME_MS = 15_000;

interface PairingState {
  code: string;
  startedAt: number;
}

let activePairing: PairingState | null = null;

function generatePairCode(): string {
  // 6-char A-Z0-9, easy to type on a TV remote (no I, O, 0, 1).
  const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPH[Math.floor(Math.random() * ALPH.length)];
  return out;
}

export async function startTvPairing(): Promise<{ code: string; expiresInSec: number }> {
  await sleep(150);
  activePairing = { code: generatePairCode(), startedAt: Date.now() };
  return { code: activePairing.code, expiresInSec: 300 };
}

export type PairingStatus = "pending" | "paired" | "expired";

export async function pollPairing(code: string): Promise<{ status: PairingStatus }> {
  await sleep(60);
  if (!activePairing || activePairing.code !== code) {
    return { status: "expired" };
  }
  const elapsed = Date.now() - activePairing.startedAt;
  if (elapsed >= PAIR_LIFETIME_MS) {
    return { status: "paired" };
  }
  return { status: "pending" };
}

export function resetTvPairing(): void {
  activePairing = null;
}
