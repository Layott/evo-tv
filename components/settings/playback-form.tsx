"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
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
import {
  getAiCommentaryConfig,
  setAiCommentaryConfig,
  VOICE_PRESETS,
  type AiCommentaryConfig,
  type AiVoicePresetId,
} from "@/lib/client/player-features";
import { listCaptionLanguages } from "@/lib/client/player-features";

export function PlaybackForm() {
  const [quality, setQuality] = React.useState("auto");
  const [captions, setCaptions] = React.useState(false);
  const [autoplay, setAutoplay] = React.useState(true);
  const [liteMode, setLite] = useLiteMode();
  const [aiConfig, setAiConfig] = React.useState<AiCommentaryConfig | null>(null);

  const captionLangs = React.useMemo(() => listCaptionLanguages(), []);

  React.useEffect(() => {
    getAiCommentaryConfig(null).then(setAiConfig);
  }, []);

  async function patchAi(patch: Partial<AiCommentaryConfig>) {
    const next = await setAiCommentaryConfig(patch, null);
    setAiConfig(next);
    toast.success("AI commentary updated");
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Playback" description="Default player behaviour.">
        <div className="divide-y divide-neutral-800">
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

      <SectionCard
        title="AI commentary (beta)"
        description="Generate analyst-style or hype commentary when official commentary is unavailable. Toggle inside the player overflow menu on any stream."
      >
        <div className="mb-3 flex items-center gap-2 rounded-md border border-violet-500/30 bg-violet-500/5 px-3 py-1.5 text-xs text-violet-200">
          <Sparkles className="size-3.5" />
          <span>Beta - voices and lines are illustrative for the v0 build.</span>
        </div>
        <div className="divide-y divide-neutral-800">
          <SettingRow
            label="Enable AI commentary"
            description="Adds an AI track that can be toggled in-player."
          >
            <Switch
              checked={aiConfig?.enabled ?? false}
              disabled={!aiConfig}
              onCheckedChange={(v) => patchAi({ enabled: v })}
            />
          </SettingRow>
          <SettingRow label="Voice preset" description="Pick the on-air persona">
            <Select
              value={aiConfig?.voicePreset ?? "analyst-male"}
              disabled={!aiConfig}
              onValueChange={(v) => patchAi({ voicePreset: v as AiVoicePresetId })}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICE_PRESETS.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow label="Language" description="Spoken language for the AI track">
            <Select
              value={aiConfig?.language ?? "en"}
              disabled={!aiConfig}
              onValueChange={(v) => patchAi({ language: v })}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {captionLangs.map((l) => (
                  <SelectItem key={l.lang} value={l.lang}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
        {aiConfig ? (
          <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950/40 p-3 text-xs text-neutral-300">
            <div className="text-[10px] uppercase tracking-wider text-violet-300">
              Sample · {VOICE_PRESETS.find((p) => p.id === aiConfig.voicePreset)?.label}
            </div>
            <div className="mt-1 italic">
              {VOICE_PRESETS.find((p) => p.id === aiConfig.voicePreset)?.sample}
            </div>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
