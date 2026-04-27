"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { SectionCard } from "./section-card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const OPTIONS = [
  { v: "system", label: "Match system", icon: Monitor },
  { v: "dark", label: "Dark", icon: Moon },
  { v: "light", label: "Light", icon: Sun },
];

export function AppearanceForm() {
  const { theme, setTheme } = useTheme();
  const value = theme ?? "system";
  return (
    <SectionCard title="Appearance" description="Pick your EVO TV theme.">
      <RadioGroup
        value={value}
        onValueChange={(v) => setTheme(v)}
        className="grid gap-3 sm:grid-cols-3"
      >
        {OPTIONS.map((o) => {
          const Icon = o.icon;
          return (
            <Label
              key={o.v}
              htmlFor={`theme-${o.v}`}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 transition hover:border-sky-500/40 has-[:checked]:border-sky-500/60 has-[:checked]:bg-sky-500/5"
            >
              <RadioGroupItem id={`theme-${o.v}`} value={o.v} />
              <Icon className="size-4 text-sky-400" />
              <span className="text-sm font-semibold">{o.label}</span>
            </Label>
          );
        })}
      </RadioGroup>
    </SectionCard>
  );
}
