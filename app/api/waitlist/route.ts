import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";

/**
 * Public pre-launch waitlist.
 *
 *   GET  /api/waitlist?username=foo  -> { available: boolean }
 *   POST /api/waitlist { email, username }  -> reserve (409 if email/username taken)
 *
 * No auth — this is the marketing-site signup. Email + username are unique;
 * username is normalized lowercase, 3-20 chars of [a-z0-9_].
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

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
function genId(): string {
  return (
    "wl_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export async function GET(req: NextRequest) {
  const username = normUsername(new URL(req.url).searchParams.get("username"));
  if (!username) {
    return NextResponse.json(
      { available: false, error: "Username must be 3-20 chars (a-z, 0-9, _)." },
      { status: 400 },
    );
  }
  const taken = (
    await db
      .select({ id: schema.waitlist.id })
      .from(schema.waitlist)
      .where(eq(schema.waitlist.username, username))
      .limit(1)
  ).length;
  return NextResponse.json({ available: taken === 0, username });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    email?: unknown;
    username?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const email = normEmail(body.email);
  const username = normUsername(body.username);
  if (!email) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (!username) {
    return NextResponse.json(
      { error: "Username must be 3-20 chars (a-z, 0-9, _)." },
      { status: 400 },
    );
  }

  const emailTaken = (
    await db
      .select({ id: schema.waitlist.id })
      .from(schema.waitlist)
      .where(eq(schema.waitlist.email, email))
      .limit(1)
  ).length;
  if (emailTaken) {
    return NextResponse.json(
      { error: "You're already on the list." },
      { status: 409 },
    );
  }
  const userTaken = (
    await db
      .select({ id: schema.waitlist.id })
      .from(schema.waitlist)
      .where(eq(schema.waitlist.username, username))
      .limit(1)
  ).length;
  if (userTaken) {
    return NextResponse.json(
      { error: "That username is already reserved.", field: "username" },
      { status: 409 },
    );
  }

  const id = genId();
  try {
    await db.insert(schema.waitlist).values({
      id,
      email,
      username,
      source: "web",
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Unique race — someone grabbed it between the check and insert.
    return NextResponse.json(
      { error: "That email or username was just taken. Try again." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, id, username });
}
