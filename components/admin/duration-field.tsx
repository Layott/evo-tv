"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * A length, picked rather than typed.
 *
 * Every duration on these forms was a text box labelled "Length, minutes",
 * which asks an operator to do arithmetic before they can describe a 1h 42m
 * film, and accepts "1.42", "102 min" and "an hour" equally happily. Three
 * pickers say what the number means and cannot be given a value that is not a
 * length.
 *
 * Seconds are optional: a programme is scheduled in minutes and a clip is not.
 * The value crossing the boundary is always **seconds**, so a caller that
 * stores minutes converts once, where that is its business.
 */
export interface DurationFieldProps {
  id?: string;
  label: string;
  /** Total length in seconds. */
  value: number;
  onChange: (seconds: number) => void;
  /** Hide the seconds picker for things measured in whole minutes. */
  showSeconds?: boolean;
  hint?: string;
  maxHours?: number;
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

export function DurationField({
  id,
  label,
  value,
  onChange,
  showSeconds = true,
  hint,
  maxHours = 12,
}: DurationFieldProps) {
  const total = Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const set = (h: number, m: number, s: number) => onChange(h * 3600 + m * 60 + s);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-end gap-2">
        <Part
          id={id}
          unit="hr"
          value={hours}
          options={range(maxHours + 1)}
          onChange={(v) => set(v, minutes, seconds)}
        />
        <Part
          unit="min"
          value={minutes}
          options={range(60)}
          onChange={(v) => set(hours, v, seconds)}
        />
        {showSeconds ? (
          <Part
            unit="sec"
            value={seconds}
            options={range(60)}
            onChange={(v) => set(hours, minutes, v)}
          />
        ) : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Part({
  id,
  unit,
  value,
  options,
  onChange,
}: {
  id?: string;
  unit: string;
  value: number;
  options: number[];
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex-1 space-y-1">
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger id={id} className="w-full bg-card">
          <SelectValue />
        </SelectTrigger>
        {/* Long lists on purpose: 60 minutes is a scroll, and a picker that
            jumps in fives cannot describe a 47 minute episode. */}
        <SelectContent className="max-h-64">
          {options.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="block text-center text-xs text-muted-foreground">
        {unit}
      </span>
    </div>
  );
}

export default DurationField;
