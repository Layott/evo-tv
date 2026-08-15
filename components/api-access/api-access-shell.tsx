"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Code2, Gauge, KeyRound, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/api-access", label: "Overview", Icon: Sparkles, exact: true },
  { href: "/api-access/keys", label: "Keys", Icon: KeyRound },
  { href: "/api-access/docs", label: "Docs", Icon: Code2 },
  { href: "/api-access/usage", label: "Usage", Icon: Gauge },
];

export function ApiAccessShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <header className="mb-6">
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300">
          <Sparkles className="size-3" />
          Premium feature
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
          EVO TV Public API
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Build apps, dashboards, and automations on top of African esports data.
        </p>
      </header>

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card/40 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          const Icon = t.Icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition",
                active
                  ? "bg-background text-sky-300 shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
