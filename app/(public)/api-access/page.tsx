"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  Code2,
  Gauge,
  KeyRound,
  Layers,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { ApiAccessShell } from "@/components/api-access/api-access-shell";
import { ApiPaywallCard } from "@/components/api-access/paywall-card";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    title: "All v1 endpoints",
    body: "Streams, events, teams, players, VODs, clips, odds — same shape as the EVO TV app.",
    icon: Layers,
  },
  {
    title: "Real-time SSE",
    body: "Subscribe to chat, viewer counts, score events, and bracket updates without polling.",
    icon: Activity,
  },
  {
    title: "50,000 req / month",
    body: "Per Premium account. Burst-friendly, soft-limited. Higher tiers via direct contact.",
    icon: Gauge,
  },
  {
    title: "Stable & versioned",
    body: "Deprecation policy: 90-day notice. Breaking changes only with major version bump.",
    icon: ShieldCheck,
  },
];

export default function ApiAccessLandingPage() {
  const { role } = useMockAuth();
  const isPremium = role === "premium" || role === "admin";

  return (
    <ApiAccessShell>
      <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 p-8">
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="text-2xl font-semibold text-neutral-50 sm:text-3xl">
              Build on Africa's biggest esports dataset.
            </h2>
            <p className="mt-3 text-sm text-neutral-400">
              The same data feeding the EVO TV app, exposed as a clean REST + SSE API.
              Track 50+ teams across Free Fire, CoD Mobile, PUBG Mobile and EA FC Mobile.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {isPremium ? (
                <>
                  <Button asChild>
                    <Link href="/api-access/keys">
                      <KeyRound className="size-4" />
                      Generate a key
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/api-access/docs">
                      <Code2 className="size-4" />
                      Read the docs
                    </Link>
                  </Button>
                </>
              ) : (
                <Button asChild className="bg-amber-500 text-black hover:bg-amber-400">
                  <Link href="/upgrade">
                    <Sparkles className="size-4" />
                    Upgrade to unlock
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <pre className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-[12px] leading-relaxed text-neutral-300">
            <code>
              {`curl https://api.evo.tv/v1/streams \\
  -H "Authorization: Bearer evo_live_***"

# Response (truncated)
[
  {
    "id": "stream_lagos_final",
    "title": "EVO Lagos Invitational — Semi 1",
    "viewerCount": 18420,
    "isLive": true
  }
]`}
            </code>
          </pre>
        </div>
      </section>

      <section className="mt-8">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
          What you get
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4"
              >
                <div className="mb-2 flex items-center gap-2 text-sky-300">
                  <Icon className="size-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">{f.title}</span>
                </div>
                <p className="text-sm text-neutral-300">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {!isPremium ? (
        <div className="mt-10">
          <ApiPaywallCard />
        </div>
      ) : (
        <section className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-neutral-50">You're all set.</h3>
              <p className="mt-1 text-sm text-neutral-400">
                Premium is active. Generate your first key and start hitting <code className="rounded bg-neutral-800 px-1 py-0.5 text-xs">/v1/streams</code>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild>
                <Link href="/api-access/keys">
                  <Zap className="size-4" />
                  Manage keys
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/api-access/usage">
                  <Gauge className="size-4" />
                  Usage
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}
    </ApiAccessShell>
  );
}
