"use client";

import * as React from "react";
import { Check } from "lucide-react";
import type { PaymentProvider } from "@/lib/mock/payment-methods";
import { cn } from "@/lib/utils";

const COUNTRY_NAMES: Record<string, string> = {
  NG: "Nigeria",
  KE: "Kenya",
  TZ: "Tanzania",
  UG: "Uganda",
  GH: "Ghana",
  CI: "Côte d'Ivoire",
  CM: "Cameroon",
  RW: "Rwanda",
  MW: "Malawi",
  ZA: "South Africa",
};

export function ProviderTile({
  provider,
  selected,
  onClick,
}: {
  provider: PaymentProvider;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group relative flex w-full flex-col gap-3 rounded-2xl border bg-neutral-900/40 p-4 text-left transition",
        selected
          ? "border-sky-500/60 bg-sky-500/10 shadow-[0_0_0_1px_rgb(56_189_248/0.4)]"
          : "border-neutral-800 hover:border-neutral-700"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-extrabold tracking-tight",
            provider.accent
          )}
          aria-hidden
        >
          {provider.logo}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-neutral-50">
              {provider.name}
            </p>
            {selected ? (
              <span
                aria-hidden
                className="inline-flex size-5 items-center justify-center rounded-full bg-sky-500 text-black"
              >
                <Check className="size-3" />
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-neutral-400">
            {provider.description}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {provider.countries.map((c) => (
          <span
            key={c}
            className="rounded-full border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400"
            title={COUNTRY_NAMES[c] ?? c}
          >
            {c}
          </span>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-3 border-t border-neutral-800/60 pt-2 text-[11px] text-neutral-500">
        <span>Fee ₦{provider.feeNgn.toLocaleString()}</span>
        <span>·</span>
        <span>~{provider.etaSeconds}s confirm</span>
      </div>
    </button>
  );
}
