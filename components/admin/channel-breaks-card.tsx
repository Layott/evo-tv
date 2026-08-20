"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "@/components/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MediaUpload } from "@/components/admin/media-upload";
import { LowerThird, UpNextCard } from "@/components/stream/channel-overlays";
import {
  OVERLAY_STYLES,
  UP_NEXT_STYLES,
  type OverlayStyle,
  type UpNextStyle,
} from "@/lib/channel-breaks";

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
  lowerThirdStyle: OverlayStyle;
  lowerThirdUrl: string;
  upNextStyle: UpNextStyle;
  upNextUrl: string;
  upNextLeadMin: number;
  upNextSec: number;
}

/** What each layout looks like in a sentence, so the list can be read. */
const LOWER_THIRD_LABELS: Record<OverlayStyle, string> = {
  bar: "Bar · full width strip",
  slab: "Slab · time block then name",
  ticker: "Ticker · one line in brand colour",
  plate: "Plate · carries the poster",
  stack: "Stack · on now, then up next",
};

const UP_NEXT_LABELS: Record<UpNextStyle, string> = {
  centre: "Centre · name and time only",
  band: "Band · artwork with a solid band",
  split: "Split · words left, artwork right",
  countdown: "Countdown · a clock that runs",
  lineup: "Line-up · the next four",
};

/** The words the preview stands in with, so the layout can be judged. */
const PREVIEW = {
  title: "NEED FOR SPEED",
  subtitle: "Apex Legends",
  startLabel: "07:00",
  nowTitle: "Uncut and Uncensored",
  durationMin: 120,
  pillar: "esports",
  lineup: [
    { startLabel: "07:00", title: "NEED FOR SPEED" },
    { startLabel: "09:00", title: "EAFC" },
    { startLabel: "11:00", title: "OgTegs: OG Vibes & Victory Runs" },
    { startLabel: "12:00", title: "Breakfast Show with Jeremiah" },
  ],
};

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
            neither. With this off, ad breaks and the on-air card stop; the
            dropped-feed filler keeps working on its own switch below.
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
          {/*
            Not disabled with the rest.
            
            Covering an outage is not advertising on a schedule, and gating it
            behind the master switch meant an operator with a filler creative
            uploaded and breaks off got a black rectangle when the feed died.
          */}
          <Switch
            id="filler-on-drop"
            checked={draft.fillerOnDrop}
            onCheckedChange={(v) => set("fillerOnDrop", v)}
          />
          <Label htmlFor="filler-on-drop" className="text-sm">
            Cover a dropped feed with filler
            <span className="ml-1 text-xs text-muted-foreground">
              (works even with breaks off)
            </span>
          </Label>
        </div>

        {/*
          The on-air furniture, with the layout previewed as it will go out.
          The preview draws with the same two components the player uses, so
          what is chosen here cannot look different on air.
        */}
        <div className="mt-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">On-air cards</h3>
            <p className="mt-0.5 max-w-[70ch] text-xs text-muted-foreground">
              What the channel says on screen. The words come from the schedule:
              the programme name from the show, the second line from the slot,
              the time from the grid. Nothing is written per show.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Lower third</Label>
                <Select
                  value={draft.lowerThirdStyle}
                  onValueChange={(v) => set("lowerThirdStyle", v as OverlayStyle)}
                >
                  <SelectTrigger className="w-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OVERLAY_STYLES.map((style) => (
                      <SelectItem key={style} value={style}>
                        {LOWER_THIRD_LABELS[style]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                {draft.lowerThirdUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- operator artwork
                  <img
                    src={draft.lowerThirdUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-70"
                  />
                ) : null}
                <LowerThird
                  key={draft.lowerThirdStyle}
                  style={draft.lowerThirdStyle}
                  copy={{ ...PREVIEW, templateUrl: draft.lowerThirdUrl || undefined }}
                />
              </div>

              <MediaUpload
                label="Artwork behind it (optional)"
                value={draft.lowerThirdUrl}
                onChange={(url) => set("lowerThirdUrl", url)}
                kind="image"
                folder="overlays"
                hint="Wide strip, transparent PNG"
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Full screen, before a programme</Label>
                <Select
                  value={draft.upNextStyle}
                  onValueChange={(v) => set("upNextStyle", v as UpNextStyle)}
                >
                  <SelectTrigger className="w-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UP_NEXT_STYLES.map((style) => (
                      <SelectItem key={style} value={style}>
                        {UP_NEXT_LABELS[style]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                <UpNextCard
                  key={draft.upNextStyle}
                  style={draft.upNextStyle}
                  secondsToStart={252}
                  copy={{ ...PREVIEW, templateUrl: draft.upNextUrl || undefined }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="up-next-lead" className="text-sm">
                    Minutes before it plays
                  </Label>
                  <Input
                    id="up-next-lead"
                    type="number"
                    min={0}
                    max={60}
                    value={draft.upNextLeadMin}
                    onChange={(e) =>
                      set("upNextLeadMin", Math.max(0, Math.min(60, Number(e.target.value) || 0)))
                    }
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">0 turns it off</p>
                </div>
                <div>
                  <Label htmlFor="up-next-sec" className="text-sm">
                    How long it holds
                  </Label>
                  <Input
                    id="up-next-sec"
                    type="number"
                    min={3}
                    max={60}
                    value={draft.upNextSec}
                    onChange={(e) =>
                      set("upNextSec", Math.max(3, Math.min(60, Number(e.target.value) || 3)))
                    }
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">seconds, once per programme</p>
                </div>
              </div>

              <MediaUpload
                label="Artwork behind it (optional)"
                value={draft.upNextUrl}
                onChange={(url) => set("upNextUrl", url)}
                kind="image"
                folder="overlays"
                hint="16:9, 1920 by 1080"
              />
            </div>
          </div>
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
