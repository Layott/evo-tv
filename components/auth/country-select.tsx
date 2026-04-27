"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const AFRICAN_COUNTRIES = [
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "KE", name: "Kenya" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "MA", name: "Morocco" },
  { code: "SN", name: "Senegal" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "CM", name: "Cameroon" },
  { code: "TZ", name: "Tanzania" },
  { code: "ET", name: "Ethiopia" },
  { code: "UG", name: "Uganda" },
  { code: "RW", name: "Rwanda" },
] as const;

export type CountryCode = (typeof AFRICAN_COUNTRIES)[number]["code"];

export function CountrySelect({
  value,
  onValueChange,
  id,
  "aria-invalid": ariaInvalid,
}: {
  value: string;
  onValueChange: (v: string) => void;
  id?: string;
  "aria-invalid"?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        id={id}
        aria-invalid={ariaInvalid}
        className="w-full border-neutral-800 bg-neutral-900/50 text-neutral-100"
      >
        <SelectValue placeholder="Select country" />
      </SelectTrigger>
      <SelectContent>
        {AFRICAN_COUNTRIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            <span className="text-xs font-mono text-neutral-400">{c.code}</span>
            <span>{c.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
