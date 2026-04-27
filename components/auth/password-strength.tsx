"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type PasswordStrength = "empty" | "weak" | "medium" | "strong";

export function scorePassword(password: string): PasswordStrength {
  if (!password) return "empty";
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 2) return "weak";
  if (score <= 3) return "medium";
  return "strong";
}

const LABELS: Record<PasswordStrength, string> = {
  empty: "Enter a password",
  weak: "Weak",
  medium: "Medium",
  strong: "Strong",
};

export function PasswordStrengthMeter({
  password,
  className,
}: {
  password: string;
  className?: string;
}) {
  const strength = scorePassword(password);
  const filled =
    strength === "strong" ? 3 : strength === "medium" ? 2 : strength === "weak" ? 1 : 0;

  return (
    <div className={cn("space-y-1.5", className)} aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < filled
                ? strength === "strong"
                  ? "bg-sky-500"
                  : strength === "medium"
                    ? "bg-amber-400"
                    : "bg-red-500"
                : "bg-neutral-800",
            )}
          />
        ))}
      </div>
      <p
        className={cn(
          "text-[11px] font-medium",
          strength === "strong"
            ? "text-sky-400"
            : strength === "medium"
              ? "text-amber-400"
              : strength === "weak"
                ? "text-red-400"
                : "text-neutral-500",
        )}
      >
        {LABELS[strength]}
      </p>
    </div>
  );
}
