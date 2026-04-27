"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Download, Loader2 } from "lucide-react";

import { listAppPlatforms, type AppPlatform, type AppKind } from "@/lib/mock/apps";
import { Button } from "@/components/ui/button";
import { AppStatusBadge } from "@/components/apps/status-badge";
import { PlatformIcon } from "@/components/apps/platform-icons";

const KIND_TO_PATH: Record<AppKind, string> = {
  tv: "/apps/tv",
  android: "/apps/android",
  ios: "/apps/ios",
  windows: "/apps/desktop",
  macos: "/apps/desktop",
  linux: "/apps/desktop",
};

const FAMILY_LABEL: Record<AppPlatform["family"], string> = {
  tv: "TV apps",
  mobile: "Mobile apps",
  desktop: "Desktop apps",
};

export default function AppsOverviewPage() {
  const q = useQuery({ queryKey: ["apps"], queryFn: () => listAppPlatforms() });

  if (q.isLoading) return <AppsSkeleton />;
  const apps = q.data ?? [];

  const grouped = apps.reduce<Record<AppPlatform["family"], AppPlatform[]>>(
    (acc, app) => {
      (acc[app.family] ||= []).push(app);
      return acc;
    },
    { tv: [], mobile: [], desktop: [] },
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <header className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">
          <Download className="size-3" /> EVO TV everywhere
        </span>
        <h1 className="mt-4 text-3xl font-bold text-neutral-50 sm:text-4xl">
          Watch EVO TV on every screen.
        </h1>
        <p className="mt-3 text-sm text-neutral-400 sm:text-base">
          Mobile, desktop and the big screen. The same African esports, exactly where you want them.
        </p>
      </header>

      {(["tv", "mobile", "desktop"] as const).map((family) => (
        <section key={family} className="mt-12">
          <h2 className="mb-4 text-xl font-semibold text-neutral-100">{FAMILY_LABEL[family]}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grouped[family].map((app) => (
              <Link
                key={app.id}
                href={KIND_TO_PATH[app.kind]}
                className="group flex flex-col gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 transition-colors hover:border-sky-500/40 hover:bg-neutral-900/70"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-800/80 text-neutral-100 group-hover:bg-sky-500/15 group-hover:text-sky-300">
                    <PlatformIcon kind={app.kind} className="size-6" />
                  </span>
                  <AppStatusBadge status={app.status} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-50">{app.name}</h3>
                  <p className="mt-1 text-sm text-neutral-400 line-clamp-2">{app.blurb}</p>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-neutral-800 pt-3 text-xs text-neutral-400">
                  <span>{app.version ? `v${app.version}` : "Coming soon"}</span>
                  <span className="flex items-center gap-1 font-semibold text-sky-300 group-hover:translate-x-0.5 transition-transform">
                    Install <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <div className="mt-16 rounded-2xl border border-neutral-800 bg-gradient-to-br from-sky-500/10 via-neutral-900/40 to-amber-500/10 p-6 text-center sm:p-8">
        <h3 className="text-xl font-semibold text-neutral-50">No app for your device?</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm text-neutral-400">
          The web app at evo.tv works on any modern browser — phone, tablet, console, or smart fridge.
        </p>
        <Button asChild className="mt-4 bg-sky-500 font-semibold text-neutral-950 hover:bg-sky-400">
          <Link href="/discover">Open EVO TV in the browser</Link>
        </Button>
      </div>
    </div>
  );
}

function AppsSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-500" />
      </div>
    </div>
  );
}
