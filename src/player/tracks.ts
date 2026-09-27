// Audio and embedded text tracks (01-product/player.md §5.1, §5.2): labels are language names;
// a track with no language is "Track N" (live: "Audio N"). The choice applies to the current
// video only; nothing is saved (parity).
import { languageName } from "./languages";

export interface TrackInfo {
  index: number;
  title?: string;
  language?: string;
  selected?: boolean;
  /** The MIME type (react-native-video's `type`). */
  type?: string | null;
}

export interface TrackOption {
  index: number;
  label: string;
  selected: boolean;
}

export type UnnamedTrack = (n: number) => string;

export function trackOptions(
  tracks: readonly TrackInfo[],
  unnamed: UnnamedTrack,
  uiLanguage: string,
): TrackOption[] {
  return tracks.map((track, i) => {
    const name = languageName(track.language, uiLanguage);
    const title = track.title?.trim();
    const label =
      name && title && title.toLowerCase() !== name.toLowerCase()
        ? `${name} · ${title}`
        : (name ?? title ?? unnamed(i + 1));
    return { index: track.index, label, selected: track.selected ?? false };
  });
}

/** The TV refuses the audio picker before the media is ready, and when there are no tracks. */
export function audioPickerState(
  loaded: boolean,
  tracks: readonly TrackInfo[],
): "not_loaded" | "none" | "ok" {
  if (!loaded) return "not_loaded";
  return tracks.length === 0 ? "none" : "ok";
}

/** Formats phones often cannot decode without a licensed decoder (no FFmpeg in v1, D-070). */
const LICENSED_AUDIO = new Set([
  "audio/ac3",
  "audio/eac3",
  "audio/eac3-joc",
  "audio/ac4",
  "audio/true-hd",
  "audio/vnd.dts",
  "audio/vnd.dts.hd",
  "audio/vnd.dts.uhd",
]);

/**
 * Q-ffmpeg-audio: the video has audio, but the player selected none of it and every track is a
 * Dolby or DTS format, so this phone has no decoder for it and plays the picture in silence.
 */
export function audioUnplayable(tracks: readonly TrackInfo[]): boolean {
  return (
    tracks.length > 0 &&
    tracks.every((t) => !t.selected && LICENSED_AUDIO.has((t.type ?? "").toLowerCase()))
  );
}
