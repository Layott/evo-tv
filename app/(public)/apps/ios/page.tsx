"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { getAppPlatform } from "@/lib/mock/apps";
import { StoreLanding } from "@/components/apps/store-landing";

export default function AppsIosPage() {
  const q = useQuery({
    queryKey: ["apps", "ios"],
    queryFn: () => getAppPlatform("ios"),
  });

  if (q.isLoading || !q.data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-neutral-500" />
        </div>
      </div>
    );
  }

  return (
    <StoreLanding
      app={q.data}
      storeName="App Store"
      storeAccent="apple"
      features={[
        {
          title: "Native AirPlay",
          body: "One tap to push the live broadcast onto your Apple TV without missing a play.",
        },
        {
          title: "SharePlay Watch Together",
          body: "Catch finals over FaceTime with synced playback and shared chat.",
        },
        {
          title: "iPad-class layouts",
          body: "Multi-column film-room on the iPad with sidebar chat, brackets and stats.",
        },
      ]}
    />
  );
}
