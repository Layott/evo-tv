"use client";

import * as React from "react";
import { Minus, Plus } from "@/components/icons";
import { Button } from "@/components/ui/button";

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-card">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="Decrease quantity"
      >
        <Minus className="size-4" />
      </Button>
      <span className="min-w-[2.5rem] text-center text-sm font-semibold">
        {value}
      </span>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Increase quantity"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
