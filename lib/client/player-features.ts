"use client";

import * as React from "react";

/**
 * Player side-features that have no backend: captions, AI commentary and
 * alternate commentary tracks.
 *
 * These shipped reading from `lib/mock`, which held a fixed pool of caption
 * phrases and a pool of commentary lines that the player cycled on a timer over
 * whatever was playing. On a real broadcast that puts invented subtitles and
 * invented commentary on screen as if they described the stream, which is worse
 * than having no captions at all.
 *
 * The signatures are kept so the player and settings screens compile unchanged,
 * but every source is empty. An empty list means the control has nothing to
 * offer and renders nothing, so no fabricated text can reach a viewer. When a
 * real captioning or commentary service exists, this is the one file to
 * implement.
 *
 * Lite mode is different: it is a genuine local display preference with no
 * server side, so it keeps working and simply lives here now.
 */

/* ── Captions ───────────────────────────────────────────────────────────── */

export type CaptionLang = "en" | "fr" | "pt" | "ha" | "yo" | "ig" | "sw";

export interface CaptionTrack {
  lang: CaptionLang | "auto";
  label: string;
  isAuto: boolean;
  fileUrl?: string;
  source: "human" | "auto";
}

export interface CaptionLine {
  startSec: number;
  endSec: number;
  text: string;
}

/** No caption service, so no languages to offer. */
export function listCaptionLanguages(): Array<{
  lang: CaptionLang;
  label: string;
  native: string;
}> {
  return [];
}

export async function listCaptionTracks(
  _streamOrVodId: string,
): Promise<CaptionTrack[]> {
  return [];
}

export async function getCaptionLines(
  _streamOrVodId: string,
  _lang: CaptionLang,
): Promise<CaptionLine[]> {
  return [];
}

export function getCaptionPhrasesSync(_lang: CaptionLang): string[] {
  return [];
}

/* ── AI commentary ──────────────────────────────────────────────────────── */

export type AiVoicePresetId = "analyst-male" | "analyst-female" | "hype-male";

export interface AiVoicePreset {
  id: AiVoicePresetId;
  label: string;
  blurb: string;
  sample: string;
}

export interface AiCommentaryConfig {
  streamId: string | null;
  voicePreset: AiVoicePresetId;
  language: string;
  enabled: boolean;
}

const DISABLED: AiCommentaryConfig = {
  streamId: null,
  voicePreset: "analyst-male",
  language: "en",
  enabled: false,
};

export const VOICE_PRESETS: AiVoicePreset[] = [];

export async function listVoicePresets(): Promise<AiVoicePreset[]> {
  return [];
}

/** Always disabled: there is no commentary engine to enable. */
export async function getAiCommentaryConfig(
  streamId: string | null = null,
): Promise<AiCommentaryConfig> {
  return { ...DISABLED, streamId };
}

export async function setAiCommentaryConfig(
  _patch: Partial<AiCommentaryConfig>,
  streamId: string | null = null,
): Promise<AiCommentaryConfig> {
  return { ...DISABLED, streamId };
}

export function getCommentaryLines(_gameId: string): string[] {
  return [];
}

/* ── Alternate commentary tracks ────────────────────────────────────────── */

export interface CommentaryTrack {
  id: string;
  streamId: string;
  language: string;
  languageLabel: string;
  casterHandle: string;
  casterAvatarUrl: string;
  viewerCount: number;
  isOfficial: boolean;
}

export async function listCommentaryTracks(
  _streamId: string,
): Promise<CommentaryTrack[]> {
  return [];
}

/* ── Lite mode ──────────────────────────────────────────────────────────── */

const LITE_KEY = "evotv:lite-mode";

export function getLiteMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(LITE_KEY) === "1";
}

export function setLiteMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LITE_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new Event("evotv:lite-mode"));
}

/** A real preference: it lowers image and playback quality on slow connections. */
export function useLiteMode(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    setEnabled(getLiteMode());
    const sync = () => setEnabled(getLiteMode());
    window.addEventListener("evotv:lite-mode", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("evotv:lite-mode", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return [
    enabled,
    (next: boolean) => {
      setLiteMode(next);
      setEnabled(next);
    },
  ];
}
