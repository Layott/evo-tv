import { NextResponse, type NextRequest } from "next/server";

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

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = req.cookies.get("evotv_role")?.value ?? "guest";

  if (pathname.startsWith(ADMIN_PREFIX)) {
    if (role !== "admin") {
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
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|mp4|m3u8)).*)",
  ],
};
