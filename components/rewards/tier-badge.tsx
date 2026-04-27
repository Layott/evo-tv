"use client";

import { cn } from "@/lib/utils";
import type { Tier } from "@/lib/mock/rewards";
import { tierColor, tierTextColor } from "@/lib/mock/rewards";
import { Crown, Gem, Medal, Shield, Trophy } from "lucide-react";

const TIER_ICON: Record<Tier, React.ElementType> = {
  Bronze: Shield,
  Silver: Medal,
  Gold: Trophy,
  Platinum: Crown,
  Diamond: Gem,
};

interface TierBadgeProps {
  tier: Tier;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function TierBadge({ tier, size = "md", className }: TierBadgeProps) {
  const Icon = TIER_ICON[tier];
  const dim = size === "sm" ? "h-7 px-2.5 text-xs" : size === "lg" ? "h-12 px-5 text-base" : "h-9 px-3.5 text-sm";
  const iconSize = size === "sm" ? "size-3.5" : size === "lg" ? "size-5" : "size-4";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r font-semibold uppercase tracking-wider shadow-lg shadow-black/20",
        tierColor(tier),
        tierTextColor(tier),
        dim,
        className,
      )}
    >
      <Icon className={iconSize} />
      {tier}
    </span>
  );
}
