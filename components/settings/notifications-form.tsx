"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { SectionCard, SettingRow } from "./section-card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export function NotificationsForm() {
  const [state, setState] = React.useState({
    goLive: true,
    eventReminder: true,
    newVod: true,
    weeklyDigest: false,
  });
  const [saving, setSaving] = React.useState(false);

  function set<K extends keyof typeof state>(key: K, value: boolean) {
    setState((s) => ({ ...s, [key]: value }));
  }

  async function save() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    toast.success("Notification preferences saved");
  }

  return (
    <SectionCard
      title="Notifications"
      description="Choose what lands in your EVO TV inbox and email."
    >
      <div className="divide-y divide-border">
        <SettingRow label="Stream goes live" description="Teams & streamers you follow">
          <Switch checked={state.goLive} onCheckedChange={(v) => set("goLive", v)} />
        </SettingRow>
        <SettingRow label="Event reminders" description="Tournaments on your watchlist">
          <Switch
            checked={state.eventReminder}
            onCheckedChange={(v) => set("eventReminder", v)}
          />
        </SettingRow>
        <SettingRow label="New VOD" description="When fresh content is posted">
          <Switch checked={state.newVod} onCheckedChange={(v) => set("newVod", v)} />
        </SettingRow>
        <SettingRow label="Weekly digest" description="Email every Monday">
          <Switch
            checked={state.weeklyDigest}
            onCheckedChange={(v) => set("weeklyDigest", v)}
          />
        </SettingRow>
      </div>
      <Button
        onClick={save}
        disabled={saving}
        className="mt-4 bg-sky-500 text-black hover:bg-sky-500/90"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        Save preferences
      </Button>
    </SectionCard>
  );
}
