import { sleep } from "./_util";
import { chatAvatar } from "./_media";
import { streams } from "./streams";

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

const TRACK_TEMPLATES: Array<Pick<CommentaryTrack, "language" | "languageLabel" | "casterHandle"> & {
  isOfficial: boolean;
  baseShare: number;
}> = [
  { language: "en", languageLabel: "English", casterHandle: "caster_riley", isOfficial: true, baseShare: 0.62 },
  { language: "fr", languageLabel: "French", casterHandle: "caster_amadou", isOfficial: true, baseShare: 0.16 },
  { language: "pcm", languageLabel: "Pidgin", casterHandle: "caster_obi", isOfficial: false, baseShare: 0.1 },
  { language: "sw", languageLabel: "Swahili", casterHandle: "caster_zainab", isOfficial: true, baseShare: 0.07 },
  { language: "yo", languageLabel: "Yoruba", casterHandle: "caster_funke", isOfficial: false, baseShare: 0.03 },
  { language: "ha", languageLabel: "Hausa", casterHandle: "caster_isa", isOfficial: false, baseShare: 0.02 },
];

function buildForStream(streamId: string, totalViewers: number): CommentaryTrack[] {
  return TRACK_TEMPLATES.map((t, i) => ({
    id: `commentary_${streamId}_${t.language}`,
    streamId,
    language: t.language,
    languageLabel: t.languageLabel,
    casterHandle: t.casterHandle,
    casterAvatarUrl: chatAvatar(t.casterHandle + "_" + i),
    viewerCount: Math.max(120, Math.round(totalViewers * t.baseShare)),
    isOfficial: t.isOfficial,
  }));
}

const tracksByStream: Record<string, CommentaryTrack[]> = {};
streams.forEach((s) => {
  // Major streams get full set; smaller ones only the top few.
  const isMajor = s.viewerCount > 5_000;
  const all = buildForStream(s.id, s.viewerCount || 1_000);
  tracksByStream[s.id] = isMajor ? all : all.slice(0, 4);
});

export async function listCommentaryTracks(streamId: string): Promise<CommentaryTrack[]> {
  await sleep(60);
  return tracksByStream[streamId] ?? buildForStream(streamId, 800).slice(0, 4);
}
