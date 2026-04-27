"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download, Share2, Star } from "lucide-react";
import { toast } from "sonner";

import type { AppPlatform } from "@/lib/mock/apps";
import { Button } from "@/components/ui/button";
import { AppStatusBadge } from "@/components/apps/status-badge";
import { PlatformIcon } from "@/components/apps/platform-icons";
import { ScreenshotCarousel } from "@/components/apps/screenshot-carousel";

interface Props {
  app: AppPlatform;
  storeName: "Play Store" | "App Store";
  storeAccent: "google" | "apple";
  features: { title: string; body: string }[];
}

export function StoreLanding({ app, storeName, storeAccent, features }: Props) {
  function handleInstall() {
    toast.message(`${storeName} integration ships post-MVP`, {
      description: "We'll redirect to the real store listing once we publish.",
    });
  }

  function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.clipboard && url) {
      navigator.clipboard
        .writeText(url)
        .then(() => toast.success("Link copied"))
        .catch(() => toast.error("Could not copy"));
    } else {
      toast.message("Share unavailable");
    }
  }

  const accent =
    storeAccent === "google"
      ? "bg-emerald-500 text-neutral-950 hover:bg-emerald-400"
      : "bg-neutral-100 text-neutral-950 hover:bg-white";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <Link
        href="/apps"
        className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-100"
      >
        <ArrowLeft className="size-3.5" /> All apps
      </Link>

      <header className="mt-6 flex flex-col gap-6 rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500/30 via-neutral-800 to-amber-500/20 ring-1 ring-neutral-700">
          <PlatformIcon kind={app.kind} className="size-12 text-neutral-100" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-neutral-50 sm:text-3xl">{app.name}</h1>
            <AppStatusBadge status={app.status} />
          </div>
          <p className="mt-1 text-sm text-neutral-400">EVO TV · Sports & Entertainment</p>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-300">
            <span className="flex items-center gap-1">
              <Star className="size-3.5 fill-amber-400 text-amber-400" /> 4.8
            </span>
            <span className="text-neutral-500">·</span>
            <span>{app.size}</span>
            <span className="text-neutral-500">·</span>
            <span>v{app.version}</span>
            <span className="text-neutral-500">·</span>
            <span>2.1M downloads</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Button onClick={handleInstall} className={`${accent} h-12 px-6 text-base font-semibold`}>
            <Download className="size-4" />
            Install
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare} className="border-neutral-800">
            <Share2 className="size-3.5" />
            Share
          </Button>
        </div>
      </header>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-neutral-100">Screenshots</h2>
        <ScreenshotCarousel screenshots={app.screenshots} frame="phone" />
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
            <h3 className="font-semibold text-neutral-100">{f.title}</h3>
            <p className="mt-1 text-sm text-neutral-400">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-neutral-100">About this app</h2>
        <p className="mt-2 text-sm text-neutral-300">{app.blurb}</p>
        <p className="mt-3 text-sm text-neutral-400">
          EVO TV is Africa's home of mobile esports. Stream every major Free Fire, CoD Mobile, PUBG Mobile,
          and EAFC Mobile tournament across the continent — live and on demand. Follow your teams, jump into
          chat, and never miss a clutch.
        </p>
        <ul className="mt-4 grid gap-1 text-xs text-neutral-400 sm:grid-cols-2">
          <li>• Picture-in-Picture playback</li>
          <li>• Mobile data saver</li>
          <li>• Offline downloads (Premium)</li>
          <li>• 1080p HDR (Premium)</li>
          <li>• Push alerts when your team is live</li>
          <li>• Full chat + emotes</li>
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-neutral-100">What's new in v{app.version}</h2>
        <ul className="mt-3 space-y-2 text-sm text-neutral-400">
          <li>• Faster startup on cold launch</li>
          <li>• New film-room player overlays</li>
          <li>• Bug fixes and performance improvements</li>
        </ul>
      </section>
    </div>
  );
}
