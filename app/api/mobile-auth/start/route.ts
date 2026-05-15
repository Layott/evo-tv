import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * GET /api/mobile-auth/start?provider=google
 *
 * Browser-friendly wrapper around Better-Auth's POST /api/auth/sign-in/social.
 * Used by the RN client opening an in-app browser via expo-web-browser. The
 * RN side cannot POST + capture cookies, so this route:
 *   1. Calls auth.api.signInSocial server-side (sets the state cookie on response)
 *   2. Forwards the Set-Cookie headers
 *   3. 302s to the provider's authorize URL
 *
 * callbackURL is forced to /api/mobile-auth/finish so the final hop emits the
 * deep link with the bearer token. This keeps the deep-link target fixed and
 * out of the social URL's exposed query string.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider");
  if (provider !== "google" && provider !== "apple") {
    return new NextResponse("Invalid provider", { status: 400 });
  }

  const baseURL = process.env.BETTER_AUTH_URL ?? "https://evo-tv.vercel.app";
  const callbackURL = `${baseURL}/api/mobile-auth/finish`;

  const result = await auth.api.signInSocial({
    body: { provider, callbackURL },
    headers: req.headers,
    asResponse: true,
  });

  const body = (await result.json()) as { url?: string };
  if (!body.url) {
    return new NextResponse("Failed to start OAuth", { status: 500 });
  }

  const redirect = NextResponse.redirect(body.url, 302);
  result.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      redirect.headers.append("set-cookie", value);
    }
  });
  return redirect;
}
