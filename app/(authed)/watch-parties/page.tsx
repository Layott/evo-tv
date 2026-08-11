"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Users, Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers";
import {
  joinWatchParty,
  leaveWatchParty,
  listWatchParties,
  partyLanguageLabel,
  type WatchParty,
  type WatchPartyVisibility,
} from "@/lib/mock/watch-parties";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PartyCard } from "@/components/watch-parties/party-card";

function SkeletonCard() {
  return (
    <div className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="aspect-video w-full animate-pulse rounded-lg bg-neutral-900" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-900" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-900" />
    </div>
  );
}

export default function WatchPartiesIndexPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [parties, setParties] = React.useState<WatchParty[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [visibilityFilter, setVisibilityFilter] = React.useState<WatchPartyVisibility | "all">(
    "all",
  );
  const [langFilter, setLangFilter] = React.useState<string | "all">("all");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const list = await listWatchParties();
    setParties(list);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleJoin(partyId: string) {
    if (!user) {
      toast.error("Sign in to join a party");
      return;
    }
    setBusyId(partyId);
    try {
      const res = await joinWatchParty(partyId, user);
      if (!res) {
        toast.error("Could not join party");
        return;
      }
      toast.success("Joined the party");
      router.push(`/watch-parties/${partyId}`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleLeave(partyId: string) {
    if (!user) return;
    setBusyId(partyId);
    try {
      await leaveWatchParty(partyId, user.id);
      toast.success("Left the party");
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  const filtered = React.useMemo(() => {
    return parties.filter((p) => {
      if (visibilityFilter !== "all" && p.visibility !== visibilityFilter) return false;
      if (langFilter !== "all" && p.language !== langFilter) return false;
      return true;
    });
  }, [parties, visibilityFilter, langFilter]);

  const myParties = React.useMemo(() => {
    if (!user) return [] as WatchParty[];
    return filtered.filter((p) => p.members.some((m) => m.userId === user.id));
  }, [filtered, user]);

  const publicParties = React.useMemo(
    () => filtered.filter((p) => p.visibility === "public"),
    [filtered],
  );

  const totalMembers = parties.reduce((sum, p) => sum + p.members.length, 0);
  const languages = React.useMemo(() => {
    const set = new Set(parties.map((p) => p.language));
    return Array.from(set);
  }, [parties]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Watch Parties</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Co-watch live esports with friends. Side-by-side player + dedicated chat.
          </p>
        </div>
        <Button asChild className="bg-sky-500 text-black hover:bg-sky-400">
          <Link href="/watch-parties/new">
            <Plus className="size-4" />
            Host a party
          </Link>
        </Button>
      </header>

      {/* Hero stats strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={<Sparkles className="size-4 text-sky-400" />}
          label="Active parties"
          value={parties.length}
        />
        <Stat
          icon={<Users className="size-4 text-amber-400" />}
          label="People watching together"
          value={totalMembers}
        />
        <Stat
          icon={<Globe className="size-4 text-emerald-400" />}
          label="Languages"
          value={languages.length}
        />
        <Stat
          icon={<Lock className="size-4 text-neutral-400" />}
          label="Invite-only rooms"
          value={parties.filter((p) => p.visibility === "invite").length}
        />
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-neutral-500">Visibility:</span>
        {(["all", "public", "invite"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVisibilityFilter(v)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              visibilityFilter === v
                ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
                : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700"
            }`}
          >
            {v === "all" ? "All" : v === "public" ? "Public" : "Invite"}
          </button>
        ))}

        <span className="ml-2 text-xs uppercase tracking-wider text-neutral-500">Language:</span>
        <button
          type="button"
          onClick={() => setLangFilter("all")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            langFilter === "all"
              ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
              : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700"
          }`}
        >
          All
        </button>
        {languages.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLangFilter(l)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              langFilter === l
                ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
                : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700"
            }`}
          >
            {partyLanguageLabel(l)}
          </button>
        ))}
      </div>

      <Tabs defaultValue="browse" className="space-y-5">
        <TabsList className="bg-neutral-900/60">
          <TabsTrigger value="browse">
            <Globe className="size-4" /> Browse public
          </TabsTrigger>
          <TabsTrigger value="mine">
            <Users className="size-4" /> My parties{" "}
            <span className="ml-1 rounded-full bg-neutral-800 px-1.5 text-[10px] text-neutral-300">
              {myParties.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-0">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : publicParties.length === 0 ? (
            <EmptyState
              title="No public parties matching your filters"
              subtitle="Adjust filters above or host one yourself."
              ctaLabel="Host a party"
              ctaHref="/watch-parties/new"
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {publicParties.map((p) => {
                const joined = !!user && p.members.some((m) => m.userId === user.id);
                return (
                  <PartyCard
                    key={p.id}
                    party={p}
                    joined={joined}
                    onJoin={handleJoin}
                    busy={busyId === p.id}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine" className="mt-0">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : !user ? (
            <EmptyState
              title="Sign in to track parties"
              subtitle="Use the role switcher (bottom-right in dev) to log in and join rooms."
            />
          ) : myParties.length === 0 ? (
            <EmptyState
              title="You're not in any parties"
              subtitle="Join a public party from the Browse tab, or host your own."
              ctaLabel="Host a party"
              ctaHref="/watch-parties/new"
            />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {myParties.map((p) => (
                  <div key={p.id} className="space-y-2">
                    <PartyCard party={p} joined onJoin={handleJoin} busy={busyId === p.id} />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full border-neutral-800 text-neutral-300 hover:text-red-300"
                      onClick={() => handleLeave(p.id)}
                      disabled={busyId === p.id}
                    >
                      Leave party
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-neutral-400">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums text-neutral-50">{value}</div>
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  subtitle: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-12 text-center">
      <Sparkles className="mx-auto size-10 text-neutral-600" />
      <p className="mt-3 text-sm font-semibold text-neutral-200">{title}</p>
      <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>
      {ctaLabel && ctaHref ? (
        <Button asChild className="mt-5 bg-sky-500 text-black hover:bg-sky-400">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}
