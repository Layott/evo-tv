"use client";

import * as React from "react";
import { useParams, notFound } from "next/navigation";
import { Loader2 } from "@/components/icons";
import {
  getUserByHandle,
  listFollows,
  listTeams,
  listPlayers,
} from "@/lib/client";
import type { Profile, Team, Player } from "@/lib/types";
import { ProfileHeader } from "@/components/profile/profile-header";
import { FollowingGrid } from "@/components/profile/following-grid";
import { ActivityFeed } from "@/components/profile/activity-feed";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BackButton } from "@/components/shell/back-button";

export default function PublicProfilePage() {
  const params = useParams<{ handle: string }>();
  const handle = params?.handle;
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [missing, setMissing] = React.useState(false);

  React.useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const p = await getUserByHandle(handle);
      if (cancelled) return;
      if (!p) {
        setMissing(true);
        setLoading(false);
        return;
      }
      setProfile(p);
      const [follows, allTeams, allPlayers] = await Promise.all([
        listFollows(p.id),
        listTeams(),
        listPlayers(),
      ]);
      if (cancelled) return;
      const teamIds = new Set(
        follows.filter((f) => f.targetType === "team").map((f) => f.targetId)
      );
      const playerIds = new Set(
        follows.filter((f) => f.targetType === "player").map((f) => f.targetId)
      );
      setTeams(allTeams.filter((t) => teamIds.has(t.id)));
      setPlayers(allPlayers.filter((p) => playerIds.has(p.id)));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (missing) notFound();
  if (loading || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-4">
        <BackButton fallbackHref="/profile" />
      </div>
      <ProfileHeader profile={profile} canEdit={false} />
      <div className="mt-6">
        <Tabs defaultValue="overview">
          <TabsList className="bg-card/60">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="followed">Followed</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4 space-y-4">
            {profile.bio ? (
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <h3 className="mb-2 text-sm font-semibold text-foreground/80">About</h3>
                <p className="text-sm text-foreground/80">{profile.bio}</p>
              </div>
            ) : null}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground/80">
                Recent activity
              </h3>
              <ActivityFeed />
            </div>
          </TabsContent>
          <TabsContent value="followed" className="mt-4">
            <FollowingGrid teams={teams} players={players} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
