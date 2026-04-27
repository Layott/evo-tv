"use client";

import Image from "next/image";
import { Coins, Lock, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Drop } from "@/lib/mock/rewards";

interface DropCardProps {
  drop: Drop;
  balance: number;
  onRedeem: (drop: Drop) => void;
  redeeming?: boolean;
  variant?: "grid" | "compact";
}

const RARITY_RING: Record<Drop["rarity"], string> = {
  common: "ring-1 ring-neutral-700",
  rare: "ring-1 ring-sky-500/40 hover:ring-sky-400/60",
  epic: "ring-1 ring-fuchsia-500/40 hover:ring-fuchsia-400/60",
  legendary: "ring-2 ring-amber-400/70 hover:ring-amber-300",
};

const RARITY_BADGE: Record<Drop["rarity"], string> = {
  common: "bg-neutral-700 text-neutral-100",
  rare: "bg-sky-500/20 text-sky-200 border border-sky-500/40",
  epic: "bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/40",
  legendary: "bg-amber-500 text-amber-950",
};

const KIND_LABEL: Record<Drop["kind"], string> = {
  cosmetic: "In-game",
  "premium-trial": "Premium Trial",
  "merch-voucher": "Voucher",
};

export function DropCard({ drop, balance, onRedeem, redeeming = false, variant = "grid" }: DropCardProps) {
  const canAfford = balance >= drop.cost;
  const inStock = drop.stock > 0;
  const compact = variant === "compact";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40 transition",
        RARITY_RING[drop.rarity],
        !inStock && "opacity-60",
      )}
    >
      <div className="relative aspect-[16/10] w-full bg-neutral-950">
        <Image src={drop.imageUrl} alt={drop.name} fill className="object-cover" />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", RARITY_BADGE[drop.rarity])}>
            {drop.rarity}
          </span>
          <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-200">
            {KIND_LABEL[drop.kind]}
          </span>
        </div>
        {!inStock ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-200">Sold out</Badge>
          </div>
        ) : null}
      </div>

      <div className={cn("space-y-2 p-3", compact ? "p-3" : "p-4")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-sm font-semibold text-neutral-100">{drop.name}</h3>
            <p className="text-[11px] text-neutral-500">by {drop.partner}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-amber-300">
              <Coins className="size-3.5" />
              <span className="text-sm font-bold tabular-nums">{drop.cost.toLocaleString()}</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-500">{drop.stock} left</div>
          </div>
        </div>

        {!compact ? <p className="line-clamp-2 text-xs text-neutral-400">{drop.description}</p> : null}

        <Button
          className={cn(
            "w-full",
            canAfford && inStock
              ? "bg-amber-500 text-amber-950 hover:bg-amber-400"
              : "border-neutral-800",
          )}
          variant={canAfford && inStock ? "default" : "outline"}
          disabled={!inStock || !canAfford || redeeming}
          onClick={() => onRedeem(drop)}
        >
          {redeeming ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : !inStock ? (
            "Sold out"
          ) : !canAfford ? (
            <>
              <Lock className="size-3.5" />
              Need {(drop.cost - balance).toLocaleString()} more
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" />
              Redeem
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
