import { memoryStore } from "@/api/store";

import { globalKeys, listTypeFor, playlistKeys } from "../keys";
import { ensureLoadOnDemandDefault, readSettings } from "../settings";

describe("storage keys (data-models.md §12)", () => {
  it("uses the TV names, per-playlist keys without a separator", () => {
    expect(globalKeys.parentPin).toBe("gz3rYzUIC7_parent_account_password");
    expect(globalKeys.savedMovieInfo).toBe("gz3rYzUIC7_saved-movie-info");
    const keys = playlistKeys("4821");
    expect(keys.favourites("live")).toBe("gz3rYzUIC7_4821live_favourite");
    expect(keys.savedVodTimes).toBe("gz3rYzUIC7_4821_saved_vod_times");
    expect(keys.customMembers("vod", "cc1")).toBe("gz3rYzUIC7_4821vod_cc_cc1");
    expect(keys.stalkerObjects("series", "recent")).toBe(
      "gz3rYzUIC7_4821_stalker_series_recent_objs",
    );
    expect(listTypeFor("movie")).toBe("vod");
  });
});

describe("settings defaults (settings.md)", () => {
  it("reads the TV defaults when nothing is stored", () => {
    expect(readSettings(memoryStore())).toEqual({
      loadOnDemand: true,
      vodSort: "added",
      seriesSort: "added",
      liveSort: "default",
      streamFormat: "default",
      tmdb: true,
      homeFavorites: true,
      liveInitialization: "default",
      appInitialization: "automatic",
      autoSwitchPlaylist: false,
      customCategoriesEnabled: false,
      autoPlay: false,
      keepConnection: false,
      stbProfile: undefined,
    });
  });

  it("reads stored values and ignores unknown ones", () => {
    const store = memoryStore({
      [globalKeys.loadOnDemand]: "0",
      [globalKeys.vodSort]: "rating",
      [globalKeys.seriesSort]: "bogus",
      [globalKeys.appInitializationChoice]: "playlist_first",
    });
    const settings = readSettings(store);
    expect(settings).toMatchObject({
      loadOnDemand: false,
      vodSort: "rating",
      seriesSort: "added",
      appInitialization: "playlist_first",
    });
  });

  it("writes load_on_demand = 1 only when missing", () => {
    const store = memoryStore();
    ensureLoadOnDemandDefault(store);
    expect(store.get(globalKeys.loadOnDemand)).toBe("1");
    store.set(globalKeys.loadOnDemand, "0");
    ensureLoadOnDemandDefault(store);
    expect(store.get(globalKeys.loadOnDemand)).toBe("0");
  });
});
