import { NextResponse, type NextRequest } from "next/server";

/* ── Page-level auth routing ────────────────────────────────────────── */

const AUTHED_PREFIXES = [
  "/profile",
  "/library",
  "/settings",
  "/notifications",
  "/checkout",
  "/cart",
  "/order",
];
const ADMIN_PREFIX = "/admin";

const AUTH_PAGES = ["/login", "/signup", "/onboarding", "/verify-email", "/forgot-password", "/reset-password"];

/* ── CORS for /api/* ────────────────────────────────────────────────── */

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
  if (ORIGIN_LIST === null) return reqOrigin;
  return ORIGIN_LIST.has(reqOrigin) ? reqOrigin : null;
}

const ALLOW_HEADERS =
  "Authorization, Content-Type, X-Requested-With, Accept, X-Better-Auth-Bearer";
const ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD";
const EXPOSE_HEADERS = "Set-Auth-Token, X-Better-Auth-Bearer";

function corsHeaders(allow: string | null, includeMethodsAndHeaders: boolean): Record<string, string> {
  const h: Record<string, string> = {};
  if (allow) {
    h["Access-Control-Allow-Origin"] = allow;
    h["Access-Control-Allow-Credentials"] = "true";
    h["Vary"] = "Origin";
    h["Access-Control-Expose-Headers"] = EXPOSE_HEADERS;
  }
  if (includeMethodsAndHeaders) {
    h["Access-Control-Allow-Methods"] = ALLOW_METHODS;
    h["Access-Control-Allow-Headers"] = ALLOW_HEADERS;
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}

function handleApi(req: NextRequest): NextResponse {
  const origin = req.headers.get("origin");
  const allow = pickOrigin(origin);

  if (req.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    for (const [k, v] of Object.entries(corsHeaders(allow, true))) {
      res.headers.set(k, v);
    }
    return res;
  }

  const res = NextResponse.next();
  for (const [k, v] of Object.entries(corsHeaders(allow, false))) {
    res.headers.set(k, v);
  }
  return res;
}

/* ── Entrypoint ─────────────────────────────────────────────────────── */

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /api/* → CORS only, never redirect.
  if (pathname.startsWith("/api/")) {
    return handleApi(req);
  }

  // Page-level auth routing for everything else.
  //
  // Whether someone is signed in comes from the Better-Auth session cookie,
  // which the server sets and the browser cannot forge. `evotv_role` is written
  // by the client after the profile loads, so it lags a fresh sign-in by a
  // round trip: gating on it bounced admins straight back to the login page
  // they had just used.
  //
  // Role is therefore a hint here and nothing more. Real enforcement is
  // `AdminGuard`, which reads the resolved session, and every /api/admin route,
  // which re-checks server-side and 403s.
  const signedIn =
    req.cookies.has("evotv.session_token") ||
    req.cookies.has("__Secure-evotv.session_token");
  const role = signedIn
    ? (req.cookies.get("evotv_role")?.value ?? "user")
    : "guest";

  // `/` is the public landing page. Signed-in users are sent to the app before
  // it renders, so the landing stays a pure guest surface and never has to
  // branch on a session it would then have to fetch.
  if (pathname === "/" && role !== "guest") {
    const url = req.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  // Only the signed-out are turned away here; a signed-in non-admin gets the
  // "Admin access required" screen from AdminGuard rather than a redirect loop.
  if (pathname.startsWith(ADMIN_PREFIX)) {
    if (!signedIn) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (AUTHED_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (role === "guest") {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (role !== "guest" && AUTH_PAGES.includes(pathname) && pathname !== "/onboarding") {
    const url = req.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|mp4|m3u8)).*)",
  ],
};
