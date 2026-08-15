import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { emailOTP } from "better-auth/plugins/email-otp";
import { db } from "@/lib/db";
import * as schema from "@/db/schema";
import { isAccountBlocked } from "@/lib/sanctions";
import { sendEmail } from "@/lib/email/send";
import { renderOtpEmail } from "@/lib/email/templates";
import { SESSION_MAX_AGE_SEC, SESSION_UPDATE_AGE_SEC } from "./idle";

/**
 * Origins allowed to drive auth from a browser.
 *
 * Better-Auth defaults trustedOrigins to [baseURL] and rejects state-changing
 * requests whose Origin header does not match. On Vercel the app and the API
 * shared one origin so that was invisible; splitting them into app.evotv.co
 * and api.evotv.co makes every browser sign-in cross-origin, and the default
 * would reject all of them.
 *
 * Same variable proxy.ts uses for CORS, deliberately: the browser's preflight
 * and Better-Auth's origin check have to agree, and two lists would drift.
 *
 * Left unset the array is empty and Better-Auth keeps its own [baseURL]
 * default, which is correct for local development.
 */
const TRUSTED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && s !== "*");

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3060",
  ...(TRUSTED_ORIGINS.length > 0 ? { trustedOrigins: TRUSTED_ORIGINS } : {}),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: process.env.AUTH_SECRET ?? "dev_secret",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  // Phase 8.1 SSO providers. Each block activates only when both env vars
  // are present - keeps the auth instance bootable without creds in dev.
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
      ? {
          apple: {
            clientId: process.env.APPLE_CLIENT_ID,
            clientSecret: process.env.APPLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  session: {
    // The row lives a week and slides forward as it is used. Browsers get a
    // much shorter three-hour idle window on top of this, enforced in
    // `lib/auth/idle.ts`; the app keeps the week and locks behind biometrics
    // instead. `updateAge` is what makes the idle clock tick, so it has to
    // stay well under that three hours.
    expiresIn: SESSION_MAX_AGE_SEC,
    updateAge: SESSION_UPDATE_AGE_SEC,
    // Kept at or below `updateAge`: a request served from the cached cookie
    // never reaches the database, so it neither slides the session nor lets
    // the idle check see it.
    cookieCache: { enabled: true, maxAge: SESSION_UPDATE_AGE_SEC },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
      "/forget-password": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
      handle: {
        type: "string",
        required: false,
      },
    },
  },
  advanced: {
    cookiePrefix: "evotv",
    /**
     * Share the session cookie across evotv.co, www., app. and api.
     *
     * Without this the cookie is host-only, and OAuth breaks in a way that
     * looks like a provider problem but is not. The social flow redirects to
     * `baseURL`, which is api.evotv.co, so Google returns the user there, the
     * callback sets a cookie for api.evotv.co, and then sends them on to
     * evotv.co, where that cookie does not exist. Sign-in appears to do
     * nothing at all.
     *
     * It is also what lets app.evotv.co eventually 301 to the apex without
     * signing everyone out on the way.
     *
     * Set COOKIE_DOMAIN in production, to `.evotv.co`. Left unset the cookie
     * stays host-only, which is correct for localhost, where a domain
     * attribute would be rejected outright.
     */
    ...(process.env.COOKIE_DOMAIN
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: process.env.COOKIE_DOMAIN,
          },
        }
      : {}),
    generateId: () =>
      "user_" +
      Array.from(crypto.getRandomValues(new Uint8Array(12)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
  },
  // Bearer plugin: lets the RN client send `Authorization: Bearer <token>`
  // instead of cookies. The token is the same value as `session.token`.
  // Sign-in returns the token in the response; the RN client stores it via
  // expo-secure-store and attaches it to every subsequent request.
  //
  // emailOTP plugin: powers /api/auth/email-otp/{send-verification-otp,
  // verify-email, sign-in-with-otp, forget-password}. Backend issues 6-digit
  // codes (Better-Auth manages generation + lookup + expiry); we just send
  // the email. In dev, when RESEND_API_KEY is unset, `sendEmail` falls back
  // to console.log so the OTP is visible in server logs.
  plugins: [
    bearer(),
    emailOTP({
      otpLength: 6,
      expiresIn: 600, // 10 minutes
      sendVerificationOnSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        const { subject, text, html } = renderOtpEmail({ otp, type });
        await sendEmail({ to: email, subject, text, html });
      },
    }),
  ],

  /**
   * Block sign-in for users with an active `suspended` or `banned` sanction.
   * Better-Auth fires `session.create.before` right before a row is written
   * to `session`; throwing here aborts the sign-in flow.
   *
   * Existing sessions are revoked by the sanction-issue route itself.
   */
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const userId = (session as { userId: string }).userId;
          if (userId) {
            const blocked = await isAccountBlocked(userId);
            if (blocked) {
              throw new Error("ACCOUNT_SUSPENDED");
            }
          }
          return { data: session };
        },
        after: async (session) => {
          // Forensic login event - best-effort, never blocks sign-in.
          try {
            const { recordLoginEvent } = await import("./login-events");
            await recordLoginEvent(session as { userId: string });
          } catch (err) {
            console.warn("[auth] login-event write failed", err);
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
