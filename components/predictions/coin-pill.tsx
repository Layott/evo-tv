import { Coins } from "lucide-react";

export function CoinPill({
  coins,
  className = "",
  tone = "default",
}: {
  coins: number;
  className?: string;
  tone?: "default" | "amber" | "muted";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
      : tone === "muted"
        ? "border-neutral-800 bg-neutral-900/60 text-neutral-300"
        : "border-amber-500/30 bg-amber-500/5 text-amber-200";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums ${toneClass} ${className}`}
    >
      <Coins className="h-3.5 w-3.5" />
      {coins.toLocaleString()}
    </span>
  );
}

export function formatCoins(n: number): string {
  return `${n.toLocaleString()} EVO Coins`;
}
