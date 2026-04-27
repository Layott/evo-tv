"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, Globe, Lock, Users } from "lucide-react";
import type { WatchParty } from "@/lib/mock/watch-parties";
import { partyLanguageLabel } from "@/lib/mock/watch-parties";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PartyCardProps {
  party: WatchParty;
  joined?: boolean;
  onJoin?: (partyId: string) => void;
  busy?: boolean;
}

export function PartyCard({ party, joined = false, onJoin, busy = false }: PartyCardProps) {
  const isFull = party.members.length >= party.maxGuests;
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 transition-colors hover:border-neutral-700">
      <Link
        href={`/watch-parties/${party.id}`}
        className="relative aspect-video overflow-hidden"
      >
        <Image
          src={party.streamThumbnailUrl}
          alt={party.streamTitle}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
        />
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-red-400 backdrop-blur-sm">
          <span className="size-1.5 animate-pulse rounded-full bg-red-500" /> Live
        </div>
        {party.visibility === "invite" ? (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
            <Lock className="size-3" /> Invite
          </div>
        ) : (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-200">
            <Globe className="size-3" /> Public
          </div>
        )}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] text-neutral-200">
          <Eye className="size-3" /> {party.viewerCount}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <Link href={`/watch-parties/${party.id}`}>
            <h3 className="line-clamp-1 text-sm font-semibold text-neutral-50 group-hover:text-sky-300">
              {party.name}
            </h3>
          </Link>
          <p className="mt-1 line-clamp-1 text-xs text-neutral-400">{party.streamTitle}</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-300">
          <Avatar className="size-7 ring-1 ring-neutral-700">
            <AvatarImage src={party.hostAvatarUrl} alt={party.hostDisplayName} />
            <AvatarFallback className="text-[10px]">
              {party.hostDisplayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate font-medium text-neutral-100">
              {party.hostDisplayName}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-500">Host</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            {partyLanguageLabel(party.language)}
          </Badge>
          <Badge variant="secondary" className="bg-neutral-800 text-[10px] text-neutral-200">
            <Users className="size-3" />
            {party.members.length} / {party.maxGuests}
          </Badge>
        </div>

        <div className="mt-auto flex items-center gap-2">
          {joined ? (
            <Button
              asChild
              size="sm"
              className="flex-1 bg-sky-500 text-black hover:bg-sky-400"
            >
              <Link href={`/watch-parties/${party.id}`}>Open room</Link>
            </Button>
          ) : (
            <Button
              size="sm"
              className="flex-1 bg-sky-500 text-black hover:bg-sky-400"
              onClick={() => onJoin?.(party.id)}
              disabled={busy || isFull}
            >
              {isFull ? "Full" : "Join"}
            </Button>
          )}
          <Button
            asChild
            size="sm"
            variant="outline"
            className="border-neutral-800"
          >
            <Link href={`/watch-parties/${party.id}`}>Preview</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
