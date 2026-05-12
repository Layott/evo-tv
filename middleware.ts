import { NextRequest, NextResponse } from "next/server";

/**
 * Global CORS middleware for /api/* routes.
 *
 * RN web SPA at evotv-app.vercel.app fetches with `credentials: "include"`,
 * so:
 *   - Access-Control-Allow-Origin MUST be the exact request origin (browsers
 *     reject `*` when credentials are included).
 *   - Access-Control-Allow-Credentials MUST be `true`.
 *
 * ALLOWED_ORIGINS env var:
 *   - `*`          → allow any origin (echoes Origin header back)
 *   - comma list   → allow only listed origins
 *   - unset        → echoes Origin (dev-friendly default)
 */

const ALLOWED = (process.env.ALLOWED_ORIGINS ?? "*").trim();
const ORIGIN_LIST =
  ALLOWED === "*"
    ? null
    : new Set(
        ALLOWED.split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );

function pickOrigin(reqOrigin: string | null): string | null {
  if (!reqOrigin) return null;
  if (ORIGIN_LIST === null) return reqOrigin; // wildcard mode
  return ORIGIN_LIST.has(reqOrigin) ? reqOrigin : null;
}

const ALLOW_HEADERS =
  "Authorization, Content-Type, X-Requested-With, Accept, X-Better-Auth-Bearer";
const ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD";
const EXPOSE_HEADERS = "Set-Auth-Token, X-Better-Auth-Bearer";

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allow = pickOrigin(origin);

  // Preflight
  if (req.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    if (allow) {
      res.headers.set("Access-Control-Allow-Origin", allow);
      res.headers.set("Access-Control-Allow-Credentials", "true");
      res.headers.set("Vary", "Origin");
    }
    res.headers.set("Access-Control-Allow-Methods", ALLOW_METHODS);
    res.headers.set("Access-Control-Allow-Headers", ALLOW_HEADERS);
    res.headers.set("Access-Control-Expose-Headers", EXPOSE_HEADERS);
    res.headers.set("Access-Control-Max-Age", "86400");
    return res;
  }

  // Pass through, then attach CORS headers on the response
  const res = NextResponse.next();
  if (allow) {
    res.headers.set("Access-Control-Allow-Origin", allow);
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Expose-Headers", EXPOSE_HEADERS);
  }
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
