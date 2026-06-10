import { NextResponse, type NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { sendMail, isMailConfigured } from "@/lib/email";

/**
 * Public pre-launch waitlist with email confirmation (double opt-in).
 *
 *   GET  /api/waitlist?username=foo   -> { available: boolean }
 *   POST /api/waitlist { email, username }  -> reserve + email a verify link
 *
 * A username is "held" while it is verified, or unverified but reserved within
 * the last 24 hours. After 24 hours unverified, it opens up for someone else.
 * No auth (marketing site). Called cross-origin, so CORS is open.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const HOLD_MS = 24 * 60 * 60 * 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

function normUsername(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const u = v.trim().toLowerCase();
  return USERNAME_RE.test(u) ? u : null;
}
function normEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return EMAIL_RE.test(e) ? e : null;
}
function randHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Row = typeof schema.waitlist.$inferSelect;

/** A row holds its username/email while verified, or unverified within 24h. */
function isHeld(row: Row): boolean {
  if (row.verified) return true;
  return Date.now() - Date.parse(row.createdAt) < HOLD_MS;
}

async function sendVerifyEmail(origin: string, email: string, username: string, token: string) {
  const link = `${origin}/api/waitlist/verify?token=${token}`;
  const subject = "Confirm your EVO TV username";
  const text =
    `You reserved @${username} on the EVO TV waitlist.\n\n` +
    `Confirm within 24 hours to lock it in:\n${link}\n\n` +
    `If you do not confirm, the name opens up for someone else. ` +
    `If this was not you, ignore this email.`;
  const html = `
  <div style="background:#0A0A0A;padding:32px 0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:480px;margin:0 auto;background:#111;border:1px solid #1f1f1f;border-radius:16px;padding:28px;color:#fff">
      <div style="font-weight:800;font-size:18px;color:#fff">EVO TV</div>
      <h1 style="font-size:20px;margin:18px 0 8px">Confirm your username</h1>
      <p style="color:#b3b3b3;font-size:14px;line-height:1.5;margin:0 0 18px">
        You reserved <strong style="color:#2CD7E3">@${username}</strong> on the EVO TV waitlist.
        Confirm within 24 hours to lock it in. If you do not, the name opens up for someone else.
      </p>
      <a href="${link}" style="display:inline-block;background:#2CD7E3;color:#000;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px">Confirm my username</a>
      <p style="color:#6b6b6b;font-size:12px;margin:18px 0 0">If the button does not work, paste this link into your browser:<br>${link}</p>
    </div>
  </div>`;
  await sendMail({ to: email, subject, text, html, replyTo: email });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;

  // Email availability: ?email=foo@bar.com -> { available }
  const emailParam = params.get("email");
  if (emailParam !== null) {
    const email = normEmail(emailParam);
    if (!email) {
      return json({ available: false, error: "Enter a valid email." }, 400);
    }
    const rows = await db
      .select()
      .from(schema.waitlist)
      .where(eq(schema.waitlist.email, email));
    return json({ available: !rows.some(isHeld), email });
  }

  // Username availability: ?username=foo -> { available }
  const username = normUsername(params.get("username"));
  if (!username) {
    return json(
      { available: false, error: "Username must be 3-20 chars (a-z, 0-9, _)." },
      400,
    );
  }
  const rows = await db
    .select()
    .from(schema.waitlist)
    .where(eq(schema.waitlist.username, username));
  return json({ available: !rows.some(isHeld), username });
}

export async function POST(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const body = (await req.json().catch(() => null)) as {
    email?: unknown;
    username?: unknown;
  } | null;
  if (!body) return json({ error: "Invalid body" }, 400);

  const email = normEmail(body.email);
  const username = normUsername(body.username);
  if (!email) return json({ error: "Enter a valid email." }, 400);
  if (!username) {
    return json({ error: "Username must be 3-20 chars (a-z, 0-9, _)." }, 400);
  }
  if (!isMailConfigured()) {
    return json({ error: "Sign-ups are paused for a moment. Try again shortly." }, 503);
  }

  const userRows = await db
    .select()
    .from(schema.waitlist)
    .where(eq(schema.waitlist.username, username));
  const emailRows = await db
    .select()
    .from(schema.waitlist)
    .where(eq(schema.waitlist.email, email));

  const emailHeld = emailRows.find(isHeld);
  // Same person re-submitting a still-pending reservation: just resend the link.
  if (emailHeld && !emailHeld.verified && emailHeld.username === username) {
    try {
      await sendVerifyEmail(origin, email, username, emailHeld.verifyToken ?? "");
    } catch {
      /* ignore resend failure */
    }
    return json({ ok: true, pending: true, resent: true, username });
  }
  if (emailHeld && emailHeld.verified) {
    return json({ error: "You are already confirmed on the list." }, 409);
  }
  if (emailHeld) {
    return json(
      { error: "This email already has a pending reservation. Check your inbox." },
      409,
    );
  }
  const userHeld = userRows.find(isHeld);
  if (userHeld) {
    return json({ error: "That username is already reserved.", field: "username" }, 409);
  }

  // Free up any expired rows occupying these unique slots.
  const expiredIds = [...userRows, ...emailRows]
    .filter((r) => !isHeld(r))
    .map((r) => r.id);
  if (expiredIds.length) {
    await db.delete(schema.waitlist).where(inArray(schema.waitlist.id, expiredIds));
  }

  const id = "wl_" + randHex(8);
  const token = randHex(24);
  try {
    await db.insert(schema.waitlist).values({
      id,
      email,
      username,
      source: "web",
      createdAt: new Date().toISOString(),
      verified: false,
      verifyToken: token,
    });
  } catch {
    return json(
      { error: "That email or username was just taken. Try again." },
      409,
    );
  }

  try {
    await sendVerifyEmail(origin, email, username, token);
  } catch {
    // Saved, but the email failed. The 24h expiry still protects the name.
    return json({ ok: true, pending: true, emailSent: false, username });
  }

  return json({ ok: true, pending: true, username });
}
