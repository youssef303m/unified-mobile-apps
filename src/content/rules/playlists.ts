// B. Choosing the playlist at startup, C. playlists and portals management, D. switching
// (01-product/business-rules.md R-020…R-043).
import { AuthError, type ApiError } from "@/api/errors";
import { classifyPlaylistUrl } from "@/api/m3u/client";
import type { Playlist, PlaylistType } from "@/api/ibo/types";
import type { StalkerProfile } from "@/api/stalker/client";
import { MAC_PATTERN, randomVirtualMac, type StbProfileKey } from "@/api/stalker/portal";
import type { KeyValueStore } from "@/api/store";
import { globalKeys, P, unprefixedKeys } from "@/storage/keys";

// ---------- B ----------

export type StartupChoice = { kind: "load"; playlist: Playlist } | { kind: "choose" };

/**
 * R-020: "automatic" loads the saved playlist, or the first one if that id is gone;
 * "playlist_first" opens the chooser every launch.
 */
export function startupPlaylist(
  choice: "automatic" | "playlist_first",
  savedId: string | undefined,
  playlists: readonly Playlist[],
): StartupChoice {
  if (choice === "playlist_first" || playlists.length === 0) return { kind: "choose" };
  const saved = playlists.find((p) => p.id === savedId);
  return { kind: "load", playlist: saved ?? (playlists[0] as Playlist) };
}

/**
 * R-021: with Auto Switch on, a failed playlist is followed by the next untried one in list
 * order; undefined when all have failed (or Auto Switch is off).
 */
export function nextPlaylistAfterFailure(
  playlists: readonly Playlist[],
  tried: ReadonlySet<string>,
  autoSwitch: boolean,
): Playlist | undefined {
  if (!autoSwitch) return undefined;
  return playlists.find((p) => !tried.has(p.id));
}

/** R-022: where a load failure lands. */
export function failureScreen(type: PlaylistType): "playlists" | "portals" {
  return type === "stalker" ? "portals" : "playlists";
}

export type PlaylistErrorKey =
  "playlist_expired" | "playlist_generic" | "portal_expired" | "portal_unavailable";

/** R-023 / R-026: the TV message for a login failure. */
export function loginErrorKey(error: ApiError): PlaylistErrorKey {
  if (error instanceof AuthError) {
    if (error.reason === "provider_expired") return "playlist_expired";
    if (error.reason === "portal_expired") return "portal_expired";
    if (error.reason === "portal_unavailable") return "portal_unavailable";
  }
  return "playlist_generic";
}

/** R-026: a portal profile that is not OK, expired or unregistered is a failure. */
export function stalkerLoginOutcome(
  profile: StalkerProfile | undefined,
): "ok" | "expired" | "unavailable" {
  if (!profile) return "unavailable";
  if (profile.expired || !profile.registered) return "expired";
  if (profile.status !== 1) return "unavailable";
  return "ok";
}

/** R-027: the playlist expiry label; `null` exp_date = unlimited. */
export function playlistExpiry(
  expireDate: string | null,
): { kind: "unlimited" } | { kind: "date"; date: string } {
  return expireDate === null ? { kind: "unlimited" } : { kind: "date", date: expireDate };
}

// ---------- C ----------

export interface LocalData {
  playlist_urls: Playlist[];
  remove_ids: string[];
}

export function readLocalData(store: KeyValueStore): LocalData {
  try {
    const raw = JSON.parse(store.get(globalKeys.localData) ?? "{}") as Partial<LocalData>;
    return { playlist_urls: raw.playlist_urls ?? [], remove_ids: raw.remove_ids ?? [] };
  } catch {
    return { playlist_urls: [], remove_ids: [] };
  }
}

function writeLocalData(store: KeyValueStore, data: LocalData): void {
  if (data.playlist_urls.length === 0 && data.remove_ids.length === 0)
    store.remove(globalKeys.localData);
  else store.set(globalKeys.localData, JSON.stringify(data));
}

/** R-030: a save the backend did not take is kept locally and queued for the next launch. */
export function queueFailedSave(store: KeyValueStore, entry: Playlist): void {
  const data = readLocalData(store);
  data.playlist_urls = [...data.playlist_urls.filter((p) => p.id !== entry.id), entry];
  writeLocalData(store, data);
}

