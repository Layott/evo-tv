"use client";

import * as React from "react";
import { ExternalLink, Star } from "lucide-react";
import { toast } from "sonner";
import type { Partner } from "@/lib/mock/partners";
import { Button } from "@/components/ui/button";

export function PartnerCard({ partner }: { partner: Partner }) {
  function handleVisit() {
    toast.message(
      `Opening ${partner.name} (showcase only — wagers are not facilitated by EVO TV).`,
    );
  }

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 transition hover:border-neutral-700">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px opacity-30 transition group-hover:opacity-60"
        style={{
          background: `radial-gradient(120% 120% at 0% 0%, ${partner.brandColor}33, transparent 50%)`,
        }}
      />
      <div className="relative flex items-center gap-3">
        <div
          className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl ring-1 ring-inset"
          style={{ borderColor: `${partner.brandColor}55` }}
        >
          <img src={partner.logoUrl} alt={partner.name} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-neutral-50">{partner.name}</h3>
          <p className="truncate text-xs text-neutral-400">{partner.tagline}</p>
        </div>
        <span
          className="rounded-full border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-300"
          style={{ borderColor: `${partner.brandColor}55`, color: partner.brandColor }}
        >
          {partner.country}
        </span>
      </div>

      <p className="relative mt-3 line-clamp-3 text-sm text-neutral-300">{partner.blurb}</p>

      <div className="relative mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-amber-300">
          <Star className="size-3 fill-current" />
          <span className="font-semibold tabular-nums text-neutral-200">
            {partner.rating.toFixed(1)}
          </span>
          <span className="text-neutral-500">/ 5</span>
        </div>
        <Button size="sm" variant="outline" onClick={handleVisit}>
          {partner.ctaLabel}
          <ExternalLink className="size-3" />
        </Button>
      </div>

      <div className="relative mt-3 flex flex-wrap gap-1.5">
        {partner.slotPlacements.map((slot) => (
          <span
            key={slot}
            className="rounded-full bg-neutral-800/80 px-2 py-0.5 text-[10px] text-neutral-300"
          >
            {slot}
          </span>
        ))}
      </div>
    </article>
  );
}
