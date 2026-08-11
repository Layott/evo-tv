"use client";

import * as React from "react";
import Link from "next/link";
import { Code2, Lock, Sparkles } from "lucide-react";

import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { EmbedGenerator } from "@/components/embed/embed-generator";

export default function EmbedHomePage() {
  const { role } = useAuth();
  const isPremium = role === "premium" || role === "admin";

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link
            href="/home"
            className="flex items-center gap-2 text-sm font-semibold text-neutral-100 hover:text-sky-300"
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-sky-500/15 text-sky-300">
              <Code2 className="size-4" />
            </span>
            EVO TV embeds
          </Link>
          <Link
            href="/home"
            className="text-xs text-neutral-400 hover:text-neutral-200"
          >
            Back to EVO TV →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300">
            <Sparkles className="size-3" /> Premium feature
          </span>
          <h1 className="mt-4 text-3xl font-bold text-neutral-50 sm:text-5xl">
            Put EVO TV anywhere on the web.
          </h1>
          <p className="mt-3 text-sm text-neutral-400 sm:text-base">
            Embed any live stream or recent VOD on your blog, your team site, or your sponsor's
            landing page. One iframe. Zero friction.
          </p>
        </div>

        {!isPremium ? (
          <PremiumGate />
        ) : (
          <div className="mt-10">
            <EmbedGenerator />

            <section className="mt-12 grid gap-4 sm:grid-cols-3">
              {[
                {
                  title: "Lightweight",
                  body: "A single <iframe>. Works in Webflow, WordPress, Notion, Substack and more.",
                },
                {
                  title: "Configurable",
                  body: "Theme, autoplay, muted state and dimensions — set per-embed.",
                },
                {
                  title: "Always fresh",
                  body: "Embeds follow the source: when a stream goes live, the iframe shows it automatically.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5"
                >
                  <h3 className="font-semibold text-neutral-100">{f.title}</h3>
                  <p className="mt-1 text-sm text-neutral-400">{f.body}</p>
                </div>
              ))}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function PremiumGate() {
  return (
    <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-neutral-900/40 to-amber-500/10 p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/15 text-sky-300">
        <Lock className="size-5" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-neutral-50">
        Embeds are a Premium feature
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-400">
        Upgrade to embed live tournaments and VODs on any site you control. Stay in your brand,
        keep your audience close.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="bg-sky-500 font-semibold text-neutral-950 hover:bg-sky-400">
          <Link href="/upgrade">Upgrade to Premium</Link>
        </Button>
        <Button asChild variant="outline" className="border-neutral-800">
          <Link href="/discover">Browse free content</Link>
        </Button>
      </div>
    </div>
  );
}
