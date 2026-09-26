// Xtream URL builders (xtream.md §1, §6, §7). Q-behaviour-fixes #11: username and password
// are URL-encoded (invisible for plain credentials; fixes special characters).
import { formatYmdHm, parseWallClock } from "@/utils/epgTime";

import type { XtreamPlaylist } from "./types";

export type StreamFormat = "default" | "ts" | "m3u8";

export const apiBase = (p: XtreamPlaylist) => p.url.replace(/\/$/, "");
const creds = (p: XtreamPlaylist) =>
  [encodeURIComponent(p.username), encodeURIComponent(p.password)] as const;

export function playerApiUrl(
  p: XtreamPlaylist,
  action?: string,
  extra: Record<string, string | number> = {},
) {
  const [u, pw] = creds(p);
  let url = `${apiBase(p)}/player_api.php?username=${u}&password=${pw}`;
  if (action) url += `&action=${action}`;
  for (const [key, value] of Object.entries(extra))
    url += `&${key}=${encodeURIComponent(String(value))}`;
  return url;
}

/** Live extension: the stream_format setting, else `output=` of origin_url, else `.ts`. */
export function liveExtension(p: XtreamPlaylist, format: StreamFormat = "default"): string {
  if (format !== "default") return format;
  // As on TV: everything after "output=" (so "output=ts&x=1" does not match).
  const out = (p.origin_url ?? "").split("output=")[1] ?? "";
  if (out === "mpegts" || out === "ts") return "ts";
  if (out === "hls" || out === "m3u8") return "m3u8";
  return "ts";
}

function streamUrl(p: XtreamPlaylist, kind: "live" | "movie" | "series", id: string, ext: string) {
  const [u, pw] = creds(p);
  return `${apiBase(p)}/${kind}/${u}/${pw}/${id}.${ext}`;
}

export const liveUrl = (p: XtreamPlaylist, streamId: string, format: StreamFormat = "default") =>
  streamUrl(p, "live", streamId, liveExtension(p, format));

export const movieUrl = (p: XtreamPlaylist, streamId: string, containerExtension: string) =>
  streamUrl(p, "movie", streamId, containerExtension);

export const episodeUrl = (p: XtreamPlaylist, episodeId: string, containerExtension: string) =>
  streamUrl(p, "series", episodeId, containerExtension);

/**
 * Catch-up (xtream.md §7). `programme.start/stop` are device-local "YYYY-MM-DD HH:mm"; the
 * server wants its own wall clock, so the offset is subtracted again.
 */
export function timeshiftUrl(
  p: XtreamPlaylist,
  streamId: string,
  programme: { start: string; stop: string },
  timeDiffMin: number,
): { url: string; duration: number } | undefined {
  const start = parseWallClock(programme.start);
  const stop = parseWallClock(programme.stop);
  if (!start || !stop) return undefined;
  const serverStart = new Date(start.getTime() - timeDiffMin * 60_000);
  const startParam = formatYmdHm(serverStart)
    .replace(" ", ":")
    .replace(/:(\d{2})$/, "-$1");
  const duration = Math.floor(stop.getTime() / 60_000) - Math.floor(start.getTime() / 60_000);
  const [u, pw] = creds(p);
  return {
    duration,
    url:
      `${apiBase(p)}/streaming/timeshift.php?username=${u}&password=${pw}` +
      `&stream=${streamId}&start=${startParam}&duration=${duration}`,
  };
}

/** Java-style 32-bit string hash (String.hashCode). */
function javaHash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return h;
}

/** Key of `all_playlists_info` (xtream.md §2): hash of host_username_password, base 36. */
export function accountInfoKey(p: XtreamPlaylist): string {
  const host = p.url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return javaHash(`${host}_${p.username}_${p.password}`).toString(36);
}
