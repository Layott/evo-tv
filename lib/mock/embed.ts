import { sleep } from "./_util";
import { streams } from "./streams";
import { vods } from "./vods";

export type EmbedTheme = "dark" | "light" | "auto";

export interface EmbedConfig {
  streamId: string;
  width: number;
  height: number;
  autoplay: boolean;
  muted: boolean;
  theme: EmbedTheme;
}

export interface EmbedSource {
  id: string;
  title: string;
  kind: "live" | "vod";
  thumbnailUrl: string;
}

/** Origin used in generated snippets (defaults to https://evo.tv). */
function defaultOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://evo.tv";
}

export async function listEmbedSources(): Promise<EmbedSource[]> {
  await sleep(120);
  const live: EmbedSource[] = streams
    .filter((s) => s.isLive)
    .slice(0, 8)
    .map((s) => ({
      id: s.id,
      title: s.title,
      kind: "live" as const,
      thumbnailUrl: s.thumbnailUrl,
    }));
  const recentVods: EmbedSource[] = vods.slice(0, 12).map((v) => ({
    id: v.id,
    title: v.title,
    kind: "vod" as const,
    thumbnailUrl: v.thumbnailUrl,
  }));
  return [...live, ...recentVods];
}

export function buildEmbedSnippet(config: EmbedConfig, origin?: string): string {
  const base = origin ?? defaultOrigin();
  const params = new URLSearchParams();
  if (config.autoplay) params.set("autoplay", "1");
  if (config.muted) params.set("muted", "1");
  if (config.theme && config.theme !== "auto") params.set("theme", config.theme);
  const query = params.toString();
  const src = `${base}/embed/player/${encodeURIComponent(config.streamId)}${query ? `?${query}` : ""}`;
  return [
    `<iframe`,
    `  src="${src}"`,
    `  width="${config.width}"`,
    `  height="${config.height}"`,
    `  frameborder="0"`,
    `  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"`,
    `  allowfullscreen`,
    `  title="EVO TV embedded player"`,
    `></iframe>`,
  ].join("\n");
}

export const EMBED_SIZE_PRESETS: { label: string; width: number; height: number }[] = [
  { label: "Small (480×270)", width: 480, height: 270 },
  { label: "Medium (720×405)", width: 720, height: 405 },
  { label: "Large (960×540)", width: 960, height: 540 },
  { label: "HD (1280×720)", width: 1280, height: 720 },
];
