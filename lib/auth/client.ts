"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

/**
 * `emailOTPClient` mirrors the server's `emailOTP` plugin, which is what backs
 * password reset and email verification. Without it `authClient.emailOtp` does
 * not exist on the client, which is part of why those screens were never wired
 * to anything: there was nothing to call.
 */
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
  plugins: [emailOTPClient()],
});

export const { signIn, signUp, signOut, useSession, getSession, emailOtp } =
  authClient;
