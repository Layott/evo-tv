import "server-only";
import { and, eq, ne } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { isFlagEnabled } from "@/lib/api/flags";

/**
 * One account, one signed-in device.
 *
 * The owner's reason is specific and correct: a subscription that can be signed
 * into on ten phones is a subscription one person buys and ten people use, and
 * on a platform where the paid tier is the business that is the whole business.
 *
 * So a new sign-in ends the older ones. The newest device wins on purpose: the
 * person signing in is present and the other session may be a phone in a drawer,
 * and refusing the new sign-in would lock out the account holder rather than the
 * sharer.
 *
 * Behind a flag because it has a support cost. Somebody who signs in on their
 * phone finds their television signed out, and if that turns out to be the wrong
 * trade for this audience it should be switchable without a deploy.
 */

export const ONE_DEVICE_FLAG = "one_device_per_account";

export async function endOtherSessions(userId: string, keepSessionId: string): Promise<number> {
  // Default on: the flag exists to turn this off, not to turn it on.
  const enabled = await isFlagEnabled(ONE_DEVICE_FLAG, true);
  if (!enabled) return 0;

  const removed = await db
    .delete(schema.session)
    .where(and(eq(schema.session.userId, userId), ne(schema.session.id, keepSessionId)))
    .returning({ id: schema.session.id });

  return removed.length;
}
