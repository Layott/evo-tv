"use client";

import * as React from "react";
import { Edit, MapPin, ShieldCheck, BadgeCheck } from "@/components/icons";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";

interface Props {
  profile: Profile;
  onEdit?: () => void;
  canEdit?: boolean;
}

/** Formatted join date, or null when there is nothing valid to show. */
function formatJoined(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function ProfileHeader({ profile, onEdit, canEdit = false }: Props) {
  const isPremium = profile.role === "premium";
  const joinedLabel = formatJoined(profile.createdAt);
  const isAdmin = profile.role === "admin";
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card/60 p-6 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={canEdit ? onEdit : undefined}
        disabled={!canEdit}
        className="relative shrink-0 self-start focus:outline-none"
        aria-label={canEdit ? "Edit avatar" : "Avatar"}
      >
        <UserAvatar
          src={profile.avatarUrl}
          name={profile.displayName}
          handle={profile.handle}
          seed={profile.id}
          className="size-24"
          textClassName="text-2xl"
        />
        {canEdit ? (
          <span className="absolute -bottom-1 -right-1 rounded-full bg-muted p-1.5">
            <Edit className="size-3.5 text-sky-400" />
          </span>
        ) : null}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-bold text-foreground">
            {profile.displayName}
          </h1>
          {isPremium ? (
            <Badge className="bg-amber-500/25 text-amber-100">
              <BadgeCheck className="size-3" /> Premium
            </Badge>
          ) : null}
          {isAdmin ? (
            <Badge className="bg-sky-500/25 text-sky-100">
              <ShieldCheck className="size-3" /> Admin
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">@{profile.handle}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" /> {profile.country}
          </span>
          {/* Omit the line rather than print "Joined Invalid Date", which is
              what an absent or unparseable createdAt used to render. */}
          {joinedLabel ? <span>Joined {joinedLabel}</span> : null}
        </div>
        {profile.bio ? (
          <p className="mt-3 max-w-prose text-sm text-foreground/80">{profile.bio}</p>
        ) : null}
      </div>
      {canEdit ? (
        <Button
          onClick={onEdit}
          variant="outline"
          className="self-start text-sky-100 hover:bg-sky-500/25"
        >
          <Edit className="size-4" /> Edit profile
        </Button>
      ) : null}
    </div>
  );
}
