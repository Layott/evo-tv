import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * GET /api/mobile-auth/finish
 *
 * Better-Auth's social callback redirects here after the user grants consent.
 * The session cookie is set at this point; we read the bearer token from the
 * session and 302 to a deep link the RN client picks up via
 * WebBrowser.openAuthSessionAsync.
 *
 * Fragment (#) is used instead of query (?) so the token doesn't land in
 * server access logs.
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const deepLink = "evotv://oauth";

  const token = session?.session?.token;
  if (!token) {
    return NextResponse.redirect(`${deepLink}#error=no_session`, 302);
  }

  return NextResponse.redirect(`${deepLink}#token=${encodeURIComponent(token)}`, 302);
}
