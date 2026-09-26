// M3U download and pasted-URL classification (02-backend/m3u.md §1, xtream.md §1).
import { ParseError } from "../errors";
import { expectOk, LARGE_DOWNLOAD_TIMEOUT_MS, send } from "../http";

import { parseM3uText, type M3uResult } from "./parser";

/**
 * parseM3uUrl: a URL with both `username=` and `password=` is an Xtream playlist; values are
 * taken as typed (text after the first "=", not decoded), as on TV.
 */
export function classifyPlaylistUrl(
  playlistUrl: string,
):
  | { playlist_type: "general"; url: string }
  | { playlist_type: "xc"; url: string; username?: string; password?: string } {
  if (!(playlistUrl.includes("username=") && playlistUrl.includes("password="))) {
    return { playlist_type: "general", url: playlistUrl };
  }
  const [base = "", query = ""] = playlistUrl.split("?");
  let username: string | undefined;
  let password: string | undefined;
  for (const pair of query.split("&")) {
    const [key = "", value] = pair.split("=");
    if (key.toLowerCase() === "username") username = value;
    if (key.toLowerCase() === "password") password = value;
  }
  return { playlist_type: "xc", url: base.replace("/get.php", ""), username, password };
}

/** Downloads the playlist text (trailing "/" stripped). `Accept: application/json` is sic (TV). */
export async function downloadM3u(url: string, signal?: AbortSignal): Promise<string> {
  const response = expectOk(
    await send({
      url: url.replace(/\/$/, ""),
      headers: { Accept: "application/json" },
      timeoutMs: LARGE_DOWNLOAD_TIMEOUT_MS,
      signal,
    }),
  );
  return response.text;
}

/** Download + parse. Throws ParseError when the text is not an M3U file. */
export async function loadM3u(
  url: string,
  options: { signal?: AbortSignal; onProgress?: (fraction: number) => void } = {},
): Promise<M3uResult> {
  const text = await downloadM3u(url, options.signal);
  const { isM3u, result } = await parseM3uText(text, options);
  if (!isM3u) throw new ParseError("Not an M3U playlist");
  return result;
}