export function queueFailedDelete(store: KeyValueStore, id: string): void {
  const data = readLocalData(store);
  if (!data.remove_ids.includes(id)) data.remove_ids.push(id);
  writeLocalData(store, data);
}

/**
 * R-030: replays the queue (adds/updates, then deletes). Accepted entries leave the queue and
 * replace their local copy; a new server id renames every per-playlist key.
 */
export async function replayQueue(
  store: KeyValueStore,
  save: (entry: Playlist) => Promise<Playlist | undefined>,
  remove: (id: string) => Promise<boolean>,
): Promise<Playlist[]> {
  const data = readLocalData(store);
  const accepted: Playlist[] = [];
  const stillQueued: Playlist[] = [];
  for (const entry of data.playlist_urls) {
    const saved = await save(entry);
    if (!saved) {
      stillQueued.push(entry);
      continue;
    }
    if (saved.id !== entry.id) renamePlaylistKeys(store, entry.id, saved.id);
    accepted.push(saved);
  }
  const remaining: string[] = [];
  for (const id of data.remove_ids) if (!(await remove(id))) remaining.push(id);
  writeLocalData(store, { playlist_urls: stillQueued, remove_ids: remaining });
  return accepted;
}

/** New local entries get the id `non_saved_<unix seconds>`. */
export function newLocalPlaylistId(now: Date = new Date()): string {
  return `non_saved_${Math.floor(now.getTime() / 1000)}`;
}

/**
 * R-030: renames every prefixed per-playlist key from the old id to the new one, and the
 * selected playlist id. Only the id part right after the prefix is replaced, so unrelated keys
 * that happen to contain the id are not touched (docs/decisions.md D-036).
 */
export function renamePlaylistKeys(store: KeyValueStore, oldId: string, newId: string): void {
  const oldPrefix = `${P}${oldId}`;
  for (const key of store.keys()) {
    if (!key.startsWith(oldPrefix)) continue;
    const rest = key.slice(oldPrefix.length);
    // The id must end right there: "…4821live_favourite" / "…4821_saved_vod_times".
    if (!/^(live|vod|series|_)/.test(rest)) continue;
    const value = store.get(key);
    if (value !== undefined) store.set(`${P}${newId}${rest}`, value);
    store.remove(key);
  }
  if (store.get(globalKeys.playlistId) === oldId) store.set(globalKeys.playlistId, newId);
}

export interface XtreamForm {
  name: string;
  url: string;
  username: string;
  password: string;
}

export type XtreamFormError = "missing_fields";

/**
 * R-031: name, URL, username and password are required. A pasted get.php URL with username and
 * password is converted to host + credentials.
 */
export function normalizeXtreamForm(form: XtreamForm): {
  value?: XtreamForm;
  error?: XtreamFormError;
} {
  const trimmed = {
    name: form.name.trim(),
    url: form.url.trim(),
    username: form.username.trim(),
    password: form.password.trim(),
  };
  const pasted = classifyPlaylistUrl(trimmed.url);
  if (pasted.playlist_type === "xc") {
    trimmed.url = pasted.url;
    trimmed.username ||= pasted.username ?? "";
    trimmed.password ||= pasted.password ?? "";
  }
  if (!trimmed.name || !trimmed.url || !trimmed.username || !trimmed.password)
    return { error: "missing_fields" };
  return { value: trimmed };
}

/** R-033: deleting is refused when only one playlist or portal exists. */
export function canDeletePlaylist(playlists: readonly Playlist[]): boolean {
  return playlists.length > 1;
}

/** R-034: deleting the active entry clears the selection; a deleted active portal → Playlists. */
export function afterDelete(
  selectedId: string | undefined,
  deleted: Playlist,
): { clearSelection: boolean; goTo?: "playlists" } {
  if (selectedId !== deleted.id) return { clearSelection: false };
  return deleted.playlist_type === "stalker"
    ? { clearSelection: true, goTo: "playlists" }
    : { clearSelection: true };
}

