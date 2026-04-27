"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Sparkles, Tv } from "lucide-react";

import { getAppPlatform } from "@/lib/mock/apps";
import { Button } from "@/components/ui/button";
import { AppStatusBadge } from "@/components/apps/status-badge";
import { ScreenshotCarousel } from "@/components/apps/screenshot-carousel";
import { NotifyForm } from "@/components/apps/notify-form";
import { TvPairing } from "@/components/apps/tv-pairing";

export default function AppsTvPage() {
  const q = useQuery({ queryKey: ["apps", "tv"], queryFn: () => getAppPlatform("tv") });

  if (q.isLoading || !q.data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-neutral-500" />
        </div>
      </div>
    );
  }

  const app = q.data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <Link
        href="/apps"
        className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-100"
      >
        <ArrowLeft className="size-3.5" /> All apps
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">
            <Tv className="size-3.5" /> Built for the big screen
          </span>
          <h1 className="mt-4 text-3xl font-bold text-neutral-50 sm:text-5xl">
            EVO TV. <span className="text-sky-400">On your TV.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-neutral-400">
            The lean-back EVO experience. 4K-ready, optimized for the remote, and fully D-pad navigable.
            Drop straight into a live tournament — no hunting for the right input.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <AppStatusBadge status={app.status} />
            <span className="text-xs text-neutral-500">v{app.version ?? "0.9.0"} · {app.size}</span>
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-300">
              Supported platforms
            </h2>
            <div className="flex flex-wrap gap-2">
              {(app.subPlatforms ?? []).map((sp) => (
                <span
                  key={sp.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs"
                >
                  <span className="font-semibold text-neutral-100">{sp.name}</span>
                  <AppStatusBadge status={sp.status} />
                </span>
              ))}
            </div>
          </div>
        </div>

        <ScreenshotCarousel screenshots={app.screenshots} frame="tv" />
      </div>

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Built for the remote",
            body: "D-pad-first navigation. Every screen designed for one-thumb-on-the-couch operation.",
          },
          {
            title: "Picture-quality first",
            body: "4K HDR-ready playback on supported devices, with auto-bitrate that respects your network.",
          },
          {
            title: "Live + library",
            body: "One unified hub for live tournaments, on-demand recaps, and EVO Originals.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5"
          >
            <Sparkles className="size-5 text-amber-400" />
            <h3 className="mt-3 font-semibold text-neutral-100">{f.title}</h3>
            <p className="mt-1 text-sm text-neutral-400">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        <TvPairing />
        <NotifyForm platformLabel="EVO TV for Smart TV" />
      </section>

      <section className="mt-12 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 text-center sm:p-8">
        <h3 className="text-xl font-semibold text-neutral-50">Want it sooner?</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm text-neutral-400">
          The web app already works on any TV browser. Just open evo.tv in your TV's browser and you're in.
        </p>
        <Button asChild className="mt-4 bg-sky-500 font-semibold text-neutral-950 hover:bg-sky-400">
          <Link href="/discover">Open the web app</Link>
        </Button>
      </section>
    </div>
  );
}
