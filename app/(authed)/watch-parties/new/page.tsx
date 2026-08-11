"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, Lock, Loader2, Sparkles, Tv2, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers";
import { listLiveStreams } from "@/lib/client";
import {
  createWatchParty,
  PARTY_LANGUAGE_OPTIONS,
  type WatchPartyLanguage,
  type WatchPartyVisibility,
} from "@/lib/mock/watch-parties";
import type { Stream } from "@/lib/types";
import { BackButton } from "@/components/shell/back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export default function NewWatchPartyPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [streams, setStreams] = React.useState<Stream[]>([]);
  const [streamsLoading, setStreamsLoading] = React.useState(true);

  const [name, setName] = React.useState("");
  const [topic, setTopic] = React.useState("");
  const [streamId, setStreamId] = React.useState<string>("");
  const [maxGuests, setMaxGuests] = React.useState<number>(20);
  const [visibility, setVisibility] = React.useState<WatchPartyVisibility>("public");
  const [language, setLanguage] = React.useState<WatchPartyLanguage>("en");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setStreamsLoading(true);
    listLiveStreams().then((s) => {
      if (!cancelled) {
        setStreams(s);
        setStreamId((prev) => prev || s[0]?.id || "");
        setStreamsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedStream = streams.find((s) => s.id === streamId);
  const nameValid = name.trim().length >= 3;
  const canSubmit = !!user && nameValid && !!selectedStream && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast.error("Sign in to host a party");
      return;
    }
    if (!nameValid) {
      toast.error("Party name needs at least 3 characters");
      return;
    }
    if (!selectedStream) {
      toast.error("Pick a live stream first");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createWatchParty({
        name,
        streamId: selectedStream.id,
        streamTitle: selectedStream.title,
        streamThumbnailUrl: selectedStream.thumbnailUrl,
        visibility,
        language,
        maxGuests,
        topic,
        host: {
          id: user.id,
          handle: user.handle,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
      });
      toast.success("Party created. Invite your crew!");
      router.push(`/watch-parties/${created.id}`);
    } catch {
      toast.error("Could not create party");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <div className="mb-4">
        <BackButton fallbackHref="/watch-parties" />
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Host a watch party</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Pick a live stream, set the vibe, invite your friends.
        </p>
      </header>

      {!user ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-12 text-center">
          <Sparkles className="mx-auto size-10 text-neutral-600" />
          <p className="mt-3 text-sm font-semibold text-neutral-200">Sign in to host a party</p>
          <p className="mt-1 text-xs text-neutral-500">
            Use the role switcher (bottom-right in dev) to choose a role.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
              <h2 className="mb-4 text-base font-semibold text-neutral-50">Basics</h2>
              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Party name</Label>
                  <Input
                    id="name"
                    placeholder="Lagos Squad — Semis Watch"
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 60))}
                    maxLength={60}
                    className="bg-neutral-950"
                  />
                  <p className="text-[10px] text-neutral-500">
                    {name.length} / 60 — visible to everyone in the room
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="topic">Vibe / topic (optional)</Label>
                  <Textarea
                    id="topic"
                    placeholder="What's the energy? Predictions? Who you rooting for?"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value.slice(0, 140))}
                    maxLength={140}
                    rows={2}
                    className="bg-neutral-950"
                  />
                  <p className="text-[10px] text-neutral-500">{topic.length} / 140</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={language}
                    onValueChange={(v) => setLanguage(v as WatchPartyLanguage)}
                  >
                    <SelectTrigger id="language" className="bg-neutral-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PARTY_LANGUAGE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
              <h2 className="mb-1 text-base font-semibold text-neutral-50">
                Pick a live stream
              </h2>
              <p className="mb-4 text-xs text-neutral-500">
                The party room will play this stream side-by-side with your group chat.
              </p>
              {streamsLoading ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-24 animate-pulse rounded-lg bg-neutral-900" />
                  ))}
                </div>
              ) : streams.length === 0 ? (
                <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-6 text-center text-sm text-neutral-500">
                  No live streams right now.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {streams.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setStreamId(s.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-2 text-left transition-colors",
                        streamId === s.id
                          ? "border-sky-500/60 bg-sky-500/10"
                          : "border-neutral-800 bg-neutral-950 hover:border-neutral-700",
                      )}
                    >
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-neutral-900">
                        <Image
                          src={s.thumbnailUrl}
                          alt={s.title}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                        <span className="absolute left-1 top-1 rounded bg-red-600/90 px-1 py-0.5 text-[9px] font-bold uppercase text-white">
                          Live
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-xs font-semibold text-neutral-100">
                          {s.title}
                        </p>
                        <p className="mt-0.5 text-[10px] text-neutral-400">
                          {s.streamerName} · {s.viewerCount.toLocaleString()} watching
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
              <h2 className="mb-4 text-base font-semibold text-neutral-50">Room settings</h2>
              <div className="grid gap-5">
                <div className="space-y-2">
                  <Label>Max guests: <span className="font-bold text-sky-400">{maxGuests}</span></Label>
                  <Slider
                    min={2}
                    max={100}
                    step={1}
                    value={[maxGuests]}
                    onValueChange={(v) => setMaxGuests(v[0] ?? 20)}
                    className="mt-1"
                  />
                  <p className="text-[10px] text-neutral-500">
                    Cap how big the room can grow. Includes you.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setVisibility("public")}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                        visibility === "public"
                          ? "border-sky-500/60 bg-sky-500/10"
                          : "border-neutral-800 bg-neutral-950 hover:border-neutral-700",
                      )}
                    >
                      <Globe className="mt-0.5 size-4 text-sky-400" />
                      <div>
                        <div className="text-sm font-semibold text-neutral-100">Public</div>
                        <div className="text-[11px] text-neutral-400">
                          Anyone can browse + join until full.
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibility("invite")}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                        visibility === "invite"
                          ? "border-sky-500/60 bg-sky-500/10"
                          : "border-neutral-800 bg-neutral-950 hover:border-neutral-700",
                      )}
                    >
                      <Lock className="mt-0.5 size-4 text-amber-400" />
                      <div>
                        <div className="text-sm font-semibold text-neutral-100">Invite-only</div>
                        <div className="text-[11px] text-neutral-400">
                          Only people with the link can join.
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar — preview + submit */}
          <aside className="space-y-4">
            <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
              <h2 className="mb-3 text-base font-semibold text-neutral-50">Preview</h2>
              {selectedStream ? (
                <div className="space-y-3">
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-neutral-950">
                    <Image
                      src={selectedStream.thumbnailUrl}
                      alt={selectedStream.title}
                      fill
                      className="object-cover"
                      sizes="360px"
                    />
                    <div className="absolute left-2 top-2 rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      Live
                    </div>
                  </div>
                  <div>
                    <p className="line-clamp-2 text-sm font-semibold text-neutral-100">
                      {name.trim() || "Your party name…"}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-neutral-400">
                      Watching: {selectedStream.title}
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-[11px]">
                    <Pill label="Visibility" value={visibility === "public" ? "Public" : "Invite"} />
                    <Pill label="Max guests" value={String(maxGuests)} />
                    <Pill
                      label="Language"
                      value={
                        PARTY_LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ??
                        language
                      }
                    />
                    <Pill label="Host" value={user.displayName} />
                  </dl>
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-800 text-xs text-neutral-500">
                  <Tv2 className="mr-2 size-4" />
                  Pick a stream to preview
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-sky-500 text-black hover:bg-sky-400"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {submitting ? "Creating…" : "Create & open room"}
              </Button>
              <Button
                asChild
                type="button"
                variant="outline"
                className="mt-2 w-full border-neutral-800"
                disabled={submitting}
              >
                <Link href="/watch-parties">Cancel</Link>
              </Button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-neutral-500">
                <Users className="size-3" />
                You'll be the host. You can leave any time.
              </p>
            </section>
          </aside>
        </form>
      )}
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5">
      <dt className="text-[9px] uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className="line-clamp-1 text-[11px] font-medium text-neutral-200">{value}</dd>
    </div>
  );
}
