import "server-only";
import webpush from "web-push";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

let configured = false;

function configure() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:dev@evotv.local";
  if (pub && priv) {
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  imageUrl?: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  configure();
  const pub = process.env.VAPID_PUBLIC_KEY;
  if (!pub) return 0;

  const subs = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId));

  let delivered = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        },
        JSON.stringify(payload)
      );
      delivered += 1;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // subscription expired/gone - prune
        await db
          .delete(schema.pushSubscriptions)
          .where(eq(schema.pushSubscriptions.id, s.id));
      }
    }
  }
  return delivered;
}

export function publicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}
