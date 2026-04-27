"use client";

import * as React from "react";
import Image from "next/image";
import { Edit, MapPin, ShieldCheck, Star } from "lucide-react";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  profile: Profile;
  onEdit?: () => void;
  canEdit?: boolean;
}

export function ProfileHeader({ profile, onEdit, canEdit = false }: Props) {
  const isPremium = profile.role === "premium";
  const isAdmin = profile.role === "admin";
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={canEdit ? onEdit : undefined}
        disabled={!canEdit}
        className="relative shrink-0 self-start focus:outline-none"
        aria-label={canEdit ? "Edit avatar" : "Avatar"}
      >
        <Image
          src={profile.avatarUrl}
          alt={profile.displayName}
          width={96}
          height={96}
          className="size-24 rounded-full border-2 border-neutral-700 object-cover"
        />
        {canEdit ? (
          <span className="absolute -bottom-1 -right-1 rounded-full border border-neutral-700 bg-neutral-800 p-1.5">
            <Edit className="size-3.5 text-sky-400" />
          </span>
        ) : null}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-bold text-neutral-50">
            {profile.displayName}
          </h1>
          {isPremium ? (
            <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-300">
              <Star className="size-3" /> Premium
            </Badge>
          ) : null}
          {isAdmin ? (
            <Badge className="border-sky-500/40 bg-sky-500/15 text-sky-300">
              <ShieldCheck className="size-3" /> Admin
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-neutral-400">@{profile.handle}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" /> {profile.country}
          </span>
          <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
        </div>
        {profile.bio ? (
          <p className="mt-3 max-w-prose text-sm text-neutral-300">{profile.bio}</p>
        ) : null}
      </div>
      {canEdit ? (
        <Button
          onClick={onEdit}
          variant="outline"
          className="self-start border-sky-500/40 text-sky-300 hover:bg-sky-500/10"
        >
          <Edit className="size-4" /> Edit profile
        </Button>
      ) : null}
    </div>
  );
}
