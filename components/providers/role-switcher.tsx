"use client";

import * as React from "react";
import { useMockAuth } from "./mock-auth-provider";
import type { Role } from "@/lib/types";
import { ChevronDown, UserRound, Shield, Star, UserPlus } from "lucide-react";

const roles: { value: Role; label: string; icon: React.ReactNode }[] = [
  { value: "guest", label: "Guest", icon: <UserPlus className="h-3.5 w-3.5" /> },
  { value: "user", label: "User", icon: <UserRound className="h-3.5 w-3.5" /> },
  { value: "premium", label: "Premium", icon: <Star className="h-3.5 w-3.5" /> },
  { value: "admin", label: "Admin", icon: <Shield className="h-3.5 w-3.5" /> },
];

export function RoleSwitcher() {
  const { role, login, logout } = useMockAuth();
  const [open, setOpen] = React.useState(false);
  const current = roles.find((r) => r.value === role) ?? roles[0]!;

  return (
    <div className="fixed bottom-4 right-4 z-[100] font-sans">
      {open && (
        <div className="mb-2 w-44 rounded-lg border border-neutral-800 bg-neutral-950/95 shadow-xl backdrop-blur">
          <div className="border-b border-neutral-800 px-3 py-2 text-[10px] uppercase tracking-wider text-neutral-500">
            Dev role switcher
          </div>
          {roles.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => {
                if (r.value === "guest") logout();
                else login(r.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-neutral-800 ${
                r.value === role ? "text-sky-400" : "text-neutral-200"
              }`}
            >
              {r.icon}
              <span>{r.label}</span>
              {r.value === role && <span className="ml-auto text-[10px]">active</span>}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-950/90 px-3 py-1.5 text-xs text-neutral-200 shadow-lg backdrop-blur hover:border-neutral-500"
      >
        {current.icon}
        <span className="font-medium">{current.label}</span>
        <ChevronDown className="h-3 w-3 text-neutral-500" />
      </button>
    </div>
  );
}
