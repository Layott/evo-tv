import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type ExpoPlatform = "ios" | "android" | "web";

export async function registerExpoToken(
  userId: string,
  token: string,
  platform: ExpoPlatform,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insert(schema.expoPushTokens)
    .values({
      token,
      userId,
      platform,
      createdAt: now,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: schema.expoPushTokens.token,
      set: {
        userId,
        platform,
        lastSeenAt: now,
      },
    });
}

export async function unregisterExpoToken(
  userId: string,
  token: string,
): Promise<void> {
  await db
    .delete(schema.expoPushTokens)
    .where(
      and(
        eq(schema.expoPushTokens.userId, userId),
        eq(schema.expoPushTokens.token, token),
      ),
    );
}

export async function listExpoTokensForUser(
  userId: string,
): Promise<{ token: string; platform: ExpoPlatform; lastSeenAt: string }[]> {
  const rows = await db
    .select()
    .from(schema.expoPushTokens)
    .where(eq(schema.expoPushTokens.userId, userId));
  return rows.map((r) => ({
    token: r.token,
    platform: r.platform as ExpoPlatform,
    lastSeenAt: r.lastSeenAt,
  }));
}

export interface ExpoPushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Fan out a payload to every registered Expo push token for the given user.
 * Returns the number of tickets returned with status === "ok".
 *
 * On `DeviceNotRegistered` errors, prunes the token so the next run skips it.
 * Other transient errors are ignored — the cron will retry next tick.
 */
export async function sendExpoPushToUser(
  userId: string,
  payload: ExpoPushPayload,
): Promise<number> {
  const tokens = await listExpoTokensForUser(userId);
  if (tokens.length === 0) return 0;

  const messages = tokens.map((t) => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    sound: payload.sound === null ? undefined : (payload.sound ?? "default"),
  }));

  let res: Response;
  try {
    res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
  } catch {
    return 0;
  }

  if (!res.ok) return 0;

  const payload2 = (await res.json().catch(() => null)) as {
    data?: ExpoPushTicket[];
  } | null;
  if (!payload2 || !Array.isArray(payload2.data)) return 0;

  let delivered = 0;
  for (let i = 0; i < payload2.data.length; i++) {
    const ticket = payload2.data[i]!;
    if (ticket.status === "ok") {
      delivered += 1;
      continue;
    }
    const tokenRow = tokens[i];
    if (tokenRow && ticket.details?.error === "DeviceNotRegistered") {
      await unregisterExpoToken(userId, tokenRow.token);
    }
  }
  return delivered;
}
