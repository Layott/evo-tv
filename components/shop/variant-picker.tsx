"use client";

import * as React from "react";
import type { ProductVariant } from "@/lib/types";
import { cn } from "@/lib/utils";

export function VariantPicker({
  variants,
  value,
  onChange,
}: {
  variants: ProductVariant[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  if (!variants.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-muted-foreground">
        Size
      </p>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const selected = v.id === value;
          const oos = v.inventory <= 0;
          return (
            <button
              key={v.id}
              type="button"
              disabled={oos}
              onClick={() => onChange(v.id)}
              className={cn(
                "min-w-[3rem] rounded-lg border px-3 py-2 text-sm font-semibold transition",
                selected
                  ? "bg-sky-500/25 text-sky-100"
                  : "border-border bg-card text-foreground hover:bg-card",
                oos ? "cursor-not-allowed opacity-40 line-through" : ""
              )}
              aria-pressed={selected}
            >
              {v.label}
            </button>
          );
        })}
      </div>
      {value ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {variants.find((v) => v.id === value)?.inventory ?? 0} in stock
        </p>
      ) : null}
    </div>
  );
}
