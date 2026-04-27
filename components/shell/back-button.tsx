"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import * as React from "react";

interface Props {
  fallbackHref?: string;
  label?: string;
  className?: string;
}

/**
 * Reusable back button.
 * Uses browser history.back() where possible; falls back to `fallbackHref`
 * when there's no prior entry (fresh tab, deep link, modal close-all).
 */
export function BackButton({
  fallbackHref = "/home",
  label = "Back",
  className = "",
}: Props) {
  const router = useRouter();
  const handleClick = React.useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }, [router, fallbackHref]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:border-sky-500/60 hover:text-sky-300 ${className}`}
      aria-label="Go back"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}
