"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Loader2,
  Phone,
  ShieldCheck,
  Timer,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  listUssdProviders,
  pollUssdSession,
  startUssdSession,
  type UssdProvider,
  type UssdSession,
} from "@/lib/mock/ussd";
import { formatNgn } from "@/components/profile/ngn";

const AMOUNT = 4_500;

export default function UssdPage() {
  const { user } = useAuth();
  const [providers, setProviders] = React.useState<UssdProvider[] | null>(null);
  const [providerId, setProviderId] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<UssdSession | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    listUssdProviders().then((list) => {
      if (cancelled) return;
      setProviders(list);
      if (list.length > 0) setProviderId(list[0]!.id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // poll every 5s
  React.useEffect(() => {
    if (!session || session.status !== "awaiting") return;
    let cancelled = false;
    let timer: number | null = null;

    async function tick() {
      const next = await pollUssdSession(session!.code);
      if (cancelled || !next) return;
      setSession(next);
      if (next.status === "confirmed") {
        toast.success("USSD payment confirmed");
        return;
      }
      if (next.status === "expired") {
        toast.error("Session expired — start a new one");
        return;
      }
      timer = window.setTimeout(tick, 5_000);
    }

    timer = window.setTimeout(tick, 5_000);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [session]);

  async function handleStart() {
    if (!providerId) return;
    setLoading(true);
    try {
      const s = await startUssdSession(
        providerId as UssdProvider["id"],
        AMOUNT,
        user?.id ?? "user_current"
      );
      setSession(s);
      toast.message(`Code generated. Dial ${s.shortCode} now.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start session");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setSession(null);
  }

  const selected = providers?.find((p) => p.id === providerId) ?? null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <Link
        href="/upgrade"
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200"
      >
        <ArrowLeft className="size-4" /> Back to upgrade
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-50">Pay by USSD</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Dial a short code on your phone, type your linking code, and your account upgrades
            automatically. No app or card required.
          </p>
        </div>
        <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-300">
          Premium · {formatNgn(AMOUNT)}
        </Badge>
      </header>

      {!session ? (
        <ProviderPicker
          providers={providers}
          selectedId={providerId}
          onSelect={setProviderId}
          onStart={handleStart}
          loading={loading}
          selected={selected}
        />
      ) : (
        <SessionPanel session={session} provider={selected} onReset={reset} />
      )}

      <FaqStrip />
    </div>
  );
}

function ProviderPicker({
  providers,
  selectedId,
  onSelect,
  onStart,
  loading,
  selected,
}: {
  providers: UssdProvider[] | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStart: () => void;
  loading: boolean;
  selected: UssdProvider | null;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
          <h2 className="mb-3 text-base font-semibold text-neutral-50">
            Pick your network
          </h2>
          {providers === null ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-24 w-full rounded-xl bg-neutral-800/60"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border bg-neutral-950 p-4 text-center transition",
                    p.id === selectedId
                      ? "border-sky-500/60 ring-1 ring-sky-500/40"
                      : "border-neutral-800 hover:border-neutral-700"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-lg text-sm font-bold tracking-tight",
                      p.accent
                    )}
                    aria-hidden
                  >
                    {p.name.slice(0, 1)}
                  </div>
                  <p className="text-sm font-semibold text-neutral-100">{p.name}</p>
                  <code className="font-mono text-[11px] text-neutral-400">
                    {p.shortCode}
                  </code>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
          <h2 className="mb-3 text-base font-semibold text-neutral-50">
            How it works
          </h2>
          <ol className="space-y-2 text-sm text-neutral-300">
            {(selected?.steps ?? [
              "Choose a network",
              "Generate a linking code",
              "Dial the short code",
              "Approve in the menu",
            ]).map((step, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-sky-300 ring-1 ring-neutral-800">
                  {idx + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <Button
          onClick={onStart}
          disabled={!selectedId || loading}
          size="lg"
          className="w-full bg-sky-500 text-black hover:bg-sky-500/90"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4" />}
          {loading ? "Starting…" : "Generate linking code"}
        </Button>
      </div>

      <aside className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
        <h2 className="text-base font-semibold text-neutral-50">Why USSD?</h2>
        <ul className="mt-3 space-y-2 text-sm text-neutral-300">
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sky-400" />
            <span>Works without internet</span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sky-400" />
            <span>Settle from your airtime balance</span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sky-400" />
            <span>One-time charge, no card needed</span>
          </li>
        </ul>
        <p className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-500">
          You'll only be charged once the menu confirms. The linking code expires after 15
          minutes.
        </p>
      </aside>
    </div>
  );
}

function SessionPanel({
  session,
  provider,
  onReset,
}: {
  session: UssdSession;
  provider: UssdProvider | null;
  onReset: () => void;
}) {
  if (session.status === "confirmed") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-neutral-900/40 to-neutral-900/40 p-8 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40">
          <CheckCircle2 className="size-9" />
        </div>
        <h2 className="text-xl font-bold text-neutral-50">Premium activated</h2>
        <p className="mt-1.5 text-sm text-neutral-400">
          {session.providerLabel} confirmed your payment of{" "}
          <span className="text-neutral-200">{formatNgn(session.amountNgn)}</span>.
        </p>
        <div className="mx-auto mt-5 max-w-xs rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-left text-xs">
          <p className="uppercase tracking-wider text-neutral-500">Linking code</p>
          <code className="mt-1 block font-mono text-base text-neutral-100">
            {session.code}
          </code>
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Button asChild variant="outline" className="border-neutral-800">
            <Link href="/home">Back to home</Link>
          </Button>
          <Button asChild className="bg-sky-500 text-black hover:bg-sky-500/90">
            <Link href="/settings/billing">Open billing</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (session.status === "expired") {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/10 via-neutral-900/40 to-neutral-900/40 p-8 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-red-500/15 text-red-300 ring-1 ring-red-500/40">
          <XCircle className="size-9" />
        </div>
        <h2 className="text-xl font-bold text-neutral-50">Session expired</h2>
        <p className="mt-1.5 text-sm text-neutral-400">
          The 15-minute window passed before we received the menu confirmation. Start a new
          session to try again.
        </p>
        <Button
          className="mt-5 w-full bg-sky-500 text-black hover:bg-sky-500/90"
          onClick={onReset}
        >
          Start new session
        </Button>
      </div>
    );
  }

  return <AwaitingPanel session={session} provider={provider} onReset={onReset} />;
}

function AwaitingPanel({
  session,
  provider,
  onReset,
}: {
  session: UssdSession;
  provider: UssdProvider | null;
  onReset: () => void;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);
  const expiresIn = Math.max(0, new Date(session.expiresAt).getTime() - now);
  const mm = Math.floor(expiresIn / 60_000)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor((expiresIn % 60_000) / 1_000)
    .toString()
    .padStart(2, "0");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-xl text-base font-extrabold",
                provider?.accent ?? "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30"
              )}
              aria-hidden
            >
              {session.providerLabel.slice(0, 1)}
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-neutral-500">Dial now</p>
              <p className="font-mono text-2xl font-bold text-neutral-50">
                {session.shortCode}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(session.shortCode).then(() =>
                  toast.success("Short code copied")
                );
              }}
              className="rounded-md border border-neutral-800 bg-neutral-950 p-2 text-neutral-400 hover:text-neutral-100"
              aria-label="Copy short code"
            >
              <Copy className="size-4" />
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-sky-500/40 bg-sky-500/5 p-5">
          <p className="text-xs uppercase tracking-wider text-sky-300">Your linking code</p>
          <div className="mt-2 flex items-center gap-3">
            <code className="font-mono text-4xl font-extrabold tracking-[0.4em] text-neutral-50">
              {session.code}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto border-neutral-800"
              onClick={() => {
                navigator.clipboard?.writeText(session.code).then(() =>
                  toast.success("Linking code copied")
                );
              }}
            >
              <Copy className="size-3" />
              Copy
            </Button>
          </div>
          <p className="mt-3 text-xs text-neutral-400">
            When the {session.providerLabel} menu asks for a code, type the digits above.
          </p>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
          <h3 className="mb-3 text-base font-semibold text-neutral-50">
            Step by step
          </h3>
          <ol className="space-y-2 text-sm text-neutral-300">
            {(provider?.steps ?? []).map((step, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-sky-300 ring-1 ring-neutral-800">
                  {idx + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <Button
          variant="outline"
          className="w-full border-neutral-800"
          onClick={onReset}
        >
          Cancel and pick another network
        </Button>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-50">
            <Loader2 className="size-4 animate-spin text-sky-400" />
            Checking…
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            We poll the network every 5s. As soon as the menu confirms, this page will update.
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-50">
            <Timer className="size-4 text-amber-300" />
            Expires in {mm}:{ss}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Linking codes are valid for 15 minutes.
          </p>
        </div>
      </aside>
    </div>
  );
}

function FaqStrip() {
  return (
    <section className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
      <h3 className="text-sm font-semibold text-neutral-50">Frequently asked</h3>
      <dl className="mt-3 grid gap-4 sm:grid-cols-2">
        <FaqItem q="Will I be charged airtime?" a="No. The amount is debited from your mobile money or airtime wallet, not your normal call balance." />
        <FaqItem q="What if my phone runs out of credit?" a="The session will expire and you can simply start a new one once you've topped up." />
        <FaqItem q="Do I need to be online?" a="No — USSD works on any phone, including feature phones, without an internet connection." />
        <FaqItem q="Can I refund?" a="Yes. Reach out to support and we'll reverse the charge directly to your mobile wallet." />
      </dl>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-neutral-100">{q}</dt>
      <dd className="mt-1 text-xs text-neutral-400">{a}</dd>
    </div>
  );
}
