import { auth } from "@/lib/auth";
import { revokeIdleWebSession } from "@/lib/auth/idle";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth.handler);

/**
 * Every Better-Auth call gets the idle check first.
 *
 * This is the route the browser's `useSession()` hits, so without it a page
 * shell would keep rendering as signed in for a viewer whose session the
 * server-side guards had already thrown away. Revoking here means the next
 * `get-session` finds nothing, clears the cookie, and the app signs itself out
 * on its own. See `lib/auth/idle.ts` for why the check runs before the handler
 * rather than on the session it returns.
 */
export async function GET(req: Request) {
  const revoked = await revokeIdleWebSession(req.headers);
  return withNotice(await handler.GET(req), revoked);
}

export async function POST(req: Request) {
  const revoked = await revokeIdleWebSession(req.headers);
  return withNotice(await handler.POST(req), revoked);
}

/**
 * Leave a crumb saying the sign-out was the idle rule, not a fault.
 *
 * Somebody who comes back after lunch and silently finds themself signed out
 * reads that as the site being broken. The login page picks this cookie up and
 * says what happened. Deliberately readable by script and short-lived: it
 * carries no identity, only a reason, and the page clears it once shown.
 *
 * Shares COOKIE_DOMAIN with the session cookie because this route answers on
 * api.evotv.co while the login page it is talking to is on the apex.
 */
function withNotice(res: Response, revoked: boolean): Response {
  if (!revoked) return res;
  const domain = process.env.COOKIE_DOMAIN;
  try {
    const out = new Response(res.body, res);
    out.headers.append(
      "Set-Cookie",
      `evotv_signed_out=idle; Path=/; Max-Age=300; SameSite=Lax${
        domain ? `; Domain=${domain}` : ""
      }`,
    );
    return out;
  } catch {
    // Some responses cannot be copied (a redirect with a null-body status, for
    // one). The sign-out has already happened and is the part that matters;
    // losing the explanation is not worth failing the request over.
    return res;
  }
}
