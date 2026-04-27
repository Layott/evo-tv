"use client";

import * as React from "react";
import { Handshake, Info, ShieldCheck } from "lucide-react";
import { listPartners, type Partner } from "@/lib/mock/partners";
import { PartnerCard } from "@/components/partners/partner-card";

export default function PartnersPage() {
  const [partners, setPartners] = React.useState<Partner[] | null>(null);
  const [filter, setFilter] = React.useState<"all" | "betting" | "sponsor">("all");

  React.useEffect(() => {
    listPartners().then(setPartners);
  }, []);

  const filtered = React.useMemo(() => {
    if (!partners) return [];
    if (filter === "all") return partners;
    return partners.filter((p) => p.kind === filter);
  }, [partners, filter]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <header className="mb-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">
          <Handshake className="size-3" />
          Partner showcase
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-neutral-50 sm:text-3xl">
          The brands behind African esports.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-400">
          Meet the partners powering EVO TV. Visit their sites to learn more — wagers are not
          placed or facilitated through this platform.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(["all", "betting", "sponsor"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filter === f
                ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
                : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700"
            }`}
          >
            {f === "all" ? "All partners" : f === "betting" ? "Betting partners" : "Sponsors"}
          </button>
        ))}
      </div>

      {partners === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-neutral-900/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-10 text-center text-sm text-neutral-500">
          No partners under this filter yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <PartnerCard key={p.id} partner={p} />
          ))}
        </div>
      )}

      <section className="mt-10 grid gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 sm:grid-cols-[auto_1fr]">
        <div className="flex size-12 items-center justify-center rounded-full bg-sky-500/10 text-sky-300">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-neutral-50">Responsible viewing</h3>
          <p className="mt-1 text-sm text-neutral-400">
            EVO TV showcases partners for transparency. All odds, brand pages, and visuals are for
            entertainment only — EVO TV does not collect, hold, or place wagers on behalf of viewers.
            For support with problem gambling, contact local helplines such as <span className="text-neutral-200">Be Gamble Aware (Africa)</span>.
          </p>
        </div>
      </section>

      <div className="mt-6 flex items-start gap-2 rounded-lg border border-neutral-800 bg-neutral-950/60 p-4 text-xs text-neutral-400">
        <Info className="mt-0.5 size-3.5 shrink-0 text-neutral-500" />
        <span>
          Odds shown across the platform reflect partner-published prices for entertainment only.
          Numbers may shift in real-time and EVO TV is not the source of truth for wager settlement.
        </span>
      </div>
    </div>
  );
}
