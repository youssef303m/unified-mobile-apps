// The session store (04-build/architecture.md): device, account, playlists and the active
// catalogue. Screens read it; src/session/boot.ts writes it.
import { create } from "zustand";

import type { DeviceInfo, Playlist } from "@/api/ibo/types";
import type { CatalogueSession } from "@/content/catalogue";
import type { AccountState } from "@/content/rules/startup";

import type { CaptchaChallenge } from "./device";
import type { LoadFailure, ProviderAccount } from "./playlistLoad";

export interface SessionState {
  macAddress?: string;
  info?: DeviceInfo;
  /** Started from the cached account because no server answered (R-004). */
  offline: boolean;
  accountState?: AccountState;
  playlists: Playlist[];
  /** The current captcha on the Verify screen. */
  challenge?: CaptchaChallenge;
  /** The loaded playlist and its catalogue: the content tabs need both. */
  active?: {
    playlist: Playlist;
    catalogue: CatalogueSession;
    provider: ProviderAccount;
    /** Opened from the phone's saved catalogue: no connection (D-081). */
    offline?: boolean;
  };
  /** The last failed load: the Playlists / Portals screen shows its banner. */
  failure?: LoadFailure;
  /** The Playlists screen was opened by the startup flow (Back exits, no CURRENT badge). */
  startupChooser: boolean;
}

export const initialSession: SessionState = {
  offline: false,
  playlists: [],
  startupChooser: false,
};

export const useSession = create<SessionState>()(() => ({ ...initialSession }));

export const session = {
  get: () => useSession.getState(),
  set: (patch: Partial<SessionState>) => useSession.setState(patch),
  reset: () => useSession.setState({ ...initialSession }, true),
};

/** R-006: the content is reachable only with a known, unexpired account. */
export function accountOk(state: SessionState): boolean {
  return state.info !== undefined && state.accountState !== "expired";
}

/** The tabs need a loaded playlist. */
export function contentReady(state: SessionState): boolean {
  return accountOk(state) && state.active !== undefined;
}
