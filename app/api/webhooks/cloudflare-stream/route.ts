import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { emit } from "@/lib/sse/bus";

/**
 * Cloudflare Stream live-input notifications.
 *
 * `isLive` was only ever set by hand. An operator had to remember to toggle it
 * on when the broadcast started and off when it ended, and forgetting the
 * second one left the site claiming to be live indefinitely. Cloudflare knows
 * exactly when an encoder connects and disconnects, so it can say so.
 *
 * Payload (Cloudflare "Stream Live Input" notification):
 *
 *   { data: { input_id, event_type: "live_input.connected"
 *                                 | "live_input.disconnected"
 *                                 | "live_input.errored" } }
 *
 * Configure the notification URL in the Cloudflare dashboard as:
 *   https://api.evotv.co/api/webhooks/cloudflare-stream?token=<SECRET>
 *
 * Authentication is a shared token in the query string, compared in constant
 * time, because the live-input notification is delivered by Cloudflare
 * Notifications and does not carry the `Webhook-Signature` header that the
 * video-library webhooks use. When that header is present it is verified too.
 */

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** HMAC-SHA256 over `time.body`, per Cloudflare's webhook signing scheme. */
function signatureValid(header: string, body: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  ) as { time?: string; sig1?: string };
  if (!parts.time || !parts.sig1) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parts.time}.${body}`)
    .digest("hex");
  return timingSafeEqual(expected, parts.sig1);
}

export async function POST(req: NextRequest) {
  const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
  if (!secret) {
    // Refuse rather than accept anonymous writes to `isLive`.
    return new NextResponse("Webhook not configured", { status: 503 });
  }

  const raw = await req.text();

  const token = req.nextUrl.searchParams.get("token");
  const sigHeader = req.headers.get("webhook-signature");
  const authorised = sigHeader
    ? signatureValid(sigHeader, raw, secret)
    : Boolean(token && timingSafeEqual(token, secret));
  if (!authorised) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let body: { data?: { input_id?: string; event_type?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const inputId = body.data?.input_id;
  const eventType = body.data?.event_type;
  if (!inputId || !eventType) {
    // A test ping from the dashboard has no data block. Accept it so the
    // dashboard reports the endpoint as healthy.
    return NextResponse.json({ ok: true, ignored: "no input_id" });
  }

  const stream = (
    await db
      .select({ id: schema.streams.id, isLive: schema.streams.isLive })
      .from(schema.streams)
      .where(eq(schema.streams.cfLiveInputUid, inputId))
      .limit(1)
  )[0];

  if (!stream) {
    // A live input that predates this stream, or belongs to another
    // environment sharing the Cloudflare account. Not an error.
    return NextResponse.json({ ok: true, ignored: "unknown input" });
  }

  const nowIso = new Date().toISOString();

  if (eventType === "live_input.connected") {
    await db
      .update(schema.streams)
      .set({ isLive: true, startedAt: nowIso, endedAt: null })
      .where(eq(schema.streams.id, stream.id));
    emit(`stream:${stream.id}:status`, { type: "live", at: nowIso });
    emit("stream:live-now", { type: "live", streamId: stream.id });
    return NextResponse.json({ ok: true, streamId: stream.id, isLive: true });
  }

  if (
    eventType === "live_input.disconnected" ||
    eventType === "live_input.errored"
  ) {
    await db
      .update(schema.streams)
      .set({ isLive: false, endedAt: nowIso, viewerCount: 0 })
      .where(eq(schema.streams.id, stream.id));
    emit(`stream:${stream.id}:status`, { type: "ended", at: nowIso });
    emit("stream:live-now", { type: "ended", streamId: stream.id });
    return NextResponse.json({ ok: true, streamId: stream.id, isLive: false });
  }

  return NextResponse.json({ ok: true, ignored: eventType });
}
