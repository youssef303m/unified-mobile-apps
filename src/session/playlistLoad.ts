// Loading a playlist at startup or on a switch (user-flows.md §1 steps 11-12, §2, §3): select it,
// log in to the provider, sync the sections due at login, and on failure try the next playlist
// (Auto Switch) or report which screen and message to show. Platform-free.
import { CancelledError, NetworkError, TimeoutError, type ApiError } from "@/api/errors";
import type { Playlist } from "@/api/ibo/types";
import type { KeyValueStore } from "@/api/store";
import type { StalkerProfile } from "@/api/stalker/client";
import type { XtreamAccount } from "@/api/xtream/types";
import { CatalogueSession, createSource, KINDS, login } from "@/content/catalogue";
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
export type LoadErrorKey =
  | PlaylistErrorKey
  | "no_url"
  | "all_failed"
  | "aborted"
  /** No connection, and nothing of the playlist is saved on the phone (D-081). */
  | "offline";

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
  | {
      kind: "ready";
      playlist: Playlist;
      session: CatalogueSession;
      provider: ProviderAccount;
      /** R-021: set when Auto Switch moved on from the requested playlist to this one. */
      switched?: boolean;
      /** No connection: the playlist opened from the catalogue saved on the phone (D-081). */
      offline?: boolean;
    }
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

function isConnectionError(error: unknown): boolean {
  return error instanceof NetworkError || error instanceof TimeoutError;
}

/**
 * D-081: without a connection, a playlist opens from the sections saved on the phone. They count
 * as loaded, so nothing is downloaded until the user refreshes or loads the playlist again; a
 * section never saved shows its error with Try again.
 */
type Ready = Extract<LoadOutcome, { kind: "ready" }>;

async function openOffline(deps: LoadDeps, playlist: Playlist): Promise<Ready | undefined> {
  const session = new CatalogueSession(deps.db, createSource(playlist, deps.store), playlist);
  let cached = false;
  for (const kind of KINDS) {
    if (!(await session.hasCache(kind))) continue;
    session.markLoaded(kind);
    cached = true;
  }
  if (!cached) return undefined;
  return { kind: "ready", playlist, session, provider: { type: "m3u" }, offline: true };
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
  // Loadable playlists that failed only for want of a connection, in the order tried.
  const unreachable: Playlist[] = [];
  let otherFailure = false;
  while (target) {
    deps.onStep?.("playlist");
    selectPlaylist(deps.store, target);
    tried.add(target.id);
    if (!isLoadable(target)) {
      lastError = "no_url"; // R-009
    } else {
      try {
        const ready = await loadOne(deps, target);
        return ready.kind === "ready" && target.id !== first.id
          ? { ...ready, switched: true }
          : ready;
      } catch (error) {
        if (error instanceof CancelledError || aborted(deps.signal))
          return {
            kind: "failed",
            failure: { screen: failureScreen(target.playlist_type), error: "aborted" },
          };
        lastError = loginErrorKey(error as ApiError);
        if (isConnectionError(error)) unreachable.push(target);
        else otherFailure = true;
      }
    }
    const failed: Playlist = target;
    target = nextPlaylistAfterFailure(all, tried, autoSwitchPlaylist);
    if (!target && unreachable.length > 0 && !otherFailure) {
      for (const playlist of unreachable) {
        const offline = await openOffline(deps, playlist);
        if (offline) {
          selectPlaylist(deps.store, playlist);
          return playlist.id !== first.id ? { ...offline, switched: true } : offline;
        }
      }
      return {
        kind: "failed",
        failure: { screen: failureScreen(failed.playlist_type), error: "offline" },
      };
    }
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
