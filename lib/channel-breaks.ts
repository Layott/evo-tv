import "server-only";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import {
  CHANNEL_BREAKS_FLAG_KEY,
  normalizeChannelBreaks,
  type ChannelBreaks,
} from "./channel-breaks-shape";

/**
 * Reading and writing the channel's rhythm.
 *
 * The shape, the defaults and the style lists live in `channel-breaks-shape.ts`
 * so a client component can import them without pulling `server-only` into the
 * browser bundle.
 */

export {
  CHANNEL_BREAKS_FLAG_KEY,
  CHANNEL_BREAKS_DEFAULT,
  OVERLAY_STYLES,
  UP_NEXT_STYLES,
  normalizeChannelBreaks,
} from "./channel-breaks-shape";
export type { ChannelBreaks, OverlayStyle, UpNextStyle } from "./channel-breaks-shape";

export async function readChannelBreaks(): Promise<ChannelBreaks> {
  const row = (
    await db
      .select({ payload: schema.featureFlags.payload })
      .from(schema.featureFlags)
      .where(eq(schema.featureFlags.key, CHANNEL_BREAKS_FLAG_KEY))
      .limit(1)
  )[0];
  return normalizeChannelBreaks(row?.payload);
}
