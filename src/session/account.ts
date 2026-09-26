// After device info (02-backend/overview.md §3 steps 8-9, user-flows.md §1 steps 6-10): the
// account state, the parental PIN, the playlist list with the offline edits replayed, and where
// the app goes next. Platform-free.
import { deletePlaylist, savePlaylist } from "@/api/ibo/client";
import type { PanelClient } from "@/api/ibo/panel";
import { mergeSavedPlaylist } from "@/api/ibo/playlists";
import type { DeviceInfo, Playlist } from "@/api/ibo/types";
import type { KeyValueStore } from "@/api/store";
import { pinAfterLogin } from "@/content/rules/parental";
import { readLocalData, replayQueue } from "@/content/rules/playlists";
import { accountState, removeDemoEntry, type AccountState } from "@/content/rules/startup";
import { globalKeys } from "@/storage/keys";
import { readSettings } from "@/storage/settings";

/** Where the app goes once the account is known. */
export type AccountRoute =
  /** R-006: blocked, no way into the content. */
  | "expired"
  /** R-020 "Playlist Selection": the Playlists screen, Back exits. */
  | "choose_playlist"
  /** R-007: the trial Welcome screen, then the playlist load. */
  | "welcome"
  /** Registered: load the saved or first playlist. */
  | "load";

export interface AccountResult {
  state: AccountState;
  route: AccountRoute;
  playlists: Playlist[];
}

export interface AccountDeps {
  store: KeyValueStore;
  panel: PanelClient;
  macAddress: string;
  today?: Date;
}

/**
 * R-030: queued adds/updates and deletes are sent again. Entries the backend still refuses stay
 * in the list (they work locally) and in the queue; queued deletes stay hidden.
 */
async function withQueuedEdits(deps: AccountDeps, playlists: Playlist[]): Promise<Playlist[]> {
  const token = deps.store.get(globalKeys.v4Token) ?? null;
  const accepted = await replayQueue(
    deps.store,
    async (entry) => {
      try {
        const result = await savePlaylist(deps.panel, entry, deps.macAddress, token);
        return result.kind === "success" ? mergeSavedPlaylist(entry, result.playlist) : undefined;
      } catch {
        return undefined;
      }
    },
    async (id) => {
      try {
        return (await deletePlaylist(deps.panel, id, deps.macAddress, token)).kind === "success";
      } catch {
        return false;
      }
    },
  );
  return mergeLocal(deps.store, [...playlists, ...accepted]);
}

/** The list the app shows: server entries, queued local entries, minus queued deletes. */
export function mergeLocal(store: KeyValueStore, playlists: readonly Playlist[]): Playlist[] {
  const local = readLocalData(store);
  const byId = new Map<string, Playlist>();
  for (const p of [...playlists, ...local.playlist_urls]) byId.set(p.id, p);
  return [...byId.values()].filter((p) => !local.remove_ids.includes(p.id));
}

export async function afterDeviceInfo(
  deps: AccountDeps,
  info: DeviceInfo,
  offline: boolean,
): Promise<AccountResult> {
  const state = accountState(info, { today: deps.today });
  if (state === "expired") return { state, route: "expired", playlists: [] };

  // R-010: the server PIN wins at login; the local one (or 0000) otherwise.
  const { store } = deps;
  store.set(globalKeys.parentPin, pinAfterLogin(store.get(globalKeys.parentPin), info.parent_pin));

  const serverList = removeDemoEntry(info.urls);
  if (readSettings(store).appInitialization === "playlist_first")
    return { state, route: "choose_playlist", playlists: mergeLocal(store, serverList) };

  const playlists = offline
    ? mergeLocal(store, serverList)
    : await withQueuedEdits(deps, serverList);
  return { state, route: state === "trial" ? "welcome" : "load", playlists };
}
