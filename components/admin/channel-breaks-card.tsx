"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "@/components/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * The rhythm of the always-on channel, in one card.
 *
 * These four numbers decide when a viewer is interrupted, so they belong where
 * the ads are rather than buried in a settings page. Zero is a real value on
 * both intervals: it turns that one thing off and leaves the other running,
 * which is how you run the on-air card without ads, or the reverse.
 */

interface Breaks {
  enabled: boolean;
  adIntervalMin: number;
  adMaxSec: number;
  overlayIntervalMin: number;
  overlayDurationSec: number;
  fillerOnDrop: boolean;
}

const FIELDS: {
  key: keyof Omit<Breaks, "enabled" | "fillerOnDrop">;
  label: string;
  hint: string;
  min: number;
  max: number;
}[] = [
  {
    key: "adIntervalMin",
    label: "Minutes between ad breaks",
    hint: "0 turns breaks off",
    min: 0,
    max: 240,
  },
  {
    key: "adMaxSec",
    label: "Longest an ad may hold the screen",
    hint: "seconds, then the live feed returns whatever the file does",
    min: 5,
    max: 180,
  },
  {
    key: "overlayIntervalMin",
    label: "Minutes between on-air cards",
    hint: "0 turns the card off",
    min: 0,
    max: 240,
  },
  {
    key: "overlayDurationSec",
    label: "How long the card stays",
    hint: "seconds",
    min: 3,
    max: 60,
  },
];

export function ChannelBreaksCard() {
  const qc = useQueryClient();
  const [draft, setDraft] = React.useState<Breaks | null>(null);

  const { data } = useQuery({
    queryKey: ["admin", "channel-breaks"],
    queryFn: async (): Promise<Breaks> => {
      const res = await fetch("/api/admin/channel-breaks", { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
  });

  React.useEffect(() => {
    if (data && !draft) setDraft(data);
  }, [data, draft]);

  const save = useMutation({
    mutationFn: async (next: Breaks) => {
      const res = await fetch("/api/admin/channel-breaks", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast.success("Channel breaks saved");
      void qc.invalidateQueries({ queryKey: ["admin", "channel-breaks"] });
    },
    onError: () => toast.error("Could not save the channel breaks"),
  });

  if (!draft) {
    return (
      <div className="mb-6 rounded-2xl border border-border bg-card/40 p-5">
        <p className="text-sm text-muted-foreground">Loading channel breaks…</p>
      </div>
    );
  }

  const set = <K extends keyof Breaks>(key: K, value: Breaks[K]) =>
    setDraft({ ...draft, [key]: value });

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card/40 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Channel breaks</h2>
          <p className="mt-0.5 max-w-[60ch] text-sm text-muted-foreground">
            Applies to the always-on channel only. Ads come from the{" "}
            <strong>Channel break</strong> placement, and whatever covers a dropped
            feed comes from <strong>Filler</strong>. Anyone on a paid plan sees
            neither.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="breaks-enabled" className="text-sm">
            {draft.enabled ? "On" : "Off"}
          </Label>
          <Switch
            id="breaks-enabled"
            checked={draft.enabled}
            onCheckedChange={(v) => set("enabled", v)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <Label htmlFor={f.key} className="text-sm">
              {f.label}
            </Label>
            <Input
              id={f.key}
              type="number"
              min={f.min}
              max={f.max}
              value={draft[f.key]}
              disabled={!draft.enabled}
              onChange={(e) =>
                set(
                  f.key,
                  Math.max(f.min, Math.min(f.max, Number(e.target.value) || 0)),
                )
              }
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">{f.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="filler-on-drop"
            checked={draft.fillerOnDrop}
            disabled={!draft.enabled}
            onCheckedChange={(v) => set("fillerOnDrop", v)}
          />
          <Label htmlFor="filler-on-drop" className="text-sm">
            Cover a dropped feed with filler
          </Label>
        </div>

        <Button
          onClick={() => save.mutate(draft)}
          disabled={save.isPending}
          className="bg-sky-500 text-ink hover:bg-sky-500/90"
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save channel breaks
        </Button>
      </div>
    </div>
  );
}
