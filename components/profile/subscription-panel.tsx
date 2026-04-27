"use client";

import * as React from "react";
import Link from "next/link";
import { Crown, Star } from "lucide-react";
import type { Subscription } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { formatNgn } from "./ngn";

interface Props {
  subscription: Subscription | null;
}

export function SubscriptionPanel({ subscription }: Props) {
  if (!subscription) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-neutral-900/40 p-6">
        <div className="flex items-start gap-3">
          <Crown className="mt-1 size-6 text-amber-400" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-neutral-50">
              Go Premium
            </h3>
            <p className="mt-1 text-sm text-neutral-300">
              Ad-free streams, 1080p HDR, early VOD access & premium film-room sessions.
            </p>
            <Button
              asChild
              className="mt-4 bg-amber-500 text-black hover:bg-amber-500/90"
            >
              <Link href="/upgrade">Upgrade — {formatNgn(4500)}/mo</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-neutral-900/40 p-6">
      <div className="flex items-start gap-3">
        <Star className="mt-1 size-6 text-amber-400" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-neutral-50">
              Premium active
            </h3>
            <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-300">
              {subscription.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-300">
            {formatNgn(subscription.priceNgn)}/mo — renews{" "}
            {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-neutral-700">
              <Link href="/settings/billing">Manage billing</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
