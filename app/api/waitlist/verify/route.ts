import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";

/**
 * Email confirmation link target. The waitlist email points here; this verifies
 * the token, then redirects the visitor back to the marketing site with a
 * status so the site can show a confirmed (or expired) banner.
 *
 *   GET /api/waitlist/verify?token=...  ->  302 ${SITE}/?verify=ok&u=username
 */

const SITE = process.env.WAITLIST_SITE_URL ?? "https://evotv.vercel.app";

function back(status: string, username?: string) {
  const u = new URL(SITE);
  u.searchParams.set("verify", status);
  if (username) u.searchParams.set("u", username);
  return NextResponse.redirect(u.toString(), 302);
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return back("invalid");

  const rows = await db
    .select()
    .from(schema.waitlist)
    .where(eq(schema.waitlist.verifyToken, token))
    .limit(1);
  const row = rows[0];
  if (!row) return back("invalid");

  if (row.verified) return back("already", row.username);

  await db
    .update(schema.waitlist)
    .set({ verified: true, verifiedAt: new Date().toISOString() })
    .where(eq(schema.waitlist.id, row.id));

  return back("ok", row.username);
}
