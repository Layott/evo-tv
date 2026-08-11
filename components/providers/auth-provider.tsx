"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Profile, Role } from "@/lib/types";
import { authClient } from "@/lib/auth/client";
import { getCurrentUser, listFollows, toggleFollow as apiToggleFollow } from "@/lib/client";

/**
 * Real authentication, replacing the mock session provider.
 *
 * The old provider picked a fabricated profile out of `lib/mock/users.ts` by
 * role and kept it in localStorage, so "signing in" never touched the server and
 * every account was invented. This one holds a real Better-Auth session and
 * hydrates the profile from `/api/users/me`.
 *
 * The context surface is unchanged so call sites did not have to move, with one
 * exception: `login` now takes credentials and returns a result, because a real
 * sign-in can fail.
 */

type FollowTargetType = "team" | "player" | "streamer";

interface AuthContextValue {
  user: Profile | null;
  role: Role;
  /** False until the session and profile have both resolved. */
  ready: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    input: { email: string; password: string; name: string },
  ) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  toggleFollow: (targetType: FollowTargetType, targetId: string) => void;
  isFollowing: (targetType: FollowTargetType, targetId: string) => boolean;
  updateProfile: (patch: Partial<Profile>) => void;
  onboardingComplete: boolean;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

/**
 * `proxy.ts` gates page routes on this cookie. It is a UX hint only: every API
 * route re-checks the real session server-side and 401s or 403s on its own, so a
 * forged cookie buys nothing but a redirect.
 */
function syncRoleCookie(role: Role) {
  if (typeof document === "undefined") return;
  if (role === "guest") {
    document.cookie = "evotv_role=; path=/; max-age=0";
    return;
  }
  document.cookie = `evotv_role=${role}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  // The profile is the server's view of the account, not the session payload.
  const { data: user = null, isPending: profilePending } = useQuery({
    queryKey: ["auth", "me", session?.user?.id ?? null],
    queryFn: () => getCurrentUser(),
    enabled: signedIn,
  });

  const { data: follows = [] } = useQuery({
    queryKey: ["auth", "follows", session?.user?.id ?? null],
    queryFn: () => listFollows(),
    enabled: signedIn,
  });

  const role: Role = signedIn ? ((user?.role as Role) ?? "user") : "guest";

  React.useEffect(() => {
    syncRoleCookie(role);
  }, [role]);

  const followKeys = React.useMemo(
    () => new Set(follows.map((f) => `${f.targetType}:${f.targetId}`)),
    [follows],
  );

  const invalidate = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["auth"] });
  }, [queryClient]);

  const value: AuthContextValue = {
    user,
    role,
    ready: !sessionPending && (!signedIn || !profilePending),

    async signIn(email, password) {
      const res = await authClient.signIn.email({ email, password });
      if (res.error) return { error: res.error.message ?? "Sign in failed" };
      await invalidate();
      return {};
    },

    async signUp({ email, password, name }) {
      const res = await authClient.signUp.email({ email, password, name });
      if (res.error) return { error: res.error.message ?? "Sign up failed" };
      await invalidate();
      return {};
    },

    async logout() {
      await authClient.signOut();
      syncRoleCookie("guest");
      // Drop every cached query: much of it is scoped to the account.
      queryClient.clear();
    },

    refresh: invalidate,

    isFollowing(targetType, targetId) {
      return followKeys.has(`${targetType}:${targetId}`);
    },

    toggleFollow(targetType, targetId) {
      void apiToggleFollow("", targetId, targetType).then(() =>
        queryClient.invalidateQueries({ queryKey: ["auth", "follows"] }),
      );
    },

    updateProfile(patch) {
      void fetch("/api/users/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      }).then(() => invalidate());
    },

    // Onboarding is a per-account flag on the profile, not a browser flag.
    onboardingComplete: Boolean(user?.onboardedAt),
    completeOnboarding() {
      void fetch("/api/users/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ onboarded: true }),
      }).then(() => invalidate());
    },
    resetOnboarding() {
      void invalidate();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
