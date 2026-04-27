"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { getAppPlatform } from "@/lib/mock/apps";
import { StoreLanding } from "@/components/apps/store-landing";

export default function AppsAndroidPage() {
  const q = useQuery({
    queryKey: ["apps", "android"],
    queryFn: () => getAppPlatform("android"),
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
      storeName="Play Store"
      storeAccent="google"
      features={[
        {
          title: "Picture-in-Picture",
          body: "Keep the match floating while you reply to messages or hop between apps.",
        },
        {
          title: "Data saver",
          body: "Smart bitrate that ratchets down when you're on cellular without crushing quality.",
        },
        {
          title: "Push when live",
          body: "Pick the teams you follow. Wake-up nudges only when something you care about kicks off.",
        },
      ]}
    />
  );
}
