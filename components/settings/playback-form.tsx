"use client";

import * as React from "react";
import { toast } from "sonner";

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

export function PlaybackForm() {
  const [quality, setQuality] = React.useState("auto");
  const [captions, setCaptions] = React.useState(false);
  const [autoplay, setAutoplay] = React.useState(true);
  const [liteMode, setLite] = useLiteMode();

  const captionLangs = React.useMemo(() => listCaptionLanguages(), []);

  return (
    <div className="space-y-4">
      <SectionCard title="Playback" description="Default player behaviour.">
        <div className="divide-y divide-border">
          <SettingRow label="Default quality" description="What we attempt first on every stream">
            <Select
              value={quality}
              onValueChange={(v) => {
                setQuality(v);
                toast.success(`Default quality ${v}`);
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
                toast.success(`Captions ${v ? "enabled" : "disabled"}`);
              }}
            />
          </SettingRow>
          <SettingRow label="Autoplay next" description="Queue related VODs automatically">
            <Switch
              checked={autoplay}
              onCheckedChange={(v) => {
                setAutoplay(v);
                toast.success(`Autoplay ${v ? "on" : "off"}`);
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
