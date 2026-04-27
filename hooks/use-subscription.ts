"use client";

import { useQuery } from "@tanstack/react-query";
import type { Subscription } from "@/lib/types";

async function fetchSub(): Promise<Subscription | null> {
  const res = await fetch("/api/subscriptions/me", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const json = (await res.json()) as { subscription: Subscription | null };
  return json.subscription;
}

export function useSubscription() {
  const query = useQuery({
    queryKey: ["subscription", "me"],
    queryFn: fetchSub,
    staleTime: 60_000,
  });
  return {
    subscription: query.data ?? null,
    isPremium: query.data?.status === "active" && query.data.tier === "premium",
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
