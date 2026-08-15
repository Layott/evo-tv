/**
 * The one place that knows where the EVO TV app can actually be downloaded.
 *
 * There is no store listing and no hosted build yet, so every destination here
 * is allowed to be absent, and absent is the honest default. A "Get the app"
 * button that lands on a 404 store page costs more trust than a button that
 * admits the app is not out. When the owner ships a listing or an APK, setting
 * the matching environment variable turns the real destination on everywhere at
 * once, with no component to edit.
 *
 * These are NEXT_PUBLIC_ because the button that reads them renders in the
 * browser, where the platform is known. Next inlines them at build time only
 * when they are written as full literal expressions, which is why each one is
 * read out longhand below rather than through a computed key.
 */

export type AppPlatform = "android" | "ios" | "other";

/**
 * An unset variable in Docker or Vercel usually arrives as an empty string
 * rather than undefined, and an empty href is a link to the current page, which
 * is exactly the silent failure this module exists to prevent.
 */
function optional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Google Play listing, for example https://play.google.com/store/apps/details?id=co.evotv */
export const PLAY_STORE_URL = optional(process.env.NEXT_PUBLIC_PLAY_STORE_URL);

/** Apple App Store listing, for example https://apps.apple.com/app/id0000000000 */
export const APP_STORE_URL = optional(process.env.NEXT_PUBLIC_APP_STORE_URL);

/**
 * A directly hosted Android build. Only useful before the Play listing is live,
 * and it is deliberately ranked below the store below: a sideloaded APK never
 * auto-updates, so a viewer who takes this route is stuck on that build until
 * they come back and fetch another one by hand.
 */
export const ANDROID_APK_URL = optional(process.env.NEXT_PUBLIC_ANDROID_APK_URL);

/** True when at least one platform has somewhere real to send a visitor. */
export const HAS_ANY_APP_BUILD = Boolean(
  PLAY_STORE_URL || APP_STORE_URL || ANDROID_APK_URL
);

export interface AppDownload {
  /** Where the button sends the visitor, or null when we have nothing to offer. */
  href: string | null;
  /**
   * True when href points at a file we host rather than a store page. Those two
   * cases want different anchor attributes: a store opens in a new tab, a file
   * download should not strand the viewer on a blank tab.
   */
  isDirectFile: boolean;
  /** Button copy, which has to name the destination rather than say "Get the app". */
  label: string;
}

const NOTHING: AppDownload = { href: null, isDirectFile: false, label: "" };

/**
 * Work out what the visitor is holding.
 *
 * Kept as a pure function of the user agent so it can be reasoned about and
 * tested without a browser. iPadOS 13 and later lie and report themselves as
 * Macintosh, so a Mac that also reports touch points is treated as an iPad;
 * a real Mac reports zero. Getting this wrong sends an iPad owner to the Play
 * Store, which is a worse outcome than falling through to the web app.
 */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): AppPlatform {
  const ua = userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/macintosh/.test(ua) && maxTouchPoints > 1) return "ios";
  return "other";
}

/**
 * What we can offer this platform right now. Desktop always returns nothing:
 * there is no desktop build and there is no point sending someone at a phone
 * store from a laptop, so the caller falls back to the web app.
 */
export function downloadFor(platform: AppPlatform): AppDownload {
  if (platform === "android") {
    if (PLAY_STORE_URL) {
      return { href: PLAY_STORE_URL, isDirectFile: false, label: "Get it on Google Play" };
    }
    if (ANDROID_APK_URL) {
      return { href: ANDROID_APK_URL, isDirectFile: true, label: "Download for Android" };
    }
    return NOTHING;
  }
  if (platform === "ios") {
    if (APP_STORE_URL) {
      return { href: APP_STORE_URL, isDirectFile: false, label: "Download on the App Store" };
    }
    return NOTHING;
  }
  return NOTHING;
}

/** How each platform is named in copy, so the two call sites cannot drift. */
export const PLATFORM_LABEL: Record<AppPlatform, string> = {
  android: "Android",
  ios: "iPhone and iPad",
  other: "this device",
};
