// Settings with the TV defaults (01-product/settings.md). Values are stored as the TV stores
// them (strings), on the injected KeyValueStore.
import type { KeyValueStore } from "@/api/store";

import { globalKeys } from "./keys";

export type SortKey = "default" | "added" | "a_z" | "z_a" | "rating" | "number";

export interface Settings {
  loadOnDemand: boolean;
  vodSort: SortKey;
  seriesSort: SortKey;
  liveSort: SortKey;
  streamFormat: "default" | "ts" | "m3u8";
  tmdb: boolean;
  homeFavorites: boolean;
  liveInitialization: "default" | "last" | "favorite";
  appInitialization: "automatic" | "playlist_first";
  autoSwitchPlaylist: boolean;
  customCategoriesEnabled: boolean;
  autoPlay: boolean;
  keepConnection: boolean;
  stbProfile: string | undefined;
}

const SORTS: readonly SortKey[] = ["default", "added", "a_z", "z_a", "rating", "number"];
const sort = (value: string | undefined, fallback: SortKey): SortKey =>
  (SORTS as readonly string[]).includes(value ?? "") ? (value as SortKey) : fallback;

export function readSettings(store: KeyValueStore): Settings {
  const get = (key: string) => store.get(key);
  const format = get(globalKeys.streamFormat);
  const liveInit = get(globalKeys.liveInitializationChoice);
  return {
    // R-050: default on ("1" is written at the first Xtream login when missing).
    loadOnDemand: get(globalKeys.loadOnDemand) !== "0",
    vodSort: sort(get(globalKeys.vodSort), "added"),
    seriesSort: sort(get(globalKeys.seriesSort), "added"),
    liveSort: sort(get(globalKeys.liveSort), "default"),
    streamFormat: format === "ts" || format === "m3u8" ? format : "default",
    tmdb: get(globalKeys.tmdbChoice) !== "off",
    homeFavorites: get(globalKeys.homeFavoritesChoice) !== "off",
    liveInitialization: liveInit === "last" || liveInit === "favorite" ? liveInit : "default",
    appInitialization:
      get(globalKeys.appInitializationChoice) === "playlist_first" ? "playlist_first" : "automatic",
    autoSwitchPlaylist: get(globalKeys.autoSwitchPlaylist) === "on",
    customCategoriesEnabled: get(globalKeys.customCategoriesEnabled) === "true",
    autoPlay: get(globalKeys.autoPlay) === "on",
    keepConnection: get(globalKeys.keepConnection) === "on",
    stbProfile: get(globalKeys.stalkerStbProfile),
  };
}

/** R-050: written at the first successful Xtream login when the key is missing. */
export function ensureLoadOnDemandDefault(store: KeyValueStore): void {
  if (store.get(globalKeys.loadOnDemand) === undefined) store.set(globalKeys.loadOnDemand, "1");
}
