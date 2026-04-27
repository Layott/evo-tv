"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, CheckCircle2, Loader2, Mail, MessageCircle, Sparkles } from "lucide-react";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { getMyApplication, type CreatorApplication } from "@/lib/mock/creators";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { games } from "@/lib/mock/games";

export default function CreatorThanksPage() {
  const router = useRouter();
  const { user } = useMockAuth();
  const [app, setApp] = React.useState<CreatorApplication | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const a = await getMyApplication(user.id);
      if (cancelled) return;
      if (!a) {
        // No application — kick back to landing.
        router.replace("/creator-program");
        return;
      }
      setApp(a);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, router]);

  if (loading || !app) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  const gameName = games.find((g) => g.id === app.primaryGameId)?.shortName ?? app.primaryGameId;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <div className="mb-4 flex items-center gap-3">
        <Button asChild variant="outline" size="icon" className="size-8 border-neutral-800">
          <Link href="/creator-program">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold text-neutral-50">Application status</h1>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-neutral-900 to-neutral-950 p-8 text-center">
        <div className="pointer-events-none absolute -right-24 -top-24 size-48 rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="relative space-y-3">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40">
            <CheckCircle2 className="size-8 text-emerald-950" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-50">Thanks — we got it.</h2>
          <p className="mx-auto max-w-md text-sm text-neutral-300">
            Your application is in our review queue. Most decisions land within 5 working days.
          </p>
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-200">
            Status: {app.status === "submitted" ? "Submitted" : app.status.replace(/_/g, " ")}
          </Badge>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
        <h3 className="text-sm font-semibold text-neutral-100">Application snapshot</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <SnapRow label="Country">{app.country}</SnapRow>
          <SnapRow label="Primary game">{gameName}</SnapRow>
          <SnapRow label="Platform">{app.socialPlatform}</SnapRow>
          <SnapRow label="Handle">{app.socialHandle}</SnapRow>
          <SnapRow label="Followers">{app.followerCount.toLocaleString()}</SnapRow>
          <SnapRow label="Submitted">{new Date(app.submittedAt).toLocaleString()}</SnapRow>
        </dl>
        <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">Bio</div>
          <p className="mt-1 text-sm text-neutral-300">{app.bio}</p>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link
          href="/creator-dashboard"
          className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 transition hover:border-sky-500/40"
        >
          <BarChart3 className="size-6 text-sky-400" />
          <h4 className="mt-3 text-sm font-semibold text-neutral-100">Preview your dashboard</h4>
          <p className="mt-1 text-xs text-neutral-400">
            See what tips, payouts, and audience views will look like.
          </p>
        </Link>
        <a
          href="mailto:creators@evo.tv"
          className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 transition hover:border-sky-500/40"
        >
          <Mail className="size-6 text-amber-400" />
          <h4 className="mt-3 text-sm font-semibold text-neutral-100">Reach a manager</h4>
          <p className="mt-1 text-xs text-neutral-400">
            Email creators@evo.tv to fast-track or ask follow-up questions.
          </p>
        </a>
        <Link
          href="/discover"
          className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 transition hover:border-sky-500/40"
        >
          <Sparkles className="size-6 text-fuchsia-400" />
          <h4 className="mt-3 text-sm font-semibold text-neutral-100">Browse top creators</h4>
          <p className="mt-1 text-xs text-neutral-400">
            Get inspired by top-performing African creators while you wait.
          </p>
        </Link>
      </section>

      <p className="mt-6 text-center text-[11px] text-neutral-500">
        Need urgent help? Reach the on-duty manager via the{" "}
        <span className="text-neutral-300">
          <MessageCircle className="mr-0.5 inline size-3" /> Discord
        </span>{" "}
        creator channel.
      </p>
    </div>
  );
}

function SnapRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-0.5 text-sm text-neutral-200">{children}</div>
    </div>
  );
}
