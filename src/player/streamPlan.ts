// What ExoPlayer is told about a stream (01-product/player.md §2.6). One engine replaces the TV's
// fallback chain; its spirit stays: an explicit type when the URL gives one, and for URLs that
// could be TS or HLS (extension-less catch-up and Stalker links, live .ts), progressive first and
// HLS once if the first frame never comes.
import type { BufferConfig } from "react-native-video";

export type StreamKind = "hls" | "dash" | "progressive";

/** Complete-file containers: no fallback (§2.2 rule 1). */
const COMPLETE_FILES = [
  ".mkv",
  ".mp4",
  ".m4v",
  ".mov",
  ".avi",
  ".wmv",
  ".webm",
  ".3gp",
  ".mpg",
  ".mpeg",
];

/** The URL path in lower case, without query and fragment. */
export function urlPath(url: string): string {
  const noFragment = url.split("#")[0] ?? "";
  const noQuery = noFragment.split("?")[0] ?? "";
  const afterScheme = noQuery.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "");
  return afterScheme.toLowerCase();
}

/** The attempts for one play, in order (§2.6 point 1). */
export function playbackPlan(url: string): StreamKind[] {
  const path = urlPath(url);
  if (path.endsWith(".m3u8")) return ["hls"];
  if (path.endsWith(".mpd")) return ["dash"];
  if (COMPLETE_FILES.some((ext) => path.endsWith(ext))) return ["progressive"];
  return ["progressive", "hls"];
}

/**
 * react-native-video's `source.type` (an extension it passes to Media3's inferContentType).
 * Progressive is forced with "mp4", which Media3 treats as "other": the extractor still sniffs the
 * real container (TS, MKV, MP4...).
 */
export function sourceType(kind: StreamKind): string {
  if (kind === "hls") return "m3u8";
  if (kind === "dash") return "mpd";
  return "mp4";
}

/** §2.6 point 5: close to the TV's 60 s forward buffer, starting faster. */
export const BUFFER_CONFIG: BufferConfig = {
  minBufferMs: 15_000,
  maxBufferMs: 60_000,
  bufferForPlaybackMs: 2_500,
  bufferForPlaybackAfterRebufferMs: 5_000,
};
