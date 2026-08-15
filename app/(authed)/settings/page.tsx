"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  CreditCard,
  Eye,
  Globe,
  Palette,
  Play,
  UserCog,
} from "lucide-react";

import { useAuth } from "@/components/providers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountForm } from "@/components/settings/account-form";
import { NotificationsForm } from "@/components/settings/notifications-form";
import { PlaybackForm } from "@/components/settings/playback-form";
import { PrivacyForm } from "@/components/settings/privacy-form";
import { LanguageForm } from "@/components/settings/language-form";
import { AppearanceForm } from "@/components/settings/appearance-form";
import { Button } from "@/components/ui/button";

const TABS = [
  { v: "account", label: "Account", icon: UserCog },
  { v: "notifications", label: "Notifications", icon: Bell },
  { v: "playback", label: "Playback", icon: Play },
  { v: "privacy", label: "Privacy", icon: Eye },
  { v: "language", label: "Language", icon: Globe },
  { v: "appearance", label: "Appearance", icon: Palette },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const tab = search.get("tab") ?? "account";

  const email = user ? `${user.handle}@evo.tv` : "guest@evo.tv";

  function setTab(v: string) {
    const sp = new URLSearchParams(Array.from(search.entries()));
    sp.set("tab", v);
    router.replace(`/settings?${sp.toString()}`, { scroll: false });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your EVO TV experience.</p>
        </div>
        <Button asChild variant="outline" className="border-border">
          <Link href="/settings/billing">
            <CreditCard className="size-4" />
            Billing
          </Link>
        </Button>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap bg-card/60 p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.v} value={t.v} className="flex-1">
                <Icon className="size-4" />
                {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <TabsContent value="account" className="mt-5">
          <AccountForm email={email} />
        </TabsContent>
        <TabsContent value="notifications" className="mt-5">
          <NotificationsForm />
        </TabsContent>
        <TabsContent value="playback" className="mt-5">
          <PlaybackForm />
        </TabsContent>
        <TabsContent value="privacy" className="mt-5">
          <PrivacyForm />
        </TabsContent>
        <TabsContent value="language" className="mt-5">
          <LanguageForm />
        </TabsContent>
        <TabsContent value="appearance" className="mt-5">
          <AppearanceForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
