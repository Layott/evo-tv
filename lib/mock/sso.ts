import type { Profile } from "@/lib/types";
import { sleep, daysAgo } from "./_util";
import { userAvatar } from "./_media";

export type SsoProvider = "google" | "apple" | "discord";

export interface SsoOutcome {
  /** A synthetic Profile representing the SSO-authenticated user. */
  profile: Profile;
  /** Pretty label for toasts. */
  providerLabel: string;
}

export const SSO_PROVIDER_LABELS: Record<SsoProvider, string> = {
  google: "Google",
  apple: "Apple",
  discord: "Discord",
};

const HANDLES: Record<SsoProvider, string> = {
  google: "guest_demo",
  apple: "apple_fan",
  discord: "discord_evo",
};

const DISPLAY_NAMES: Record<SsoProvider, string> = {
  google: "Demo Guest",
  apple: "Apple Demo",
  discord: "Discord Demo",
};

export async function simulateSsoLogin(provider: SsoProvider): Promise<SsoOutcome> {
  // 1.5s of "authorizing"… spinner.
  await sleep(1500);
  const handle = HANDLES[provider];
  const displayName = DISPLAY_NAMES[provider];
  const profile: Profile = {
    id: `sso_${provider}_${Date.now().toString(36)}`,
    handle,
    displayName,
    avatarUrl: userAvatar(handle),
    bio: `Signed in via ${SSO_PROVIDER_LABELS[provider]}.`,
    role: "user",
    country: "NG",
    onboardedAt: null,
    createdAt: daysAgo(0),
  };
  return { profile, providerLabel: SSO_PROVIDER_LABELS[provider] };
}
