import { NextResponse, type NextRequest } from "next/server";

import { sendMail, isMailConfigured } from "@/lib/email";
import { log } from "@/lib/log";

/**
 * Public contact form for the marketing site.
 *
 *   POST /api/contact { name, email, message } -> emails the EVO TV inbox
 *
 * No auth, no DB. Cross-origin (the marketing website is a separate origin),
 * so CORS is allowed for this public, credential-free endpoint.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TO = process.env.CONTACT_TO ?? "naijagameevo@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    email?: unknown;
    message?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: CORS });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (name.length < 2) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400, headers: CORS });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400, headers: CORS });
  }
  if (message.length < 5) {
    return NextResponse.json({ error: "Tell us a bit more." }, { status: 400, headers: CORS });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "Message is too long." }, { status: 400, headers: CORS });
  }

  const subject = `EVO TV contact: ${name}`;
  const text = `From: ${name} <${email}>\n\n${message}`;
  const html = `<p style="margin:0 0 12px"><strong>From:</strong> ${esc(name)} (${esc(email)})</p><p style="white-space:pre-wrap;margin:0">${esc(message)}</p>`;

  if (!isMailConfigured()) {
    log.warn("contact.not_configured");
    return NextResponse.json(
      { error: "Email is not set up yet. Please try again later." },
      { status: 503, headers: CORS },
    );
  }

  try {
    await sendMail({ to: TO, subject, text, html, replyTo: email });
  } catch (e) {
    log.warn("contact.send.failed", { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json(
      { error: "Could not send right now. Try again later." },
      { status: 502, headers: CORS },
    );
  }

  return NextResponse.json({ ok: true }, { headers: CORS });
}
