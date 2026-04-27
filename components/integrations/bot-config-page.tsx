"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Send,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { useMockAuth } from "@/components/providers";
import {
  type BotIntegration,
  type BotKind,
  type ChannelMappings,
  connectBot,
  disconnectBot,
  getBotForKind,
  maskToken,
  triggerTestEvent,
  updateBotMappings,
  validateBotToken,
  validateServerId,
} from "@/lib/mock/bots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DiscordIcon,
  TelegramIcon,
} from "@/components/integrations/bot-icons";

interface Props {
  kind: BotKind;
  brand: {
    label: string;
    accent: string; // tailwind classes for icon backdrop
    helpToken: string;
    helpServerLabel: string;
    helpServerHint: string;
    serverLabelTitle: string;
    placeholderToken: string;
    placeholderServer: string;
    iconKind?: "discord" | "telegram";
  };
}

const DEFAULT_MAPPINGS: ChannelMappings = {
  goLive: "",
  matchResults: "",
  drops: "",
};

export function BotConfigPage({ kind, brand }: Props) {
  const { user } = useMockAuth();
  const userId = user?.id ?? "user_current";
  const qc = useQueryClient();

  const botQ = useQuery({
    queryKey: ["bot", userId, kind],
    queryFn: () => getBotForKind(userId, kind),
  });

  const Icon = brand.iconKind === "telegram" ? TelegramIcon : DiscordIcon;

  if (botQ.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-neutral-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <Link
        href="/integrations"
        className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-100"
      >
        <ArrowLeft className="size-3.5" /> All integrations
      </Link>

      <header className="mt-4 flex items-start gap-4">
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ${brand.accent}`}
        >
          <Icon className="size-7" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-neutral-50">{brand.label} integration</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Pipe EVO TV events into your {brand.label} {kind === "discord" ? "server" : "group"}.
          </p>
        </div>
      </header>

      {botQ.data ? (
        <ConnectedView
          bot={botQ.data}
          brand={brand}
          onDisconnect={async () => {
            await disconnectBot(botQ.data!.id);
            qc.invalidateQueries({ queryKey: ["bot", userId, kind] });
            qc.invalidateQueries({ queryKey: ["bots", userId] });
            toast.success(`${brand.label} disconnected`);
          }}
          onSaveMappings={async (m) => {
            await updateBotMappings(botQ.data!.id, m);
            qc.invalidateQueries({ queryKey: ["bot", userId, kind] });
            toast.success("Channel mappings updated");
          }}
          onTest={async () => {
            await triggerTestEvent(botQ.data!.id);
            qc.invalidateQueries({ queryKey: ["bot", userId, kind] });
            toast.success(`Test alert sent to ${brand.label}`);
          }}
        />
      ) : (
        <ConnectForm
          kind={kind}
          brand={brand}
          onConnected={() => {
            qc.invalidateQueries({ queryKey: ["bot", userId, kind] });
            qc.invalidateQueries({ queryKey: ["bots", userId] });
          }}
        />
      )}

      <section className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 text-sm">
        <h3 className="font-semibold text-neutral-100">How it works</h3>
        <ol className="mt-2 space-y-1.5 text-neutral-400">
          <li>1. {brand.helpToken}</li>
          <li>2. Pick the channel(s) where each event type should land.</li>
          <li>3. Send a test event to confirm everything's wired up.</li>
          <li>4. EVO TV will push live alerts, match results, and drops automatically.</li>
        </ol>
      </section>
    </div>
  );
}

function ConnectForm({
  kind,
  brand,
  onConnected,
}: {
  kind: BotKind;
  brand: Props["brand"];
  onConnected: () => void;
}) {
  const { user } = useMockAuth();
  const userId = user?.id ?? "user_current";
  const [token, setToken] = React.useState("");
  const [serverId, setServerId] = React.useState("");
  const [serverName, setServerName] = React.useState("");
  const [mappings, setMappings] = React.useState<ChannelMappings>(DEFAULT_MAPPINGS);
  const [submitting, setSubmitting] = React.useState(false);

  const tokenValid = token.length === 0 || validateBotToken(kind, token);
  const serverValid = serverId.length === 0 || validateServerId(kind, serverId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!validateBotToken(kind, token)) {
      toast.error("That token doesn't look right");
      return;
    }
    if (!validateServerId(kind, serverId)) {
      toast.error(brand.helpServerHint);
      return;
    }
    setSubmitting(true);
    try {
      await connectBot(userId, kind, {
        token,
        serverId,
        serverName: serverName || undefined,
        channelMappings: mappings,
      });
      toast.success(`${brand.label} connected`, {
        description: "EVO TV will now post events to your server.",
      });
      onConnected();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5"
    >
      <div className="space-y-1.5">
        <Label htmlFor="bot-token" className="text-neutral-200 font-semibold">
          Bot token
        </Label>
        <Input
          id="bot-token"
          type="password"
          autoComplete="off"
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={brand.placeholderToken}
          aria-invalid={!tokenValid}
          className={`bg-neutral-950/60 font-mono ${
            !tokenValid ? "border-red-500/60 focus-visible:border-red-500" : ""
          }`}
        />
        <p className="text-xs text-neutral-500">{brand.helpToken}</p>
        {!tokenValid && <p className="text-xs text-red-400">Token format looks invalid.</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="bot-server-id" className="text-neutral-200 font-semibold">
            {brand.helpServerLabel}
          </Label>
          <Input
            id="bot-server-id"
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            placeholder={brand.placeholderServer}
            aria-invalid={!serverValid}
            className={`bg-neutral-950/60 font-mono ${
              !serverValid ? "border-red-500/60 focus-visible:border-red-500" : ""
            }`}
          />
          {!serverValid && (
            <p className="text-xs text-red-400">{brand.helpServerHint}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bot-server-name" className="text-neutral-200 font-semibold">
            {brand.serverLabelTitle}
          </Label>
          <Input
            id="bot-server-name"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            placeholder="Optional"
            className="bg-neutral-950/60"
          />
        </div>
      </div>

      <ChannelMappingFields mappings={mappings} onChange={setMappings} kind={kind} />

      <Button
        type="submit"
        disabled={submitting}
        className="w-full bg-sky-500 font-semibold text-neutral-950 hover:bg-sky-400"
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Connecting…
          </>
        ) : (
          <>
            Connect {brand.label}
          </>
        )}
      </Button>
    </form>
  );
}

function ConnectedView({
  bot,
  brand,
  onDisconnect,
  onSaveMappings,
  onTest,
}: {
  bot: BotIntegration;
  brand: Props["brand"];
  onDisconnect: () => Promise<void>;
  onSaveMappings: (m: ChannelMappings) => Promise<void>;
  onTest: () => Promise<void>;
}) {
  const [mappings, setMappings] = React.useState<ChannelMappings>(bot.channelMappings);
  const [savingMappings, setSavingMappings] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const dirty =
    mappings.goLive !== bot.channelMappings.goLive ||
    mappings.matchResults !== bot.channelMappings.matchResults ||
    mappings.drops !== bot.channelMappings.drops;

  async function save() {
    if (savingMappings || !dirty) return;
    setSavingMappings(true);
    try {
      await onSaveMappings(mappings);
    } finally {
      setSavingMappings(false);
    }
  }

  async function disconnect() {
    if (disconnecting) return;
    if (!confirm(`Disconnect ${brand.label}? EVO TV will stop posting events.`)) return;
    setDisconnecting(true);
    try {
      await onDisconnect();
    } finally {
      setDisconnecting(false);
    }
  }

  async function fireTest() {
    if (testing) return;
    setTesting(true);
    try {
      await onTest();
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <div className="flex items-center gap-2 text-emerald-200">
          <CheckCircle2 className="size-5" />
          <span className="text-sm font-semibold">Connected to {bot.serverName}</span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-emerald-300/70">Token</dt>
            <dd className="truncate font-mono text-emerald-100">{maskToken(bot.token)}</dd>
          </div>
          <div>
            <dt className="text-emerald-300/70">Server ID</dt>
            <dd className="truncate font-mono text-emerald-100">{bot.serverId}</dd>
          </div>
          <div>
            <dt className="text-emerald-300/70">Events sent</dt>
            <dd className="text-emerald-100">{bot.eventCount}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">
          Channel routing
        </h3>
        <ChannelMappingFields mappings={mappings} onChange={setMappings} kind={bot.kind} />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={save}
            disabled={!dirty || savingMappings}
            className="bg-sky-500 font-semibold text-neutral-950 hover:bg-sky-400"
          >
            {savingMappings ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save mappings"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={fireTest}
            disabled={testing}
            className="border-neutral-800"
          >
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            Send test alert
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-red-200">Disconnect</h3>
            <p className="text-xs text-red-300/70">
              Removes the integration. You can reconnect any time.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={disconnect}
            disabled={disconnecting}
            className="border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
          >
            {disconnecting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Disconnect
          </Button>
        </div>
      </div>
    </>
  );
}

function ChannelMappingFields({
  mappings,
  onChange,
  kind,
}: {
  mappings: ChannelMappings;
  onChange: (m: ChannelMappings) => void;
  kind: BotKind;
}) {
  const placeholder = kind === "discord" ? "#go-live" : "@evo-go-live";
  const fields: Array<{ key: keyof ChannelMappings; label: string; description: string }> = [
    {
      key: "goLive",
      label: "Go-live alerts",
      description: "Posts when a stream you follow starts.",
    },
    {
      key: "matchResults",
      label: "Match results",
      description: "Final scores and bracket updates after each match.",
    },
    {
      key: "drops",
      label: "Drop announcements",
      description: "Limited merch and digital drops shown in chat.",
    },
  ];

  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.key} className="grid items-start gap-2 sm:grid-cols-[1fr_2fr]">
          <div>
            <Label htmlFor={`map-${f.key}`} className="text-sm text-neutral-200">
              {f.label}
            </Label>
            <p className="text-[11px] text-neutral-500">{f.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Send className="size-3.5 shrink-0 text-neutral-500" />
            <Input
              id={`map-${f.key}`}
              value={mappings[f.key]}
              onChange={(e) => onChange({ ...mappings, [f.key]: e.target.value })}
              placeholder={placeholder}
              className="bg-neutral-950/60 font-mono"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
