"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Settings, Bell, ShoppingBag } from "lucide-react";
import { useAuth } from "@/components/providers";
import {
  listFollows,
  listTeams,
  listPlayers,
  listVods,
  getActiveSubscription,
} from "@/lib/client";
import type { Team, Player, Vod, Subscription, Profile } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ProfileHeader } from "@/components/profile/profile-header";
import { EditProfileModal } from "@/components/profile/edit-profile-modal";
import { StatsRow } from "@/components/profile/stats-row";
import { FollowingGrid } from "@/components/profile/following-grid";
import { WatchHistoryList } from "@/components/profile/watch-history-list";
import { SubscriptionPanel } from "@/components/profile/subscription-panel";
import { ActivityFeed } from "@/components/profile/activity-feed";

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [edit, setEdit] = React.useState(false);
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [vods, setVods] = React.useState<Vod[]>([]);
  const [sub, setSub] = React.useState<Subscription | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [follows, allTeams, allPlayers, allVods, activeSub] = await Promise.all([
        listFollows(user.id),
        listTeams(),
        listPlayers(),
        listVods({ limit: 10 }),
        getActiveSubscription(user.id),
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
      setVods(allVods);
      setSub(activeSub);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const subSinceLabel = sub
    ? `since ${new Date(sub.createdAt).toLocaleDateString()}`
    : null;

  const handleSave = (patch: Partial<Profile>) => {
    updateProfile(patch);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-foreground">Your profile</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="border-border">
            <Link href="/notifications">
              <Bell className="size-4" /> Notifications
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-border">
            <Link href="/profile/orders">
              <ShoppingBag className="size-4" /> Orders
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-border">
            <Link href="/settings">
              <Settings className="size-4" /> Settings
            </Link>
          </Button>
        </div>
      </div>
      <ProfileHeader
        profile={user}
        canEdit
        onEdit={() => setEdit(true)}
      />
      <div className="mt-6">
        <StatsRow
          followingCount={teams.length + players.length}
          watchHours="47h this month"
          subSince={subSinceLabel}
        />
      </div>
      <div className="mt-6">
        <Tabs defaultValue="overview">
          <TabsList className="bg-card/60">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="followed">Followed</TabsTrigger>
            <TabsTrigger value="history">Watch history</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4 space-y-4">
            {user.bio ? (
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <h3 className="mb-2 text-sm font-semibold text-foreground/80">About</h3>
                <p className="text-sm text-foreground/80">{user.bio}</p>
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
            {loading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <FollowingGrid teams={teams} players={players} />
            )}
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            {loading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <WatchHistoryList vods={vods} />
            )}
          </TabsContent>
          <TabsContent value="subscription" className="mt-4">
            {loading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <SubscriptionPanel subscription={sub} />
            )}
          </TabsContent>
        </Tabs>
      </div>
      <EditProfileModal
        open={edit}
        onOpenChange={setEdit}
        profile={user}
        onSave={handleSave}
      />
    </div>
  );
}
