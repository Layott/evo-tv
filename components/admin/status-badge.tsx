"use client";

import { cn } from "@/lib/utils";

type Tone = "emerald" | "amber" | "red" | "blue" | "neutral" | "violet";

/**
 * Filled, not outlined.
 *
 * These were a 10% wash held together by a `ring-1` hairline, which is the
 * outlined-chip shape banned product-wide. The fill carries the badge on its
 * own now, so it is doubled and the text lightened a step to keep contrast.
 */
const tones: Record<Tone, string> = {
  emerald: "bg-sky-500/25 text-sky-100",
  amber: "bg-amber-500/25 text-amber-100",
  red: "bg-red-500/25 text-red-100",
  blue: "bg-blue-500/25 text-blue-100",
  neutral: "bg-muted/60 text-foreground/90",
  violet: "bg-violet-500/25 text-violet-100",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {dot ? (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            // Flat dot. It used to carry a 6px bloom of its own colour.
            tone === "emerald" && "bg-sky-400",
            tone === "amber" && "bg-amber-400",
            tone === "red" && "bg-red-400",
            tone === "blue" && "bg-blue-400",
            tone === "neutral" && "bg-muted-foreground",
            tone === "violet" && "bg-violet-400",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}
