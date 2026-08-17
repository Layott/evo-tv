"use client";

import * as React from "react";
import { Loader2 } from "@/components/icons";
import { cn } from "@/lib/utils";

export function PaystackButton({
  loading,
  disabled,
  children,
  onClick,
  type,
  className,
}: {
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#011B33] px-4 py-3 text-sm font-semibold text-[#00C3F7] transition hover:bg-[#011B33]/90 disabled:opacity-60",
        className
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      <span className="tracking-wide">{children}</span>
    </button>
  );
}

export function PaystackMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-[#011B33] px-2 py-1 text-xs font-bold tracking-wider text-[#00C3F7]",
        className
      )}
    >
      PAYSTACK
    </span>
  );
}
