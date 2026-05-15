import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3060",
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
  // are present — keeps the auth instance bootable without creds in dev.
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
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
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
  plugins: [bearer()],
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
