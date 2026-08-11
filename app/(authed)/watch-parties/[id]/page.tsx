"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Crown,
  DoorOpen,
  Globe,
  Link2,
  Lock,
  LogOut,
  Sparkles,
  Tv2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers";
import {
  getWatchPartyById,
  joinWatchParty,
  leaveWatchParty,
  partyLanguageLabel,
  type WatchParty,
} from "@/lib/mock/watch-parties";
import { RICK_ROLL_EMBED_URL } from "@/lib/mock/_media";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { BackButton } from "@/components/shell/back-button";
import { PartyChat } from "@/components/watch-parties/party-chat";
import { MemberList } from "@/components/watch-parties/member-list";

export default function WatchPartyRoomPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const partyId = params?.id ?? "";
  const { user } = useAuth();

  const [party, setParty] = React.useState<WatchParty | null | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const p = await getWatchPartyById(partyId);
    setParty(p);
  }, [partyId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const joined = !!user && !!party && party.members.some((m) => m.userId === user.id);
  const isHost = !!user && !!party && party.hostId === user.id;

  async function handleJoin() {
    if (!user) {
      toast.error("Sign in to join the party");
      return;
    }
    if (!party) return;
    setBusy(true);
    try {
      const updated = await joinWatchParty(party.id, user);
      if (updated) {
        setParty(updated);
        toast.success(`Welcome to "${updated.name}"`);
      } else {
        toast.error("Could not join party");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!user || !party) return;
    setBusy(true);
    try {
      const updated = await leaveWatchParty(party.id, user.id);
      if (updated === null) {
        toast.success("Party closed");
        router.push("/watch-parties");
        return;
      }
      setParty(updated);
      toast.success("You left the party");
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite() {
    if (!party) return;
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/watch-parties/${party.id}`
        : `/watch-parties/${party.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: party.name,
          text: `Watch ${party.streamTitle} with us in the EVO TV watch party.`,
          url,
        });
        return;
      }
    } catch {
      /* user cancelled native share — fall through to clipboard */
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied to clipboard");
    } catch {
      toast.error("Could not copy invite link");
    }
  }

  // Loading
  if (party === undefined) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 h-6 w-24 animate-pulse rounded bg-neutral-900" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="aspect-video animate-pulse rounded-xl bg-neutral-900" />
          <div className="h-[520px] animate-pulse rounded-xl bg-neutral-900" />
        </div>
      </div>
    );
  }

  // 404
  if (party === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Sparkles className="mx-auto size-10 text-neutral-600" />
        <h1 className="mt-3 text-2xl font-bold text-neutral-100">Watch party not found</h1>
        <p className="mt-1 text-sm text-neutral-400">
          The host may have closed the room or the link is invalid.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button asChild variant="outline" className="border-neutral-800">
            <Link href="/watch-parties">Browse parties</Link>
          </Button>
          <Button asChild className="bg-sky-500 text-black hover:bg-sky-400">
            <Link href="/watch-parties/new">Host one</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-neutral-950">
      <div className="mx-auto grid max-w-[1600px] gap-4 px-3 py-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Left column — player + room metadata */}
        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <BackButton fallbackHref="/watch-parties" />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-neutral-800"
                onClick={handleInvite}
              >
                <Link2 className="size-3.5" />
                Invite
              </Button>
              {joined ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-neutral-800 text-neutral-300 hover:text-red-300"
                  onClick={handleLeave}
                  disabled={busy}
                >
                  {isHost ? <DoorOpen className="size-3.5" /> : <LogOut className="size-3.5" />}
                  {isHost ? "Close party" : "Leave"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="bg-sky-500 text-black hover:bg-sky-400"
                  onClick={handleJoin}
                  disabled={busy}
                >
                  <UserPlus className="size-3.5" />
                  Join party
                </Button>
              )}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-black">
            <div className="relative aspect-video w-full">
              <iframe
                src={RICK_ROLL_EMBED_URL}
                title={party.streamTitle}
                className="absolute inset-0 h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded bg-red-600/90 px-2 py-1 text-xs font-bold uppercase tracking-wider text-white">
                <span className="size-1.5 animate-pulse rounded-full bg-white" />
                Live
              </div>
              <div className="pointer-events-none absolute right-3 top-3 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
                Watch party room · {party.viewerCount} watching together
              </div>
            </div>
          </div>

          {/* Room header */}
          <section className="space-y-3">
            <div>
              <h1 className="text-xl font-bold leading-tight text-neutral-50 md:text-2xl">
                {party.name}
              </h1>
              <p className="mt-1 line-clamp-1 text-sm text-neutral-400">
                Watching{" "}
                <Link
                  href={`/stream/${party.streamId}`}
                  className="text-sky-400 hover:text-sky-300"
                >
                  {party.streamTitle}
                </Link>
              </p>
              {party.topic ? (
                <p className="mt-2 rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-300">
                  <span className="mr-1 font-semibold text-neutral-400">Topic:</span>
                  {party.topic}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2.5">
                <Avatar className="size-10 ring-2 ring-amber-500/60">
                  <AvatarImage src={party.hostAvatarUrl} alt={party.hostDisplayName} />
                  <AvatarFallback>{party.hostDisplayName.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-neutral-100">
                    {party.hostDisplayName}
                    <Crown className="size-3.5 text-amber-400" />
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                    Host · @{party.hostHandle}
                  </div>
                </div>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                {party.visibility === "invite" ? (
                  <Badge className="bg-amber-500 text-black">
                    <Lock className="size-3" /> Invite-only
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-neutral-800 text-neutral-100">
                    <Globe className="size-3" /> Public
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {partyLanguageLabel(party.language)}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  <Users className="size-3" />
                  {party.members.length} / {party.maxGuests}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  <Tv2 className="size-3" />
                  Watch party
                </Badge>
              </div>
            </div>

            {!joined ? (
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-xs text-sky-200">
                <Sparkles className="mr-1 inline size-3.5" />
                You're previewing this party. Join to chat and lock your spot.
              </div>
            ) : null}
          </section>

          {/* Mobile-only tabs for chat + members */}
          <div className="lg:hidden">
            <Tabs defaultValue="chat" className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-950">
              <div className="border-b border-neutral-800 px-2 py-2">
                <TabsList className="bg-neutral-900">
                  <TabsTrigger value="chat">
                    <Sparkles className="size-3.5" /> Chat
                  </TabsTrigger>
                  <TabsTrigger value="members">
                    <Users className="size-3.5" /> Members
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="chat" className="mt-0 h-[420px]">
                <PartyChat
                  partyId={party.id}
                  joined={joined}
                  memberCount={party.members.length}
                />
              </TabsContent>
              <TabsContent value="members" className="mt-0 h-[420px] overflow-hidden">
                <MemberList
                  members={party.members}
                  currentUserId={user?.id}
                  maxGuests={party.maxGuests}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Right column — desktop social panel */}
        <aside className="sticky top-16 hidden h-[calc(100vh-5rem)] overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 lg:block">
          <Tabs defaultValue="chat" className="flex h-full flex-col">
            <div className="border-b border-neutral-800 px-2 py-2">
              <TabsList className="bg-neutral-900">
                <TabsTrigger value="chat">
                  <Sparkles className="size-3.5" /> Chat
                </TabsTrigger>
                <TabsTrigger value="members">
                  <Users className="size-3.5" /> Members{" "}
                  <span className="ml-1 rounded-full bg-neutral-800 px-1.5 text-[10px] text-neutral-300">
                    {party.members.length}
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="chat" className="mt-0 flex-1 min-h-0">
              <PartyChat
                partyId={party.id}
                joined={joined}
                memberCount={party.members.length}
              />
            </TabsContent>
            <TabsContent value="members" className="mt-0 flex-1 min-h-0 overflow-hidden">
              <MemberList
                members={party.members}
                currentUserId={user?.id}
                maxGuests={party.maxGuests}
              />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}