/** R-035: playlists (Xtream/M3U) and portals (Stalker) are listed separately. */
export function splitPlaylists(all: readonly Playlist[]): {
  playlists: Playlist[];
  portals: Playlist[];
} {
  return {
    playlists: all.filter((p) => p.playlist_type !== "stalker"),
    portals: all.filter((p) => p.playlist_type === "stalker"),
  };
}

/** R-036 (Q-m3u-in-app): the types a user can add in the app. */
export const IN_APP_PLAYLIST_TYPES: readonly PlaylistType[] = ["xc", "stalker"];

/** R-037: provider account info is refreshed when older than 5 minutes. */
export const ACCOUNT_INFO_MAX_AGE_MS = 5 * 60_000;

export function accountInfoIsFresh(fetchedAt: string | undefined, now: Date = new Date()): boolean {
  if (!fetchedAt) return false;
  const t = Date.parse(fetchedAt);
  return !Number.isNaN(t) && now.getTime() - t < ACCOUNT_INFO_MAX_AGE_MS;
}

/** R-037: "auth" as reported to the backend (a provider auth of 0 is "Unknown" on TV). */
export function reportedAuth(auth: unknown): "Active" | "Inactive" | "Unknown" {
  if (auth === 1 || auth === "1") return "Active";
  return auth ? "Inactive" : "Unknown";
}

export type StalkerMacPrefix = "00:1A:79" | "00:1C:1D";

/**
 * R-038: the virtual portal MAC = prefix + last 3 bytes of the device's hardware MAC; with none
 * (always on a phone, stalker.md §1), a random `00:1A:79:XX:XX:XX` generated once and kept under
 * the unprefixed `stalker_mac` key.
 */
export function virtualStalkerMac(
  store: KeyValueStore,
  prefix: StalkerMacPrefix = "00:1A:79",
  hardwareMac?: string,
): string {
  let base = hardwareMac?.toUpperCase().replace(/-/g, ":");
  if (!base || !MAC_PATTERN.test(base)) {
    base = store.get(unprefixedKeys.stalkerMac);
    if (!base || !MAC_PATTERN.test(base)) {
      base = randomVirtualMac();
      store.set(unprefixedKeys.stalkerMac, base);
    }
  }
  return `${prefix}:${base.split(":").slice(3).join(":")}`;
}

/** R-038: the portal MAC format. */
export function isValidPortalMac(mac: string): boolean {
  return MAC_PATTERN.test(mac.trim());
}

/** R-039: a portal is saved only after it connects (primary, then fallback). */
export async function testPortalBeforeSave(
  connect: (url: string) => Promise<StalkerProfile | undefined>,
  primaryUrl: string,
  fallbackUrl?: string,
): Promise<{ ok: true; url: string; profile: StalkerProfile } | { ok: false; message?: string }> {
  let last: StalkerProfile | undefined;
  for (const url of fallbackUrl ? [primaryUrl, fallbackUrl] : [primaryUrl]) {
    try {
      const profile = await connect(url);
      if (profile && profile.status === 1) return { ok: true, url, profile };
      last = profile;
    } catch {
      // try the fallback
    }
  }
  return { ok: false, message: last?.msg || undefined };
}

// ---------- D ----------

/**
 * R-040: a switch saves the new selection. Section flags reset because a switch creates a new
 * CatalogueSession; per-playlist data follows the new id automatically.
 */
export function selectPlaylist(store: KeyValueStore, playlist: Playlist): void {
  store.set(globalKeys.playlistId, playlist.id);
  store.set(globalKeys.playlist, JSON.stringify(playlist));
}

/** R-041: the movie-info cache is cleared when the new playlist has a different host. */
export function mustClearInfoCache(previousHost: string | undefined, nextHost: string): boolean {
  return previousHost !== undefined && previousHost !== nextHost;
}

/** R-042: with the Stararcs proxy on, loading waits 1 s first. */
export const PROXY_WARM_UP_MS = 1000;
export function loadDelayMs(proxyOn: boolean): number {
  return proxyOn ? PROXY_WARM_UP_MS : 0;
}

/** R-043: the working STB profile is saved unless the user chose "IBOPlayer". */
export function profileToSave(
  configured: StbProfileKey,
  working: StbProfileKey,
): StbProfileKey | undefined {
  if (working === configured || configured === "iboplayer") return undefined;
  return working;
}
