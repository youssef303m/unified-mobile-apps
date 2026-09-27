// Audio and embedded text tracks (01-product/player.md §5.1, §5.2): labels are language names;
// a track with no language is "Track N" (live: "Audio N"). The choice applies to the current
// video only; nothing is saved (parity).
import { languageName } from "./languages";

export interface TrackInfo {
  index: number;
  title?: string;
  language?: string;
  selected?: boolean;
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
