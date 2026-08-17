"use client";

import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import Link from "next/link";

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

/**
 * Upgrade.
 *
 * Rewritten because the old page had three problems, and only one of them was
 * the look.
 *
 * **It hid half the product.** `/api/tiers` returns four tiers. This page
 * picked out `free` and `premium` by id and rendered those two, so Supporter
 * at 1,500 and Pro at 12,000 did not exist on the website at all, while the
 * app listed them. Anyone who wanted the cheap tier could not find it.
 *
 * **Every button bought Premium.** The CTA linked to a hardcoded
 * `/checkout?plan=premium` regardless of which tier's card it sat in, so the
 * moment a second paid tier appeared it would have charged the wrong price.
 *
 * **The shape was the banned one.** Columns side by side with a "Most popular"
 * flag on the middle one. The flag also claimed a fact nobody has measured:
 * there is no data on which plan sells.
 *
 * The page is ordered by who is reading it instead. Free is a line, because it
 * is the state you are in rather than a product on sale. Supporter and Premium
 * are the viewer's decision, as full-width rows. Pro is a creator buying
 * analytics, an ingest slot and API access - a different person at eight times
 * the price - so it gets its own section rather than a column asking a viewer
 * to rule it out.
 */

const FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Your benefits continue to the end of the period you have paid for, and nothing renews after that.",
  },
  {
    q: "Which payment methods work?",
    a: "Card and bank transfer through Paystack. Card details never touch EVO TV's servers.",
  },
  {
    q: "What happens to my account if I stop paying?",
    a: "Nothing is deleted. You drop back to Free, keep your follows, watch history and profile, and the ads come back.",
  },
  {
    q: "Do I need to pay to chat?",
    a: "No. Chat is free on every stream. Paid plans add a badge and access to premium-only rooms.",
  },
];

export default function UpgradePage() {
  const { data: tiers = [], isPending, isError, refetch } = useQuery({
    queryKey: ["tiers"],
    queryFn: () => listTiers(),
  });

  const free = tiers.find((t: Tier) => t.id === "free");
  // Split by who the plan is for, not by price, so a new middle tier lands in
  // the right section without a code change.
  const viewerPlans = tiers.filter((t: Tier) => t.priceNgn > 0 && t.id !== "pro");
  const creatorPlan = tiers.find((t: Tier) => t.id === "pro");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-6">
        <BackButton fallbackHref="/home" />
      </div>

      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
          Watch without the ads
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Every stream, show and VOD is free to watch. Paying removes the ads,
          opens the premium chat rooms, and gets you VOD drops before they go out
          to everyone.
        </p>
      </header>

      {/* `isPending` first. `isLoading` is `isPending && isFetching` in React
          Query v5, so between two retries of a failing request isLoading,
          isError and data are all falsy at once and a naive three-way branch
          renders a page with a heading and nothing under it. */}
      {isPending ? (
        <div className="mt-10 space-y-3" aria-busy="true">
          <div className="h-4 w-40 rounded bg-card" />
          <div className="h-36 rounded-2xl bg-card" />
          <div className="h-44 rounded-2xl bg-card" />
        </div>
      ) : isError || viewerPlans.length === 0 ? (
        <div className="mt-10 max-w-md">
          <h2 className="text-base font-semibold text-foreground">
            Plans are not loading
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            We could not reach the server. Everything on EVO TV is still free to
            watch while this is down.
          </p>
          <Button
            className="mt-4 bg-accent text-foreground hover:bg-accent/80"
            onClick={() => refetch()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          {free ? (
            <div className="mt-10">
              <p className="text-xs text-muted-foreground">
                You are on {free.name}
              </p>
              <p className="mt-1 text-sm text-foreground">{free.tagline}</p>
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            {viewerPlans.map((t: Tier) => (
              <PlanRow key={t.id} tier={t} emphasis={t.id === "premium"} />
            ))}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            <PaystackMark className="align-middle" /> handles the payment. Cancel
            any time.
          </p>

          {creatorPlan ? (
            <section className="mt-16">
              <h2 className="text-lg font-semibold text-foreground">
                Streaming on EVO TV?
              </h2>
              <p className="mt-1 mb-4 text-sm leading-relaxed text-muted-foreground">
                {creatorPlan.tagline}
              </p>
              <PlanRow tier={creatorPlan} />
            </section>
          ) : null}
        </>
      )}

      <section className="mt-16">
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Frequently asked
        </h2>
        <Accordion type="single" collapsible className="rounded-2xl bg-card/40 px-4">
          {FAQ.map((f, i) => (
            <AccordionItem key={f.q} value={`q-${i}`} className="border-none">
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}

/**
 * One plan, full width.
 *
 * `emphasis` fills the surface a step brighter for the plan the page actually
 * recommends. A fill, not a badge and not a ring: the old card carried a "Most
 * popular" flag, which is a claim, and this is a design decision.
 */
function PlanRow({ tier, emphasis }: { tier: Tier; emphasis?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-5 sm:p-6 ${emphasis ? "bg-sky-500/15" : "bg-card/40"}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-lg font-bold text-foreground">{tier.name}</h3>
        <p className="text-2xl font-bold text-foreground">
          {formatNgn(tier.priceNgn)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            /month
          </span>
        </p>
      </div>

      <ul className="mt-3 space-y-1.5">
        {tier.features.map((f: string) => (
          <li key={f} className="text-sm leading-relaxed text-muted-foreground">
            {f}
          </li>
        ))}
      </ul>

      <Button
        asChild
        className={`mt-5 w-full sm:w-auto ${
          emphasis
            ? "bg-sky-500 text-ink hover:bg-sky-400"
            : "bg-accent text-foreground hover:bg-accent/80"
        }`}
      >
        {/* The plan the button sits in, not a hardcoded one. This used to read
            `?plan=premium` on every card. */}
        <Link href={`/checkout?plan=${tier.id}`}>{tier.cta}</Link>
      </Button>
    </div>
  );
}


