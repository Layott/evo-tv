"use client";

import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import Link from "next/link";
import { Check, CreditCard, Crown, Phone, Sparkles, Star, Ticket, X } from "lucide-react";

import { listTiers, type Tier } from "@/lib/client";
import { BackButton } from "@/components/shell/back-button";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatNgn } from "@/components/profile/ngn";
import { PaystackMark } from "@/components/shop/paystack-button";

const FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Premium benefits continue through the end of your current billing period after cancelling.",
  },
  {
    q: "Which payment methods work?",
    a: "Any Nigerian card, bank transfer, USSD, or Opay via Paystack. We never store card details ourselves.",
  },
  {
    q: "Is the trial really free?",
    a: "Your first 7 days are free. You won't be billed until the trial ends and you can cancel any time before.",
  },
  {
    q: "Do I need Premium to chat?",
    a: "No. Chat is free on every stream. Premium gets you a badge, slower cooldowns, and custom emotes.",
  },
];

export default function UpgradePage() {
  // The tier ladder comes from /api/tiers now rather than a bundled constant.
  const { data: tiers = [] } = useQuery({
    queryKey: ["tiers"],
    queryFn: () => listTiers(),
  });
  const free = tiers.find((t: Tier) => t.id === "free");
  const premium = tiers.find((t: Tier) => t.id === "premium");

  // The ladder is fetched, so the first paint has neither tier yet.
  if (!free || !premium) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <div className="mb-4">
          <BackButton fallbackHref="/home" />
        </div>
        <p className="text-sm text-muted-foreground">Loading plans…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div className="mb-4">
        <BackButton fallbackHref="/home" />
      </div>
      <header className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300">
          <Sparkles className="size-3" /> EVO TV Premium
        </span>
        <h1 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl">
          Never miss a play. No ads. 1080p.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Upgrade once, watch every tournament across Africa in full fidelity - and grab exclusive film-room
          analysis from the casters you already trust.
        </p>
      </header>

      <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
        <TierCard tier={free} current />
        <TierCard tier={premium} highlight />
      </div>

      <div className="mx-auto mt-6 max-w-4xl text-center text-xs text-muted-foreground">
        Secure checkout via <PaystackMark className="align-middle" /> · Cancel anytime
      </div>

      <section className="mx-auto mt-12 max-w-4xl">
        <h2 className="mb-4 text-center text-lg font-semibold text-foreground">
          Choose how you want to pay
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <PaymentMethodCard
            href="/checkout?plan=premium"
            badge="Card"
            title="Paystack"
            subtitle="Visa, Mastercard, Verve, bank transfer."
            Icon={CreditCard}
            accent="bg-sky-500/15 text-sky-300 ring-sky-500/40"
            primary
          />
          <PaymentMethodCard
            href="/checkout/mobile-money"
            badge="Mobile money"
            title="M-Pesa, MoMo, Airtel"
            subtitle="STK push to your phone in seconds."
            Icon={Phone}
            accent="bg-emerald-500/15 text-emerald-300 ring-emerald-500/40"
          />
          <PaymentMethodCard
            href="/ussd"
            badge="USSD"
            title="Dial-to-pay"
            subtitle="No app needed. Works on any phone."
            Icon={Ticket}
            accent="bg-amber-500/15 text-amber-300 ring-amber-500/40"
          />
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-3xl">
        <h2 className="mb-4 text-center text-lg font-semibold text-foreground">Frequently asked</h2>
        <Accordion type="single" collapsible className="rounded-2xl border border-border bg-card/40 px-4">
          {FAQ.map((f, i) => (
            <AccordionItem key={f.q} value={`q-${i}`} className="border-border last:border-b-0">
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}

function PaymentMethodCard({
  href,
  badge,
  title,
  subtitle,
  Icon,
  accent,
  primary,
}: {
  href: string;
  badge: string;
  title: string;
  subtitle: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-3 rounded-2xl border bg-card/40 p-5 transition hover:border-sky-500/60 ${
        primary ? "border-sky-500/40" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${accent}`}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {badge}
          </span>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Premium · {formatNgn(4_500)}/mo</span>
        <span className="font-semibold text-sky-300 transition group-hover:translate-x-0.5">
          Continue →
        </span>
      </div>
    </Link>
  );
}

function TierCard({
  tier,
  current,
  highlight,
}: {
  tier: Tier;
  current?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl border p-6 ${
        highlight
          ? "border-sky-500/60 bg-gradient-to-br from-sky-500/10 via-card/60 to-amber-500/10"
          : "border-border bg-card/40"
      }`}
    >
      {highlight ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sky-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-black">
          Most popular
        </span>
      ) : null}
      <div className="flex items-center gap-2">
        {highlight ? (
          <Crown className="size-5 text-amber-400" />
        ) : (
          <Star className="size-5 text-muted-foreground" />
        )}
        <h3 className="text-xl font-bold text-foreground">{tier.name}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{tier.tagline}</p>
      <div className="mt-4">
        <span className="text-3xl font-extrabold text-foreground">
          {tier.priceNgn === 0 ? "Free" : formatNgn(tier.priceNgn)}
        </span>
        {tier.priceNgn > 0 ? (
          <span className="ml-1 text-sm text-muted-foreground">/month</span>
        ) : null}
      </div>
      <ul className="mt-5 flex-1 space-y-2">
        {tier.features.map((f: string) => (
          <li key={f} className="flex items-start gap-2 text-sm text-foreground">
            <Check
              className={`mt-0.5 size-4 shrink-0 ${highlight ? "text-sky-400" : "text-muted-foreground"}`}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        {current ? (
          <Button variant="outline" className="w-full border-border" disabled>
            <X className="size-4" /> {tier.cta}
          </Button>
        ) : (
          <Button
            asChild
            className="w-full bg-amber-500 text-black hover:bg-amber-500/90"
          >
            <Link href="/checkout?plan=premium">
              {tier.cta} - {formatNgn(tier.priceNgn)}/mo
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
