"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, X, Check } from "@/components/icons";
import * as React from "react";

interface Props {
  open: boolean;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
  /** Which content kind is being gated (affects copy). */
  kind?: "stream" | "vod" | "clip" | "generic";
}

const PERKS = [
  "Ad-free playback across all streams",
  "1080p + HDR on supported devices",
  "Premium film-room analysis streams",
  "24h early VOD access",
  "Exclusive merch discounts",
  "Premium badge in chat",
];

export function PremiumPaywallModal({
  open,
  onClose,
  title,
  subtitle,
  kind = "stream",
}: Props) {
  const router = useRouter();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const heading = title ?? "Premium content";
  const line =
    subtitle ??
    (kind === "stream"
      ? "This stream is for Premium subscribers. Upgrade to watch ad-free and unlock exclusive competitive analysis."
      : kind === "vod"
      ? "This VOD is exclusive to Premium subscribers. Upgrade for 24h early access and ad-free replays."
      : kind === "clip"
      ? "This clip is Premium-only. Upgrade to watch."
      : "This content is reserved for Premium subscribers.");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-heading"
      className="fixed inset-0 z-[120] flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label="Close paywall"
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      {/* Elevation is neutral black, not a sky-blue bloom, and the panel is a
          filled surface rather than a tinted outline. */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-gradient-to-b from-[#0b1020] to-[#05091a] shadow-2xl shadow-black/50">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full bg-card/70 p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-sky-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="relative p-6 pb-4">
          {/* The blurred sky-blue orb that used to sit behind the lock is gone.
              The icon tile carries the accent as a fill instead. */}
          <div className="relative mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/25 text-sky-100">
            <Lock className="h-5 w-5" />
          </div>
          <div className="text-center">
            <div className="mb-1 text-xs font-semibold text-amber-300">
              Premium · ₦4,500/mo
            </div>
            <h2 id="paywall-heading" className="text-xl font-semibold tracking-tight text-foreground">
              {heading}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{line}</p>
          </div>
        </div>

        <ul className="space-y-2 px-6 pb-5 text-sm">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-2 text-foreground/80">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
              <span>{p}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 bg-background/60 p-5 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              onClose?.();
              router.push("/upgrade");
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
          >
            Upgrade with Paystack
          </button>
          <Link
            href="/discover"
            onClick={onClose}
            className="flex flex-1 items-center justify-center rounded-full px-4 py-2.5 text-sm text-foreground/80 transition-colors hover:bg-card hover:text-foreground"
          >
            Browse free content
          </Link>
        </div>
      </div>
    </div>
  );
}
