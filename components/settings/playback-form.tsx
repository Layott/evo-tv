"use client";

import * as React from "react";
import { toast } from "sonner";

import { getUserPrefs, updateUserPrefs } from "@/lib/client";
import type { UserPrefs } from "@/lib/types";

import { SectionCard, SettingRow } from "./section-card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLiteMode } from "@/lib/client/player-features";
import { listCaptionLanguages } from "@/lib/client/player-features";

/**
 * Playback defaults, which now survive a reload.
 *
 * Quality, captions and autoplay each fired a toast and changed a piece of
 * React state that died with the page, so a viewer who set 480p to save data
 * was back on auto the next time they opened the app. `/api/users/me/prefs`
 * has held a `playback` object the whole time and this form never touched it.
 *
 * Lite mode is deliberately left on its own hook: it is a device decision
 * rather than an account one, and somebody on a cheap phone should not have it
 * follow them onto a desktop.
 */
export function PlaybackForm() {
  const [quality, setQuality] =
    React.useState<UserPrefs["playback"]["defaultQuality"]>("auto");
  const [captions, setCaptions] = React.useState(false);
  const [autoplay, setAutoplay] = React.useState(true);
  const [liteMode, setLite] = useLiteMode();

  React.useEffect(() => {
    let cancelled = false;
    getUserPrefs().then((p) => {
      if (cancelled || !p?.playback) return;
      setQuality(p.playback.defaultQuality ?? "auto");
      setCaptions(Boolean(p.playback.captions));
      setAutoplay(p.playback.autoplay !== false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Patch one field without clobbering the other two. */
  const savePlayback = React.useCallback(
    async (patch: Partial<UserPrefs["playback"]>, message: string) => {
      try {
        const saved = await updateUserPrefs({
          playback: { defaultQuality: quality, captions, autoplay, ...patch },
        });
        if (!saved) throw new Error("no response");
        toast.success(message);
      } catch {
        toast.error("Could not save that. Try again in a moment.");
      }
    },
    [quality, captions, autoplay],
  );

  const captionLangs = React.useMemo(() => listCaptionLanguages(), []);

  return (
    <div className="space-y-4">
      <SectionCard title="Playback" description="Default player behaviour.">
        <div className="divide-y divide-border">
          <SettingRow label="Default quality" description="What we attempt first on every stream">
            <Select
              value={quality}
              onValueChange={(v) => {
                const next = v as UserPrefs["playback"]["defaultQuality"];
                setQuality(next);
                void savePlayback({ defaultQuality: next }, `Default quality ${v}`);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="1080p">1080p</SelectItem>
                <SelectItem value="720p">720p</SelectItem>
                <SelectItem value="480p">480p</SelectItem>
                <SelectItem value="360p">360p</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow label="Captions by default" description="Turn on subtitles when available">
            <Switch
              checked={captions}
              onCheckedChange={(v) => {
                setCaptions(v);
                void savePlayback(
                  { captions: v },
                  `Captions ${v ? "enabled" : "disabled"}`,
                );
              }}
            />
          </SettingRow>
          <SettingRow label="Autoplay next" description="Queue related VODs automatically">
            <Switch
              checked={autoplay}
              onCheckedChange={(v) => {
                setAutoplay(v);
                void savePlayback({ autoplay: v }, `Autoplay ${v ? "on" : "off"}`);
              }}
            />
          </SettingRow>
          <SettingRow
            label="Lite mode"
            description="Caps video at 360p and dims thumbnails. Saves data."
          >
            <Switch
              checked={liteMode}
              onCheckedChange={(v) => {
                setLite(v);
                toast.success(`Lite mode ${v ? "enabled" : "disabled"}`);
              }}
            />
          </SettingRow>
        </div>
      </SectionCard>

    </div>
  );
}
