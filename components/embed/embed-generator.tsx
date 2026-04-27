"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Code2, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  buildEmbedSnippet,
  EMBED_SIZE_PRESETS,
  listEmbedSources,
  type EmbedConfig,
  type EmbedSource,
  type EmbedTheme,
} from "@/lib/mock/embed";
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

export function EmbedGenerator() {
  const sourcesQ = useQuery({ queryKey: ["embed", "sources"], queryFn: listEmbedSources });

  const [streamId, setStreamId] = React.useState<string>("");
  const [width, setWidth] = React.useState<number>(720);
  const [height, setHeight] = React.useState<number>(405);
  const [autoplay, setAutoplay] = React.useState(false);
  const [muted, setMuted] = React.useState(true);
  const [theme, setTheme] = React.useState<EmbedTheme>("dark");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!streamId && sourcesQ.data?.[0]) {
      setStreamId(sourcesQ.data[0].id);
    }
  }, [streamId, sourcesQ.data]);

  const config: EmbedConfig = {
    streamId,
    width,
    height,
    autoplay,
    muted,
    theme,
  };

  const snippet = React.useMemo(() => buildEmbedSnippet(config), [config]);

  const previewSrc = React.useMemo(() => {
    if (!streamId) return "";
    const params = new URLSearchParams();
    if (autoplay) params.set("autoplay", "1");
    if (muted) params.set("muted", "1");
    if (theme && theme !== "auto") params.set("theme", theme);
    const q = params.toString();
    return `/embed/player/${encodeURIComponent(streamId)}${q ? `?${q}` : ""}`;
  }, [streamId, autoplay, muted, theme]);

  function copyCode() {
    if (!navigator.clipboard) {
      toast.error("Clipboard not available");
      return;
    }
    navigator.clipboard
      .writeText(snippet)
      .then(() => {
        toast.success("Embed code copied");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Could not copy"));
  }

  const sources = sourcesQ.data ?? [];
  const grouped = {
    live: sources.filter((s) => s.kind === "live"),
    vod: sources.filter((s) => s.kind === "vod"),
  };
  const selectedSource = sources.find((s) => s.id === streamId);

  function applyPreset(preset: { width: number; height: number }) {
    setWidth(preset.width);
    setHeight(preset.height);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr] xl:grid-cols-[420px_1fr]">
      {/* Config */}
      <div className="space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="flex items-center gap-2">
          <Code2 className="size-4 text-sky-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">
            Configure
          </h2>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="emb-source" className="text-neutral-200">
            Source
          </Label>
          <Select value={streamId} onValueChange={setStreamId}>
            <SelectTrigger id="emb-source" className="bg-neutral-950/60">
              <SelectValue placeholder={sourcesQ.isLoading ? "Loading…" : "Pick a stream"} />
            </SelectTrigger>
            <SelectContent>
              {grouped.live.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-400">
                    Live now
                  </div>
                  {grouped.live.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                        {s.title}
                      </span>
                    </SelectItem>
                  ))}
                </>
              )}
              {grouped.vod.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Recent VODs
                  </div>
                  {grouped.vod.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-neutral-200">Size preset</Label>
          <div className="flex flex-wrap gap-2">
            {EMBED_SIZE_PRESETS.map((p) => {
              const active = width === p.width && height === p.height;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
                      : "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="emb-w" className="text-neutral-200">
              Width
            </Label>
            <Input
              id="emb-w"
              type="number"
              min={200}
              max={2560}
              step={10}
              value={width}
              onChange={(e) => setWidth(Math.max(200, Number(e.target.value) || 0))}
              className="bg-neutral-950/60"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emb-h" className="text-neutral-200">
              Height
            </Label>
            <Input
              id="emb-h"
              type="number"
              min={113}
              max={1440}
              step={10}
              value={height}
              onChange={(e) => setHeight(Math.max(113, Number(e.target.value) || 0))}
              className="bg-neutral-950/60"
            />
          </div>
        </div>

        <div className="space-y-3">
          <ToggleRow
            label="Autoplay"
            description="Start playing as soon as the iframe loads."
            checked={autoplay}
            onChange={setAutoplay}
          />
          <ToggleRow
            label="Start muted"
            description="Required by most browsers when autoplay is on."
            checked={muted}
            onChange={setMuted}
          />
          <div>
            <Label className="text-neutral-200">Theme</Label>
            <div className="mt-1.5 flex gap-2">
              {(["dark", "light", "auto"] as EmbedTheme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    theme === t
                      ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
                      : "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Preview + snippet */}
      <div className="space-y-5">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">
              Live preview
            </h2>
            {selectedSource && (
              <span className="text-[11px] text-neutral-500">{selectedSource.title}</span>
            )}
          </div>
          {streamId ? (
            <div className="flex items-center justify-center">
              <div
                className="overflow-hidden rounded-lg bg-black ring-1 ring-neutral-800"
                style={{
                  width: "100%",
                  maxWidth: width,
                  aspectRatio: `${width} / ${height}`,
                }}
              >
                <iframe
                  key={previewSrc}
                  src={previewSrc}
                  width="100%"
                  height="100%"
                  className="block h-full w-full"
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen
                  title="EVO TV embed preview"
                />
              </div>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-neutral-500">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">
              Embed code
            </h2>
            <Button
              size="sm"
              onClick={copyCode}
              className="bg-sky-500 font-semibold text-neutral-950 hover:bg-sky-400"
            >
              {copied ? (
                <>
                  <Check className="size-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  Copy code
                </>
              )}
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-[11px] leading-relaxed text-neutral-200">
            <code>{snippet}</code>
          </pre>
          <p className="mt-2 text-[11px] text-neutral-500">
            Paste this anywhere HTML is allowed — Notion, Webflow, Substack, your own site.
          </p>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3 cursor-pointer">
      <div>
        <div className="text-sm font-medium text-neutral-100">{label}</div>
        <div className="text-[11px] text-neutral-500">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
