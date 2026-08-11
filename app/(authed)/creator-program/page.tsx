"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Coins,
  Loader2,
  Mic2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/providers";
import { getMyApplication, type CreatorApplication } from "@/lib/mock/creators";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgramPitch } from "@/components/creators/program-pitch";

const ELIGIBILITY = [
  { label: "1,000+ followers across any platform", met: true },
  { label: "100+ hours streamed in the past 90 days", met: true },
  { label: "No active community guidelines strikes", met: true },
  { label: "Government-issued ID for payouts", met: false },
];

export default function CreatorProgramPage() {
  const { user } = useAuth();
  const [application, setApplication] = React.useState<CreatorApplication | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const app = await getMyApplication(user.id);
      if (!cancelled) {
        setApplication(app);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-950 to-sky-950/40 p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-32 -top-32 size-72 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-32 size-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="relative max-w-3xl space-y-4">
          <Badge className="bg-amber-500 text-amber-950">
            <Sparkles className="size-3" /> EVO Creator Program
          </Badge>
          <h1 className="text-3xl font-bold leading-tight text-neutral-50 sm:text-4xl md:text-5xl">
            Stream to Africa.
            <br />
            <span className="bg-gradient-to-r from-amber-300 via-pink-300 to-fuchsia-300 bg-clip-text text-transparent">
              Get paid for it.
            </span>
          </h1>
          <p className="max-w-xl text-sm text-neutral-300 sm:text-base">
            Join the official EVO TV creator program — keep 70% of your tips and subs, get auto-clipped highlights,
            and stream natively from your laptop or mobile.
          </p>
          <div className="flex flex-wrap gap-3">
            {application ? (
              <Button asChild size="lg" className="bg-sky-600 hover:bg-sky-500">
                <Link href="/creator-program/thanks">
                  <CheckCircle2 className="size-4" />
                  View application status
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="bg-amber-500 text-amber-950 hover:bg-amber-400">
                <Link href="/creator-program/apply">
                  <Mic2 className="size-4" />
                  Apply now
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="lg" className="border-neutral-700 bg-neutral-900/60">
              <Link href="/creator-dashboard">
                Preview dashboard
              </Link>
            </Button>
          </div>
          <div className="flex flex-wrap gap-4 pt-2 text-xs text-neutral-400">
            <span className="flex items-center gap-1">
              <Coins className="size-3.5 text-amber-400" /> 70/30 revenue split
            </span>
            <span>· 5,300+ creators across Africa</span>
            <span>· Free verification badge</span>
          </div>
        </div>
      </section>

      {/* What's offered */}
      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-bold text-neutral-100">What you get</h2>
        <ProgramPitch />
      </section>

      {/* Splits */}
      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
          <h3 className="text-base font-semibold text-neutral-100">How splits work</h3>
          <p className="mt-1 text-xs text-neutral-400">Every tip and sub is split between you and EVO TV.</p>
          <div className="mt-5 overflow-hidden rounded-xl border border-neutral-800">
            <div className="grid grid-cols-[3fr_1fr] text-sm">
              <div className="border-r border-neutral-800 bg-emerald-500/15 px-4 py-3">
                <div className="text-[10px] uppercase tracking-wider text-emerald-300">Creator</div>
                <div className="mt-0.5 text-2xl font-bold text-emerald-100">70%</div>
              </div>
              <div className="bg-neutral-900 px-4 py-3 text-right">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">EVO TV</div>
                <div className="mt-0.5 text-2xl font-bold text-neutral-300">30%</div>
              </div>
            </div>
            <div className="border-t border-neutral-800 bg-neutral-950 px-4 py-3 text-xs text-neutral-400">
              EVO&apos;s 30% covers hosting, CDN, payment fees, support, and creator marketing.
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
          <h3 className="text-base font-semibold text-neutral-100">Eligibility</h3>
          <p className="mt-1 text-xs text-neutral-400">You meet the bar if all of the below check out.</p>
          <ul className="mt-5 space-y-2.5 text-sm">
            {ELIGIBILITY.map((e) => (
              <li key={e.label} className="flex items-start gap-2.5">
                <CheckCircle2
                  className={
                    "mt-0.5 size-4 shrink-0 " + (e.met ? "text-emerald-400" : "text-neutral-600")
                  }
                />
                <span className={e.met ? "text-neutral-200" : "text-neutral-500"}>{e.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-neutral-500">
            ID verification happens after you submit your application. We never charge to apply.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-10 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-pink-500/10 to-fuchsia-500/10 p-8 text-center">
        <h3 className="text-xl font-bold text-neutral-50">Ready to make EVO your home?</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-300">
          Applications are reviewed within 5 working days. Approved creators are onboarded by a regional manager.
        </p>
        {application ? (
          <Button asChild size="lg" className="mt-5 bg-sky-600 hover:bg-sky-500">
            <Link href="/creator-program/thanks">View status</Link>
          </Button>
        ) : (
          <Button asChild size="lg" className="mt-5 bg-amber-500 text-amber-950 hover:bg-amber-400">
            <Link href="/creator-program/apply">
              Apply to the creator program
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        )}
      </section>
    </div>
  );
}
