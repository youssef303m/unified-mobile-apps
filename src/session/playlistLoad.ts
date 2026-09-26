// Loading a playlist at startup or on a switch (user-flows.md §1 steps 11-12, §2, §3): select it,
// log in to the provider, sync the sections due at login, and on failure try the next playlist
// (Auto Switch) or report which screen and message to show. Platform-free.
import { CancelledError, type ApiError } from "@/api/errors";
import type { Playlist } from "@/api/ibo/types";
import type { KeyValueStore } from "@/api/store";
import type { StalkerProfile } from "@/api/stalker/client";
import type { XtreamAccount } from "@/api/xtream/types";
import { CatalogueSession, login } from "@/content/catalogue";
import { sectionsAtLogin } from "@/content/rules/content";
import {
  failureScreen,
  loginErrorKey,
  nextPlaylistAfterFailure,
  selectPlaylist,
  type PlaylistErrorKey,
} from "@/content/rules/playlists";
import { isLoadable } from "@/content/rules/startup";
import { StalkerSource } from "@/content/StalkerSource";
import type { Db } from "@/db/database";
import { readSettings } from "@/storage/settings";

/** loading_* status lines while a playlist loads. */
export type LoadStep = "playlist" | "provider" | "portal" | "streams" | "almost_ready";

/** The Playlists / Portals screen banner after a failed load (current-app-inventory.md §6, §8). */
export type LoadErrorKey = PlaylistErrorKey | "no_url" | "all_failed" | "aborted";

export interface LoadFailure {
  screen: "playlists" | "portals";
  error: LoadErrorKey;
}

/** What the Account screen shows under "Playlist info" (current-app-inventory.md §22). */
export type ProviderAccount =
  | { type: "xtream"; username: string; account: XtreamAccount }
  | { type: "stalker"; mac: string; profile: StalkerProfile }
  | { type: "m3u" };

export type LoadOutcome =
  | { kind: "ready"; playlist: Playlist; session: CatalogueSession; provider: ProviderAccount }
  | { kind: "failed"; failure: LoadFailure };

export interface LoadDeps {
  store: KeyValueStore;
  db: Db;
  signal?: AbortSignal;
  onStep?: (step: LoadStep) => void;
}

function aborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

async function loadOne(deps: LoadDeps, playlist: Playlist): Promise<LoadOutcome> {
  const { store, db, signal, onStep } = deps;
  onStep?.(playlist.playlist_type === "stalker" ? "portal" : "provider");
  const result = await login(playlist, store, signal);
  if (aborted(signal)) throw new CancelledError("Playlist loading aborted by the user");

  const session = new CatalogueSession(db, result.source, playlist);
  if (sectionsAtLogin(result.source.type, readSettings(store).loadOnDemand).length > 0) {
    onStep?.("streams");
    await session.loadAll({ signal });
  }
  onStep?.("almost_ready");

  let provider: ProviderAccount = { type: "m3u" };
  if (result.account)
    provider = { type: "xtream", username: playlist.username ?? "", account: result.account };
  else if (result.source instanceof StalkerSource) {
    const connected = await result.source.connect();
    provider = {
      type: "stalker",
      mac: playlist.stalker_mac_address ?? "",
      profile: connected.profile,
    };
  }
  return { kind: "ready", playlist, session, provider };
}

/**
 * R-040 / R-021 / R-022: loads `first`; with Auto Switch on, a failure moves to the next untried
 * playlist of `all`. The selection is saved before each attempt, as the TV activates a card
 * before loading it.
 */
export async function loadPlaylist(
  deps: LoadDeps,
  first: Playlist,
  all: readonly Playlist[],
): Promise<LoadOutcome> {
  const { autoSwitchPlaylist } = readSettings(deps.store);
  const tried = new Set<string>();
  let target: Playlist | undefined = first;
  let lastError: LoadErrorKey = "playlist_generic";
  while (target) {
    deps.onStep?.("playlist");
    selectPlaylist(deps.store, target);
    tried.add(target.id);
    if (!isLoadable(target)) {
      lastError = "no_url"; // R-009
    } else {
      try {
        return await loadOne(deps, target);
      } catch (error) {
        if (error instanceof CancelledError || aborted(deps.signal))
          return {
            kind: "failed",
            failure: { screen: failureScreen(target.playlist_type), error: "aborted" },
          };
        lastError = loginErrorKey(error as ApiError);
      }
    }
    const failed: Playlist = target;
    target = nextPlaylistAfterFailure(all, tried, autoSwitchPlaylist);
    if (!target)
      return {
        kind: "failed",
        failure: {
          screen: failureScreen(failed.playlist_type),
          error: tried.size > 1 ? "all_failed" : lastError,
        },
      };
  }
  return { kind: "failed", failure: { screen: "playlists", error: lastError } };
}
