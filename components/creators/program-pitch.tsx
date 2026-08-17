"use client";

import { Coins, Sparkles, Users, BarChart3, Mic2, Trophy } from "lucide-react";

const FEATURES = [
  {
    icon: Coins,
    title: "70/30 revenue split",
    body: "Keep 70% of all tips and subs you earn on EVO TV. We handle hosting, CDN, and chat moderation.",
  },
  {
    icon: BarChart3,
    title: "Creator dashboard",
    body: "Real-time tips, follower growth, peak concurrent viewers, audience demographics, and payouts.",
  },
  {
    icon: Sparkles,
    title: "Auto-clipper",
    body: "Our highlight engine automatically queues your best moments - approve and publish in two taps.",
  },
  {
    icon: Mic2,
    title: "Featured slots",
    body: "Eligible streams get rotated through the EVO TV homepage and pre-roll slots for free.",
  },
  {
    icon: Users,
    title: "Audience tools",
    body: "Verified badges, subscriber-only chat, custom emote slots, and polls baked into every stream.",
  },
  {
    icon: Trophy,
    title: "Africa-first programs",
    body: "Dedicated regional managers, partner integrations (Glo, DStv), and quarterly creator summits.",
  },
];

export function ProgramPitch() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f) => (
        <div
          key={f.title}
          className="rounded-xl border border-border bg-card/40 p-4 transition hover:border-sky-500/40"
        >
          <div className="flex size-10 items-center justify-center rounded-lg bg-sky-500/25 text-sky-100">
            <f.icon className="size-5" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">{f.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{f.body}</p>
        </div>
      ))}
    </div>
  );
}
