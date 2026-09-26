// Adding and deleting playlists and portals (user-flows.md §2-3, current-app-inventory.md §6-9):
// validation, the provider test before saving, the backend save with the offline queue, and the
// delete rules. Platform-free.
import { deletePlaylist, savePlaylist } from "@/api/ibo/client";
import type { PanelClient } from "@/api/ibo/panel";
import { mergeSavedPlaylist } from "@/api/ibo/playlists";
import type { Playlist } from "@/api/ibo/types";
import { StalkerClient } from "@/api/stalker/client";
import { profileKey } from "@/api/stalker/portal";
import type { KeyValueStore } from "@/api/store";
import {
  afterDelete,
  canDeletePlaylist,
  isValidPortalMac,
  newLocalPlaylistId,
  normalizeXtreamForm,
  queueFailedSave,
  testPortalBeforeSave,
  type XtreamForm,
} from "@/content/rules/playlists";
import { XtreamSource } from "@/content/XtreamSource";
import { globalKeys } from "@/storage/keys";
import { readSettings } from "@/storage/settings";

export interface ManageDeps {
  store: KeyValueStore;
  panel: PanelClient;
  macAddress: string;
}

export type SaveResult =
  | { kind: "saved"; playlist: Playlist; queued: boolean }
  | { kind: "invalid"; field: keyof XtreamForm | keyof PortalForm | "mac_format" }
  | { kind: "not_working"; message?: string };

/** R-030: the backend save; on failure the entry is kept locally and queued for next launch. */
async function saveOrQueue(deps: ManageDeps, entry: Playlist): Promise<SaveResult> {
  const token = deps.store.get(globalKeys.v4Token) ?? null;
  try {
    const result = await savePlaylist(deps.panel, entry, deps.macAddress, token);
    if (result.kind === "success")
      return { kind: "saved", playlist: mergeSavedPlaylist(entry, result.playlist), queued: false };
  } catch {
    // queued below
  }
  queueFailedSave(deps.store, entry);
  return { kind: "saved", playlist: entry, queued: true };
}

/** The first empty field, in form order (the TV's per-field messages). */
function firstMissing<T extends object>(form: T, order: readonly (keyof T)[]): keyof T | undefined {
  return order.find((key) => String(form[key]).trim() === "");
}

/** R-031 / R-036: an Xtream playlist is tested with the provider before it is saved. */
export async function addXtreamPlaylist(
  deps: ManageDeps,
  form: XtreamForm,
  signal?: AbortSignal,
): Promise<SaveResult> {
  const normalized = normalizeXtreamForm(form);
  if (!normalized.value) {
    const field = firstMissing(form, ["name", "url", "username", "password"]) ?? "url";
    return { kind: "invalid", field };
  }
  const { name, url, username, password } = normalized.value;
  const entry: Playlist = {
    id: newLocalPlaylistId(),
    playlist_name: name,
    playlist_type: "xc",
    url,
    username,
    password,
    is_created: true,
  };
  try {
    await new XtreamSource(entry, { streamFormat: readSettings(deps.store).streamFormat }).login(
      signal,
    );
  } catch {
    return { kind: "not_working" };
  }
  return saveOrQueue(deps, entry);
}

export interface PortalForm {
  name: string;
  url: string;
  fallbackUrl: string;
  mac: string;
}

/** R-038 / R-039: a portal is saved only after it connects (primary, then fallback). */
export async function addPortal(deps: ManageDeps, form: PortalForm): Promise<SaveResult> {
  const missing = firstMissing(form, ["name", "url", "mac"]);
  if (missing) return { kind: "invalid", field: missing };
  const mac = form.mac.trim().toUpperCase();
  if (!isValidPortalMac(mac)) return { kind: "invalid", field: "mac_format" };
  const primary = form.url.trim();
  const fallback = form.fallbackUrl.trim() || undefined;
  const profile = profileKey(readSettings(deps.store).stbProfile);
  const test = await testPortalBeforeSave(
    async (portalUrl) =>
      (
        await new StalkerClient({
          portalUrl,
          macAddress: mac,
          profile,
          store: deps.store,
        }).connect()
      ).profile,
    primary,
    fallback,
  );
  if (!test.ok) return { kind: "not_working", message: test.message };
  const entry: Playlist = {
    id: newLocalPlaylistId(),
    playlist_name: form.name.trim(),
    portal_name: form.name.trim(),
    playlist_type: "stalker",
    url: primary,
    portal_address: primary,
    portal_fallback_address: fallback ?? "",
    stalker_mac_address: mac,
    is_created: true,
  };
  return saveOrQueue(deps, entry);
}

export type DeleteResult =
  | {
      kind: "deleted";
      playlists: Playlist[];
      clearedSelection: boolean;
      /** R-034: the active portal was deleted: go to the Playlists screen. */
      toPlaylists: boolean;
    }
  | { kind: "last_one" }
  | { kind: "failed" };

/**
 * R-033 / R-034: at least one playlist (or portal) must remain; the backend delete must succeed;
 * deleting the active entry clears the selection. `group` is the list the entry belongs to
 * (playlists or portals).
 */
export async function removePlaylist(
  deps: ManageDeps,
  all: readonly Playlist[],
  group: readonly Playlist[],
  target: Playlist,
): Promise<DeleteResult> {
  if (!canDeletePlaylist(group)) return { kind: "last_one" };
  const token = deps.store.get(globalKeys.v4Token) ?? null;
  try {
    const result = await deletePlaylist(deps.panel, target.id, deps.macAddress, token);
    if (result.kind !== "success") return { kind: "failed" };
  } catch {
    return { kind: "failed" };
  }
  const { clearSelection, goTo } = afterDelete(deps.store.get(globalKeys.playlistId), target);
  if (clearSelection) {
    deps.store.remove(globalKeys.playlistId);
    deps.store.remove(globalKeys.playlist);
  }
  return {
    kind: "deleted",
    playlists: all.filter((p) => p.id !== target.id),
    clearedSelection: clearSelection,
    toPlaylists: goTo === "playlists",
  };
}
