import type { FeatureFlag } from "@/lib/types";
import { sleep } from "./_util";

export const featureFlags: FeatureFlag[] = [
  { key: "live_chat", enabled: true, description: "Enable live chat on streams" },
  { key: "live_polls", enabled: true, description: "Enable live polls on streams" },
  { key: "shop", enabled: true, description: "Enable merch shop" },
  { key: "in_stream_shop", enabled: true, description: "Enable in-stream product panel" },
  { key: "stripe_provider", enabled: false, description: "Switch payment provider to Stripe" },
  { key: "creator_streams", enabled: false, description: "Allow non-official streamers" },
  { key: "recommendations", enabled: false, description: "Show 'Because you watched' feed" },
];

export async function listFlags(): Promise<FeatureFlag[]> {
  await sleep();
  return featureFlags;
}

export async function getFlag(key: string): Promise<boolean> {
  await sleep(20);
  return featureFlags.find((f) => f.key === key)?.enabled ?? false;
}

export async function setFlag(key: string, enabled: boolean): Promise<void> {
  await sleep(40);
  const flag = featureFlags.find((f) => f.key === key);
  if (flag) flag.enabled = enabled;
}
