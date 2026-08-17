"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "@/components/icons";

import { SectionCard, SettingRow } from "./section-card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useWebPush } from "@/hooks/use-web-push";

/**
 * This screen used to hold four switches in React state and a save button that
 * slept for half a second and said "saved". `/api/users/me/prefs` had been
 * there the whole time, with a `notifOptIn` field of exactly these four keys,
 * so the preferences are read and written for real now.
 *
 * The browser push row above them is the switch that decides whether a
 * notification can leave the building at all.
 */

type NotifOptIn = {
  goLive: boolean;
  eventReminder: boolean;
  newVod: boolean;
  weeklyDigest: boolean;
};

const FALLBACK: NotifOptIn = {
  goLive: true,
  eventReminder: true,
  newVod: false,
  weeklyDigest: true,
};

const ROWS: { key: keyof NotifOptIn; label: string; description: string }[] = [
  {
    key: "goLive",
    label: "Stream goes live",
    description: "Channels and teams you follow",
  },
  {
    key: "eventReminder",
    label: "Event reminders",
    description: "Anything you set a reminder for in the schedule",
  },
  {
    key: "newVod",
    label: "New video",
    description: "When a show you watch posts an episode",
  },
  {
    key: "weeklyDigest",
    label: "Weekly digest",
    description: "One email on Mondays",
  },
];

/** What the browser row says, and whether its switch can move. */
function pushCopy(state: ReturnType<typeof useWebPush>["state"]): {
  description: string;
  disabled: boolean;
} {
  switch (state) {
    case "loading":
      return { description: "Checking this browser", disabled: true };
    case "unsupported":
      return {
        description: "This browser cannot show notifications",
        disabled: true,
      };
    case "denied":
      return {
        description:
          "Blocked in your browser settings. Allow notifications for this site, then come back.",
        disabled: true,
      };
    case "on":
      return { description: "This browser is set up to receive them", disabled: false };
    default:
      return {
        description: "Get alerts on this device, even when the tab is closed",
        disabled: false,
      };
  }
}

export function NotificationsForm() {
  const push = useWebPush();
  const [state, setState] = React.useState<NotifOptIn | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/users/me/prefs");
        if (!res.ok) throw new Error(String(res.status));
        const prefs = (await res.json()) as { notifOptIn?: Partial<NotifOptIn> };
        if (!cancelled) setState({ ...FALLBACK, ...(prefs.notifOptIn ?? {}) });
      } catch {
        // An unreachable prefs endpoint should not leave the card empty; show
        // the defaults and let the save report the real failure.
        if (!cancelled) setState(FALLBACK);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof NotifOptIn>(key: K, value: boolean) {
    setState((s) => (s ? { ...s, [key]: value } : s));
  }

  async function save() {
    if (!state) return;
    setSaving(true);
    try {
      const res = await fetch("/api/users/me/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifOptIn: state }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success("Notification preferences saved");
    } catch {
      toast.error("Could not save your preferences. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePush(next: boolean) {
    if (next) {
      const ok = await push.enable();
      if (ok) toast.success("Notifications on for this browser");
      else if (push.state === "denied") {
        toast.error("Your browser is blocking notifications for this site");
      }
    } else {
      await push.disable();
      toast.success("Notifications off for this browser");
    }
  }

  const copy = pushCopy(push.state);

  return (
    <SectionCard
      title="Notifications"
      description="Choose what lands in your EVO TV inbox, on this device, and in your email."
    >
      <div className="divide-y divide-border">
        <SettingRow label="Notifications on this browser" description={copy.description}>
          <div className="flex items-center gap-2">
            {push.busy ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : null}
            <Switch
              checked={push.state === "on"}
              disabled={copy.disabled || push.busy}
              onCheckedChange={(v) => void togglePush(v)}
            />
          </div>
        </SettingRow>

        {ROWS.map((row) => (
          <SettingRow key={row.key} label={row.label} description={row.description}>
            <Switch
              checked={state ? state[row.key] : false}
              disabled={!state}
              onCheckedChange={(v) => set(row.key, v)}
            />
          </SettingRow>
        ))}
      </div>

      {push.error ? (
        <p className="mt-3 text-xs text-destructive">{push.error}</p>
      ) : null}

      <Button
        onClick={save}
        disabled={saving || !state}
        className="mt-4 bg-sky-500 text-black hover:bg-sky-500/90"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        Save preferences
      </Button>
    </SectionCard>
  );
}
