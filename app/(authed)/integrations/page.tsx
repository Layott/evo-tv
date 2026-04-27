"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, Plug, Webhook } from "lucide-react";

import { useMockAuth } from "@/components/providers";
import { listBots, INTEGRATION_CATALOG, type BotIntegration } from "@/lib/mock/bots";
import {
  DiscordIcon,
  TelegramIcon,
  SlackIcon,
  XIcon,
} from "@/components/integrations/bot-icons";
import { Button } from "@/components/ui/button";
import { AppStatusBadge } from "@/components/apps/status-badge";

function relTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ICON_FOR: Record<string, (p: { className?: string }) => React.ReactElement> = {
  discord: DiscordIcon,
  telegram: TelegramIcon,
  slack: SlackIcon,
  twitter: XIcon,
  webhook: ({ className }) => <Webhook className={className} />,
};

const ACCENT_FOR: Record<string, string> = {
  discord: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30",
  telegram: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  slack: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  twitter: "bg-neutral-500/15 text-neutral-200 ring-neutral-600/40",
  webhook: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
};

export default function IntegrationsPage() {
  const { user } = useMockAuth();
  const userId = user?.id ?? "user_current";
  const botsQ = useQuery({
    queryKey: ["bots", userId],
    queryFn: () => listBots(userId),
  });

  const botsByKind = new Map<string, BotIntegration>();
  (botsQ.data ?? []).forEach((b) => botsByKind.set(b.kind, b));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-neutral-50">
            <Plug className="size-5 text-sky-400" /> Integrations
          </h1>
          <p className="text-sm text-neutral-400">
            Pipe EVO TV events into the tools your community already uses.
          </p>
        </div>
      </header>

      {botsQ.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-neutral-500" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {INTEGRATION_CATALOG.map((entry) => {
            const Icon = ICON_FOR[entry.kind] ?? Plug;
            const accent = ACCENT_FOR[entry.kind] ?? "";
            const connected = botsByKind.get(entry.kind);
            const isAvailable = entry.status === "available";

            return (
              <div
                key={entry.kind}
                className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5"
              >
                <div className="flex items-start justify-between">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ring-1 ring-inset ${accent}`}
                  >
                    <Icon className="size-6" />
                  </span>
                  {connected ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      Connected
                    </span>
                  ) : (
                    <AppStatusBadge status={entry.status === "available" ? "available" : "coming-soon"} />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-neutral-50">{entry.label}</h2>
                  <p className="mt-1 text-sm text-neutral-400">{entry.blurb}</p>
                </div>

                {connected && (
                  <dl className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-800 bg-neutral-950/40 p-3 text-xs">
                    <div>
                      <dt className="text-neutral-500">Server</dt>
                      <dd className="truncate font-semibold text-neutral-200">
                        {connected.serverName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Last event</dt>
                      <dd className="truncate text-neutral-200">{relTime(connected.lastEventAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Events sent</dt>
                      <dd className="text-neutral-200">{connected.eventCount}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Connected</dt>
                      <dd className="truncate text-neutral-200">{relTime(connected.connectedAt)}</dd>
                    </div>
                  </dl>
                )}

                <div className="mt-auto flex items-center justify-between border-t border-neutral-800 pt-3">
                  <span className="text-[11px] text-neutral-500">
                    {connected ? "Active" : isAvailable ? "Not connected" : "Coming soon"}
                  </span>
                  {isAvailable ? (
                    <Button asChild size="sm" variant={connected ? "outline" : "default"} className={connected ? "border-neutral-800" : "bg-sky-500 text-neutral-950 hover:bg-sky-400"}>
                      <Link href={entry.href}>
                        {connected ? "Configure" : "Connect"}
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled className="border-neutral-800">
                      Coming soon
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
