"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  Laptop,
  Loader2,
  Monitor,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";

import { listAppPlatforms, type AppKind, type AppPlatform } from "@/lib/mock/apps";
import { Button } from "@/components/ui/button";
import { AppStatusBadge } from "@/components/apps/status-badge";
import { ScreenshotCarousel } from "@/components/apps/screenshot-carousel";
import { NotifyForm } from "@/components/apps/notify-form";

const FAKE_BUILD_URLS: Record<AppKind, string> = {
  windows: "https://downloads.evo.tv/desktop/EVOTV-Setup-0.7.1.exe",
  macos: "https://downloads.evo.tv/desktop/EVOTV-0.7.1.dmg",
  linux: "https://downloads.evo.tv/desktop/EVOTV-0.7.1.AppImage",
  // unused on this page but required by record:
  tv: "",
  android: "",
  ios: "",
};

function PlatformCard({ app }: { app: AppPlatform }) {
  const Icon = app.kind === "windows" ? Monitor : app.kind === "macos" ? Laptop : Terminal;
  const url = FAKE_BUILD_URLS[app.kind];
  function onDownload() {
    if (app.status === "coming-soon") {
      toast.message(`${app.name} not ready yet`, {
        description: "We'll email you the moment it lands.",
      });
      return;
    }
    toast.success(`Downloading ${app.name}`, {
      description: url,
    });
  }
  const labelByKind: Record<AppKind, string> = {
    windows: "Windows 10/11 · 64-bit",
    macos: "Universal · Apple Silicon + Intel",
    linux: "AppImage · Ubuntu/Debian",
    tv: "",
    android: "",
    ios: "",
  };
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
      <div className="flex items-center justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-800/80 text-neutral-100">
          <Icon className="size-6" />
        </span>
        <AppStatusBadge status={app.status} />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-neutral-50">{app.name}</h3>
        <p className="mt-0.5 text-xs text-neutral-500">{labelByKind[app.kind]}</p>
      </div>
      <p className="text-sm text-neutral-400 line-clamp-3">{app.blurb}</p>
      <div className="mt-auto flex items-center justify-between border-t border-neutral-800 pt-4">
        <span className="text-xs text-neutral-500">v{app.version} · {app.size}</span>
        <Button
          onClick={onDownload}
          disabled={app.status === "coming-soon"}
          className="bg-sky-500 font-semibold text-neutral-950 hover:bg-sky-400 disabled:opacity-50"
        >
          <Download className="size-4" />
          Download
        </Button>
      </div>
    </div>
  );
}

export default function AppsDesktopPage() {
  const q = useQuery({ queryKey: ["apps"], queryFn: () => listAppPlatforms() });

  if (q.isLoading || !q.data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-neutral-500" />
        </div>
      </div>
    );
  }

  const desktops = q.data.filter((a) => a.family === "desktop");
  const sample = desktops[0]!;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <Link
        href="/apps"
        className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-100"
      >
        <ArrowLeft className="size-3.5" /> All apps
      </Link>

      <header className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">
            <Monitor className="size-3.5" /> Desktop apps
          </span>
          <h1 className="mt-4 text-3xl font-bold text-neutral-50 sm:text-5xl">
            EVO TV for the desk.
          </h1>
          <p className="mt-4 max-w-xl text-base text-neutral-400">
            A dedicated player for Windows, macOS and Linux. Slim chat dock, global hotkeys,
            mini-player mode for second monitors. Built for the multi-screen pro.
          </p>
        </div>

        <ScreenshotCarousel screenshots={sample.screenshots} frame="desktop" />
      </header>

      <section className="mt-12">
        <h2 className="mb-4 text-lg font-semibold text-neutral-100">Pick your platform</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {desktops.map((app) => (
            <PlatformCard key={app.id} app={app} />
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
          <h3 className="text-lg font-semibold text-neutral-100">Built for power users</h3>
          <ul className="mt-3 space-y-2 text-sm text-neutral-400">
            <li>• Always-on-top mini player for second monitors</li>
            <li>• Global hotkeys (mute, pause, swap stream)</li>
            <li>• Native notifications when a tracked team goes live</li>
            <li>• System tray quick-launch</li>
          </ul>
        </div>
        <NotifyForm platformLabel="EVO TV for Linux" />
      </section>
    </div>
  );
}
