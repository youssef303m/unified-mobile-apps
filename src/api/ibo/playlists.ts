// Parsing of the backend's `urls[]` entries (ibo-api-reference.md #4) and the merge of a saved
// playlist (#5-7 `mergeSavedPlaylist`).
import { asObject, num, optStr, str, type JsonObject } from "../parse";

import type { Playlist, PlaylistType } from "./types";

const TYPES: readonly PlaylistType[] = ["xc", "general", "stalker", "code"];
const PLAYLIST_PATH = /(.*?)\/playlist\/(.*?)\/(.*?)\/(.*?)(?:\/(.*?))?\/?$/;

function playlistType(value: unknown): PlaylistType {
  const t = str(value);
  return (TYPES as readonly string[]).includes(t) ? (t as PlaylistType) : "general";
}

/**
 * A URL containing `/playlist/` is converted to an Xtream entry (xtream.md §1):
 * host/playlist/user/pass/type[/output] → url = host, origin_url = the get.php URL.
 */
export function convertPlaylistPath(entry: Playlist): Playlist {
  if (!entry.url.includes("playlist")) return entry;
  const m = PLAYLIST_PATH.exec(entry.url);
  if (!m) return entry;
  const [, host = "", username = "", password = "", type = "", output = ""] = m;
  return {
    ...entry,
    url: host,
    username,
    password,
    playlist_type: "xc",
    origin_type: "xc",
    origin_url: `${host}/get.php?username=${username}&password=${password}&type=${type}&output=${output}`,
  };
}

export function parsePlaylist(value: unknown): Playlist {
  const o = asObject(value);
  const entry: Playlist = {
    id: str(o.id) || str(o._id),
    playlist_name: optStr(o.playlist_name),
    playlist_type: playlistType(o.playlist_type),
    url: str(o.url),
    username: optStr(o.username),
    password: optStr(o.password),
    origin_type: optStr(o.origin_type),
    origin_url: optStr(o.origin_url),
    is_protected: num(o.is_protected),
    pin: optStr(o.pin),
    expiration_date: optStr(o.expiration_date),
    status: optStr(o.status),
    auth: optStr(o.auth),
    fetched_at: optStr(o.fetched_at),
    portal_name: optStr(o.portal_name),
    portal_address: optStr(o.portal_address),
    portal_fallback_address: optStr(o.portal_fallback_address),
    stalker_mac_address: optStr(o.stalker_mac_address) ?? optStr(o.stalker_mac),
  };
  return convertPlaylistPath(entry);
}

/** mergeSavedPlaylist: the server's copy over the local entry. */
export function mergeSavedPlaylist(local: Playlist, saved: JsonObject | undefined): Playlist {
  if (!saved) return local;
  const merged: Playlist = { ...local, id: str(saved._id) || str(saved.id) || local.id };
  const url = optStr(saved.url);
  if (url) {
    merged.url = url;
    merged.origin_url = url;
  }
  for (const key of [
    "playlist_name",
    "portal_name",
    "portal_address",
    "portal_fallback_address",
    "stalker_mac_address",
  ] as const) {
    const v = optStr(saved[key]);
    if (v) merged[key] = v;
  }
  if (optStr(saved.playlist_type)) merged.playlist_type = playlistType(saved.playlist_type);
  if (saved.username !== undefined) merged.username = str(saved.username);
  if (saved.password !== undefined) merged.password = str(saved.password);
  if (saved.is_protected !== undefined) merged.is_protected = num(saved.is_protected);
  if (saved.pin !== undefined) merged.pin = str(saved.pin);
  return merged;
}
