"use client";

import * as React from "react";
import type { Profile, Role } from "@/lib/types";
import { profiles } from "@/lib/mock/users";

interface MockSession {
  user: Profile | null;
  role: Role;
}

interface MockAuthContextValue extends MockSession {
  login: (role: Role) => void;
  logout: () => void;
  toggleFollow: (targetType: "team" | "player" | "streamer", targetId: string) => void;
  isFollowing: (targetType: "team" | "player" | "streamer", targetId: string) => boolean;
  updateProfile: (patch: Partial<Profile>) => void;
  onboardingComplete: boolean;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

const STORAGE_KEY = "evotv_mock_session_v1";
const FOLLOWS_KEY = "evotv_mock_follows_v1";
const ONBOARD_KEY = "evotv_mock_onboarded_v1";

const MockAuthContext = React.createContext<MockAuthContextValue | null>(null);

function pickProfileByRole(role: Role): Profile | null {
  if (role === "guest") return null;
  if (role === "admin") return profiles.find((p) => p.role === "admin") ?? null;
  if (role === "premium") return profiles.find((p) => p.role === "premium") ?? null;
  return profiles.find((p) => p.role === "user") ?? null;
}

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0`;
}

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = React.useState<Role>("guest");
  const [user, setUser] = React.useState<Profile | null>(null);
  const [follows, setFollows] = React.useState<Set<string>>(new Set());
  const [onboardingComplete, setOnboardingComplete] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { role: Role; userId?: string };
        setRole(parsed.role);
        setUser(pickProfileByRole(parsed.role));
        setCookie("evotv_role", parsed.role);
      }
      const followsRaw = window.localStorage.getItem(FOLLOWS_KEY);
      if (followsRaw) setFollows(new Set(JSON.parse(followsRaw) as string[]));
      const onboard = window.localStorage.getItem(ONBOARD_KEY);
      if (onboard === "true") setOnboardingComplete(true);
    } catch {
      /* noop */
    }
    setHydrated(true);
  }, []);

  const login = React.useCallback((nextRole: Role) => {
    setRole(nextRole);
    setUser(pickProfileByRole(nextRole));
    setCookie("evotv_role", nextRole);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ role: nextRole }));
    } catch {
      /* noop */
    }
  }, []);

  const logout = React.useCallback(() => {
    setRole("guest");
    setUser(null);
    clearCookie("evotv_role");
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }, []);

  const toggleFollow = React.useCallback(
    (targetType: "team" | "player" | "streamer", targetId: string) => {
      const key = `${targetType}:${targetId}`;
      setFollows((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        try {
          window.localStorage.setItem(FOLLOWS_KEY, JSON.stringify([...next]));
        } catch {
          /* noop */
        }
        return next;
      });
    },
    []
  );

  const isFollowing = React.useCallback(
    (targetType: "team" | "player" | "streamer", targetId: string) => {
      return follows.has(`${targetType}:${targetId}`);
    },
    [follows]
  );

  const updateProfile = React.useCallback((patch: Partial<Profile>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const completeOnboarding = React.useCallback(() => {
    setOnboardingComplete(true);
    try {
      window.localStorage.setItem(ONBOARD_KEY, "true");
    } catch {
      /* noop */
    }
  }, []);

  const resetOnboarding = React.useCallback(() => {
    setOnboardingComplete(false);
    try {
      window.localStorage.removeItem(ONBOARD_KEY);
    } catch {
      /* noop */
    }
  }, []);

  const value = React.useMemo<MockAuthContextValue>(
    () => ({
      user,
      role,
      login,
      logout,
      toggleFollow,
      isFollowing,
      updateProfile,
      onboardingComplete,
      completeOnboarding,
      resetOnboarding,
    }),
    [user, role, login, logout, toggleFollow, isFollowing, updateProfile, onboardingComplete, completeOnboarding, resetOnboarding]
  );

  return (
    <MockAuthContext.Provider value={value}>
      <div style={{ visibility: hydrated ? "visible" : "hidden" }}>{children}</div>
    </MockAuthContext.Provider>
  );
}

export function useMockAuth() {
  const ctx = React.useContext(MockAuthContext);
  if (!ctx) throw new Error("useMockAuth must be used inside <MockAuthProvider>");
  return ctx;
}
