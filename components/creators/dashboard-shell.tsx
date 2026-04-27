"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft, BarChart3, Coins, Film, Lock, Mic2, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMockAuth } from "@/components/providers/mock-auth-provider";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/creator-dashboard", label: "Overview", icon: BarChart3, exact: true },
  { href: "/creator-dashboard/earnings", label: "Earnings", icon: Coins },
  { href: "/creator-dashboard/clips", label: "Clips", icon: Film },
  { href: "/creator-dashboard/audience", label: "Audience", icon: Users },
];

interface DashboardShellProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function DashboardShell({ children, title, description, actions }: DashboardShellProps) {
  const { role } = useMockAuth();
  const pathname = usePathname();
  const router = useRouter();

  const allowed = role === "admin" || role === "premium";

  if (!allowed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-fuchsia-500/10 p-10 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-500/20">
            <Lock className="size-6 text-amber-300" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-neutral-50">Creator dashboard locked</h1>
          <p className="mt-2 text-sm text-neutral-300">
            The creator dashboard is available to verified creators (or anyone simulating premium/admin via the role switcher).
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button asChild className="bg-amber-500 text-amber-950 hover:bg-amber-400">
              <Link href="/creator-program">
                <Mic2 className="size-4" />
                Join the creator program
              </Link>
            </Button>
            <Button variant="outline" className="border-neutral-700" onClick={() => router.back()}>
              <ArrowLeft className="size-4" /> Back
            </Button>
          </div>
          <p className="mt-4 text-[11px] text-neutral-500">
            Tip: switch role to &quot;Premium&quot; or &quot;Admin&quot; via the dev role switcher to preview.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon" className="size-8 border-neutral-800">
              <Link href="/creator-program">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <h1 className="text-xl font-bold text-neutral-50 sm:text-2xl">
              <Sparkles className="mr-2 inline size-5 text-amber-400" />
              {title}
            </h1>
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-200">
              Creator
            </Badge>
          </div>
          {description ? <p className="mt-1 text-sm text-neutral-400">{description}</p> : null}
        </div>
        {actions}
      </div>

      <nav className="overflow-x-auto pb-2">
        <ul className="flex min-w-max items-center gap-1 rounded-xl border border-neutral-800 bg-neutral-900/60 p-1">
          {TABS.map((t) => {
            const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition",
                    active
                      ? "bg-neutral-800 text-neutral-50 shadow-inner"
                      : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200",
                  )}
                >
                  <t.icon className="size-3.5" />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6">{children}</div>
    </div>
  );
}
