"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Loader2,
  PhoneCall,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useMockAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ProviderTile } from "@/components/payment-methods/provider-tile";
import {
  initMobileMoney,
  listPaymentProviders,
  pollAttempt,
  type PaymentAttempt,
  type PaymentProvider,
} from "@/lib/mock/payment-methods";
import { formatNgn } from "@/components/profile/ngn";

type Phase = "select" | "form" | "waiting" | "success" | "failed";

const DEFAULT_AMOUNT = 4_500;

export default function MobileMoneyCheckoutPage() {
  const router = useRouter();
  const { user } = useMockAuth();

  const [providers, setProviders] = React.useState<PaymentProvider[] | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [phone, setPhone] = React.useState("");
  const [forceFail, setForceFail] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("select");
  const [attempt, setAttempt] = React.useState<PaymentAttempt | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const amount = DEFAULT_AMOUNT;

  React.useEffect(() => {
    let cancelled = false;
    listPaymentProviders().then((list) => {
      if (cancelled) return;
      // mobile-money providers only on this page
      const mm = list.filter((p) => p.kind === "mobile-money");
      setProviders(mm);
      if (mm.length > 0) setSelectedId(mm[0]!.id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = React.useMemo(
    () => providers?.find((p) => p.id === selectedId) ?? null,
    [providers, selectedId]
  );

  // poll while waiting
  React.useEffect(() => {
    if (phase !== "waiting" || !attempt) return;
    let cancelled = false;
    const tick = async () => {
      const updated = await pollAttempt(attempt.ref);
      if (cancelled || !updated) return;
      setAttempt(updated);
      if (updated.status === "success") {
        setPhase("success");
        toast.success("Payment confirmed");
      } else if (updated.status === "failed") {
        setPhase("failed");
        toast.error(updated.failureReason ?? "Payment failed");
      }
    };
    const timer = window.setInterval(tick, 1_000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [phase, attempt]);

  const phoneOk = /^\+?[0-9 ()-]{8,}$/.test(phone.trim());

  async function startPayment() {
    if (!selected || !phoneOk) {
      toast.error("Enter a valid phone number");
      return;
    }
    setSubmitting(true);
    try {
      const a = await initMobileMoney(selected.id, phone.trim(), amount, {
        forceFail,
        userId: user?.id ?? "user_current",
      });
      setAttempt(a);
      setPhase("waiting");
      toast.message(`STK push sent to ${phone.trim()}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start payment";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setPhase("select");
    setAttempt(null);
  }

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
          <h1 className="text-xl font-bold text-neutral-50">
            Pay with Mobile Money
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Confirm your subscription with M-Pesa, MTN MoMo, or Airtel Money. We'll send a prompt
            to your phone.
          </p>
        </div>
        <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-300">
          Premium · {formatNgn(amount)}
        </Badge>
      </header>

      {phase === "select" || phase === "form" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
              <h2 className="mb-3 text-base font-semibold text-neutral-50">
                Choose a provider
              </h2>
              {providers === null ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      className="h-32 w-full rounded-2xl bg-neutral-800/60"
                    />
                  ))}
                </div>
              ) : providers.length === 0 ? (
                <p className="rounded-xl border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-500">
                  No mobile money providers available right now.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {providers.map((p) => (
                    <ProviderTile
                      key={p.id}
                      provider={p}
                      selected={p.id === selectedId}
                      onClick={() => setSelectedId(p.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
              <h2 className="mb-3 text-base font-semibold text-neutral-50">
                Phone number
              </h2>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Mobile number registered with the provider</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="+254 712 345 678"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-neutral-950"
                />
                {!phoneOk && phone.length > 0 ? (
                  <p className="text-xs text-red-400">Enter a valid phone number</p>
                ) : (
                  <p className="text-xs text-neutral-500">
                    We'll send an STK push prompt — approve it on your phone.
                  </p>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-neutral-100">Force-fail mode</p>
                  <p className="text-xs text-neutral-500">
                    Toggle on to simulate a customer cancellation. Useful for testing.
                  </p>
                </div>
                <Switch
                  checked={forceFail}
                  onCheckedChange={setForceFail}
                  aria-label="Force fail"
                />
              </div>
            </section>

            <Button
              onClick={startPayment}
              disabled={submitting || !selected || !phoneOk}
              size="lg"
              className="w-full bg-sky-500 text-black hover:bg-sky-500/90"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <PhoneCall className="size-4" />}
              {submitting
                ? "Sending prompt…"
                : selected
                ? `Send ${selected.name} request — ${formatNgn(amount)}`
                : "Send request"}
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-500">
              <ShieldCheck className="size-3.5 text-sky-400" />
              Your phone number is only used to send the STK push.
            </p>
          </div>

          <aside className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
            <h2 className="text-base font-semibold text-neutral-50">Order summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-400">Plan</dt>
                <dd className="text-neutral-100">EVO TV Premium</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-400">Subtotal</dt>
                <dd className="text-neutral-100">{formatNgn(amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-400">Provider fee</dt>
                <dd className="text-neutral-300">
                  {selected ? `₦${selected.feeNgn.toLocaleString()}` : "—"}
                </dd>
              </div>
              <div className="flex justify-between border-t border-neutral-800 pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd>{formatNgn(amount + (selected?.feeNgn ?? 0))}</dd>
              </div>
            </dl>
            <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-400">
              <p className="font-semibold text-neutral-200">How it works</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                <li>Pick a provider</li>
                <li>Enter your number</li>
                <li>Approve the STK push</li>
                <li>Premium unlocks instantly</li>
              </ol>
            </div>
          </aside>
        </div>
      ) : null}

      {phase === "waiting" && attempt && selected ? (
        <WaitingState
          attempt={attempt}
          provider={selected}
          phone={phone}
          onCancel={reset}
        />
      ) : null}

      {phase === "success" && attempt ? (
        <SuccessState attempt={attempt} onDone={() => router.push("/settings/billing")} />
      ) : null}

      {phase === "failed" && attempt ? (
        <FailedState attempt={attempt} onRetry={reset} />
      ) : null}
    </div>
  );
}

function WaitingState({
  attempt,
  provider,
  phone,
  onCancel,
}: {
  attempt: PaymentAttempt;
  provider: PaymentProvider;
  phone: string;
  onCancel: () => void;
}) {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    const start = new Date(attempt.createdAt).getTime();
    const tick = () => setElapsed(Math.max(0, Date.now() - start));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [attempt.createdAt]);
  const seconds = Math.floor(elapsed / 1000);
  const remainingSec = Math.max(0, Math.ceil((attempt.durationMs - elapsed) / 1000));

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900/40 p-8 text-center">
      <div
        className={`mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl ${provider.accent}`}
      >
        <Smartphone className="size-8 animate-pulse" />
      </div>
      <h2 className="text-xl font-bold text-neutral-50">Check your phone</h2>
      <p className="mt-1.5 text-sm text-neutral-400">
        We sent a {provider.name} prompt to <span className="text-neutral-200">{phone}</span>.
        Approve it within {remainingSec}s.
      </p>
      <div className="mx-auto mt-6 flex max-w-xs items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-left">
        <Loader2 className="size-5 shrink-0 animate-spin text-sky-400" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-neutral-100">Awaiting confirmation…</p>
          <p className="text-xs text-neutral-500">Elapsed {seconds}s · Ref {attempt.ref}</p>
        </div>
      </div>
      <Button
        variant="outline"
        className="mt-6 w-full border-neutral-800"
        onClick={onCancel}
      >
        Cancel and choose another method
      </Button>
    </div>
  );
}

function SuccessState({
  attempt,
  onDone,
}: {
  attempt: PaymentAttempt;
  onDone: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-neutral-900/40 to-neutral-900/40 p-8 text-center">
      <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40">
        <CheckCircle2 className="size-9" />
      </div>
      <h2 className="text-xl font-bold text-neutral-50">Payment confirmed</h2>
      <p className="mt-1.5 text-sm text-neutral-400">
        {attempt.providerLabel} approved your payment of{" "}
        <span className="text-neutral-200 font-semibold">{formatNgn(attempt.amountNgn)}</span>.
        Premium is now active.
      </p>
      <div className="mx-auto mt-5 max-w-sm rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-left">
        <p className="text-[11px] uppercase tracking-wider text-neutral-500">Reference</p>
        <div className="mt-1 flex items-center gap-2">
          <code className="flex-1 truncate font-mono text-sm text-neutral-100">
            {attempt.ref}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-neutral-800"
            onClick={() => {
              navigator.clipboard?.writeText(attempt.ref).then(() => {
                toast.success("Reference copied");
              });
            }}
          >
            <Copy className="size-3" />
          </Button>
        </div>
      </div>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Button asChild variant="outline" className="border-neutral-800">
          <Link href="/home">Back to home</Link>
        </Button>
        <Button
          className="bg-sky-500 text-black hover:bg-sky-500/90"
          onClick={onDone}
        >
          Open billing
        </Button>
      </div>
    </div>
  );
}

function FailedState({
  attempt,
  onRetry,
}: {
  attempt: PaymentAttempt;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/10 via-neutral-900/40 to-neutral-900/40 p-8 text-center">
      <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-red-500/15 text-red-300 ring-1 ring-red-500/40">
        <XCircle className="size-9" />
      </div>
      <h2 className="text-xl font-bold text-neutral-50">Payment did not complete</h2>
      <p className="mt-1.5 text-sm text-neutral-400">
        {attempt.failureReason ?? "The provider could not confirm the charge."} You haven't
        been billed.
      </p>
      <div className="mx-auto mt-5 max-w-sm rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-left">
        <p className="text-[11px] uppercase tracking-wider text-neutral-500">Reference</p>
        <code className="mt-1 block truncate font-mono text-sm text-neutral-100">
          {attempt.ref}
        </code>
      </div>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Button asChild variant="outline" className="border-neutral-800">
          <Link href="/upgrade">Choose another method</Link>
        </Button>
        <Button
          className="bg-sky-500 text-black hover:bg-sky-500/90"
          onClick={onRetry}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
