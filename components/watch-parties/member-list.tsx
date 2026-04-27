"use client";

import * as React from "react";
import { Crown, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { WatchPartyMember } from "@/lib/mock/watch-parties";

interface MemberListProps {
  members: WatchPartyMember[];
  currentUserId?: string | null;
  maxGuests: number;
}

function relativeMinutes(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h`;
}

export function MemberList({ members, currentUserId, maxGuests }: MemberListProps) {
  const sorted = React.useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.isHost && !b.isHost) return -1;
        if (!a.isHost && b.isHost) return 1;
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      }),
    [members],
  );

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
          <Users className="size-4" />
          Members
        </div>
        <span className="text-[10px] text-neutral-500">
          {members.length} / {maxGuests}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {sorted.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-neutral-500">
            Empty room.
          </div>
        ) : (
          sorted.map((m) => {
            const isMe = currentUserId === m.userId;
            return (
              <div
                key={m.userId}
                className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-neutral-900/60"
              >
                <Avatar className="size-8 flex-shrink-0 ring-1 ring-neutral-700">
                  <AvatarImage src={m.avatarUrl} alt={m.handle} />
                  <AvatarFallback className="text-[10px]">
                    {m.handle.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-xs font-semibold text-neutral-100">
                    <span className="truncate">{m.displayName}</span>
                    {m.isHost && (
                      <Badge className="bg-amber-500 px-1 py-0 text-[9px] text-black">
                        <Crown className="size-2.5" /> Host
                      </Badge>
                    )}
                    {isMe && !m.isHost && (
                      <Badge variant="outline" className="px-1 py-0 text-[9px]">
                        You
                      </Badge>
                    )}
                  </div>
                  <div className="truncate text-[10px] text-neutral-500">@{m.handle}</div>
                </div>
                <div className="flex-shrink-0 text-[10px] text-neutral-500">
                  {relativeMinutes(m.joinedAt)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
