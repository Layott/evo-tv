"use client";

import { cn } from "@/lib/utils";

type Tone = "emerald" | "amber" | "red" | "blue" | "neutral" | "violet";

const tones: Record<Tone, string> = {
  emerald: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
  amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  red: "bg-red-500/10 text-red-300 ring-red-500/30",
  blue: "bg-blue-500/10 text-blue-300 ring-blue-500/30",
  neutral: "bg-neutral-700/40 text-neutral-300 ring-neutral-600/50",
  violet: "bg-violet-500/10 text-violet-300 ring-violet-500/30",
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
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {dot ? (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "emerald" && "bg-sky-400 shadow-[0_0_6px_currentColor]",
            tone === "amber" && "bg-amber-400",
            tone === "red" && "bg-red-400",
            tone === "blue" && "bg-blue-400",
            tone === "neutral" && "bg-neutral-400",
            tone === "violet" && "bg-violet-400",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}
