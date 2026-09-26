import { memoryStore } from "@/api/store";
import { defined } from "@/content/testing/defined";
import { search } from "@/db/queries/catalogue";
import { openTestDb } from "@/db/testing/testDb";
import { playlistKeys } from "@/storage/keys";

import { writeCatalogue } from "../../sync";
import type { CatalogueItem } from "../../types";
import {
  addFavourite,
  clearWatchList,
  continueWatchingIds,
  detailsFavouriteChange,
  episodeResumePosition,
  FAVOURITE_LIMITS,
  favouriteIds,
  homeLiveFavouritesVisible,
  lastWatched,
  lastWatchedLabel,
  movieResumePosition,
  persistStalkerObject,
  progressDecision,
  progressPercent,
  recentLiveIds,
  recordLiveChannel,
  removeFavourite,
  RESUME_PROMPT_TIMEOUT_MS,
  saveEpisodeProgress,
  saveMovieProgress,
  shouldOfferResume,
  stalkerObjects,
} from "../library";
import {
  canAddFavourite,
  canRecordHistory,
  changePin,
  DEFAULT_PIN,
  isAdultCategory,
  isHiddenFromRows,
  needsPin,
  pinMatches,
  settingsNeedPin,
  validateNewPin,
} from "../parental";

const PID = "4821";
const channel = (id: string): CatalogueItem => ({
  kind: "live",
  item_id: id,
  name: `Ch ${id}`,
  icon: "",
  category_id: "10",
  tv_archive: 0,
  tv_archive_duration: 0,
});

describe("F. Parental control", () => {
  it("R-060: adult = name contains xxx, adult or porn; 'sex' only for the rows test", () => {
    expect(isAdultCategory("XXX ADULTS")).toBe(true);
    expect(isAdultCategory("Adult Movies")).toBe(true);
    expect(isAdultCategory("porn")).toBe(true);
    expect(isAdultCategory("Sex Education")).toBe(false);
    expect(isHiddenFromRows("Sex Education")).toBe(true);
    expect(isAdultCategory("Sports")).toBe(false);
  });

  it("R-061: an adult category asks the PIN every time, unless control is off", () => {
    expect(needsPin(true, "1234")).toBe(true);
    expect(needsPin(true, "off")).toBe(false);
    expect(needsPin(false, "1234")).toBe(false);
    expect(pinMatches("1234", "1234")).toBe(true);
    expect(pinMatches("0000", "1234")).toBe(false);
  });

  it("R-062: adult items cannot be favourited (even with control off); removing is allowed", () => {
    const store = memoryStore();
    expect(canAddFavourite(true)).toBe(false);
    expect(addFavourite(store, PID, "live", "1", true)).toBe("refused_adult");
    expect(addFavourite(store, PID, "live", "1", false)).toBe("added");
    removeFavourite(store, PID, "live", "1");
    expect(favouriteIds(store, PID, "live")).toEqual([]);
  });

  it("R-063: adult channels are not recent; adult progress is not saved", () => {
    const store = memoryStore();
    expect(canRecordHistory(true)).toBe(false);
    expect(recordLiveChannel(store, PID, "1", true)).toBe(false);
    expect(recentLiveIds(store, PID)).toEqual([]);
    expect(saveMovieProgress(store, PID, "m", 300, 6000, true)).toBe("ignore");
    expect(movieResumePosition(store, PID, "m")).toBe(0);
  });

  it("R-064: search never returns adult-category items, even with control off", async () => {
    const db = await openTestDb();
    await writeCatalogue(db, "p", "live", {
      categories: [
        { category_id: "10", category_name: "News", parent_id: "0" },
        { category_id: "99", category_name: "XXX", parent_id: "0" },
      ],
      items: [
        channel("1"),
        { ...channel("2"), name: "Ch Night", category_id: "99" },
        { ...channel("3"), name: "Ch Night" },
      ],
    });
    expect((await search(db, "p", "night", { kinds: ["live"] })).map((i) => i.item_id)).toEqual([
      "3",
    ]);
  });

  it("R-065: settings need the PIN while on; a new PIN needs New = Confirm, 4 digits", () => {
    expect(settingsNeedPin("1234")).toBe(true);
    expect(settingsNeedPin("off")).toBe(false);
    expect(validateNewPin("", "")).toBe("fill_all_fields");
    expect(validateNewPin("1234", "1235")).toBe("pins_do_not_match");
    expect(validateNewPin("123", "123")).toBe("must_be_4_digits");
    expect(validateNewPin("1234", "1234")).toBeUndefined();
  });

  it("R-066: saved locally first, then synced; a failed sync keeps it on the device", async () => {
    const saved: string[] = [];
    expect(
      await changePin(
        (p) => saved.push(p),
        async () => true,
        "1234",
      ),
    ).toBe("synced");
    expect(
      await changePin(
        (p) => saved.push(p),
        async () => false,
        "off",
      ),
    ).toBe("saved_on_device_only");
    expect(saved).toEqual(["1234", "off"]);
    expect(DEFAULT_PIN).toBe("0000");
  });
});

describe("G. Favourites, recent, continue watching", () => {
  it("R-070: per playlist and type, appended, max 500 live / 200 movies / 200 series", () => {
    const store = memoryStore();
    addFavourite(store, PID, "vod", "b", false);
    addFavourite(store, PID, "vod", "a", false);
    expect(favouriteIds(store, PID, "vod")).toEqual(["b", "a"]);
    expect(favouriteIds(store, "other", "vod")).toEqual([]);
    expect(FAVOURITE_LIMITS).toEqual({ live: 500, vod: 200, series: 200 });
    for (let i = 0; i < 198; i++) addFavourite(store, PID, "vod", `x${i}`, false);
    expect(addFavourite(store, PID, "vod", "one-too-many", false)).toBe("full");
    expect(store.get(playlistKeys(PID).favourites("vod"))).toContain('"b"');
  });

  it("R-071: the Home Live Favourites tile is hidden for Stalker; Stalker keeps objects", () => {
    expect(homeLiveFavouritesVisible("stalker", true)).toBe(false);
    expect(homeLiveFavouritesVisible("xtream", false)).toBe(false);
    expect(homeLiveFavouritesVisible("xtream", true)).toBe(true);
    const store = memoryStore();
    persistStalkerObject(store, PID, "live", "favourite", channel("1"));
    persistStalkerObject(store, PID, "live", "favourite", channel("2"));
    expect(stalkerObjects(store, PID, "live", "favourite").map((o) => o.item_id)).toEqual([
      "2",
      "1",
    ]);
  });

  it("R-072: played channels go first, max 15; a replay moves to the front (fix #2)", () => {
    const store = memoryStore();
    for (let i = 0; i < 16; i++) recordLiveChannel(store, PID, String(i), false);
    expect(recentLiveIds(store, PID)).toHaveLength(15);
    expect(recentLiveIds(store, PID)[0]).toBe("15");
    recordLiveChannel(store, PID, "5", false);
    expect(recentLiveIds(store, PID).slice(0, 2)).toEqual(["5", "15"]);
    expect(recentLiveIds(store, PID).filter((id) => id === "5")).toHaveLength(1);
  });

  it("R-073: saved at ≥ 10 s with ≥ 10 s left; the last 10 s finish it and remove it", () => {
    expect(progressDecision(9, 600)).toBe("ignore");
    expect(progressDecision(10, 600)).toBe("save");
    expect(progressDecision(591, 600)).toBe("finished");
    const store = memoryStore();
    expect(saveMovieProgress(store, PID, "m1", 120, 600, false)).toBe("save");
    expect(movieResumePosition(store, PID, "m1")).toBe(120);
    expect(saveMovieProgress(store, PID, "m1", 595, 600, false)).toBe("finished");
    expect(movieResumePosition(store, PID, "m1")).toBe(0);
  });

  it("R-074: continue watching is newest first, max 15", () => {
    const store = memoryStore();
    for (let i = 0; i < 17; i++) saveMovieProgress(store, PID, `m${i}`, 60, 600, false, 1000 + i);
    saveMovieProgress(store, PID, "m0", 90, 600, false, 5000);
    const ids = continueWatchingIds(store, PID, "movie");
    expect(ids).toHaveLength(15);
    expect(ids[0]).toBe("m0");
    expect(ids[1]).toBe("m16");
  });

  it("R-075: resume is offered for a saved position on a seekable stream; 15 s timeout", () => {
    expect(shouldOfferResume(120, true)).toBe(true);
    expect(shouldOfferResume(0, true)).toBe(false);
    expect(shouldOfferResume(120, false)).toBe(false);
    expect(RESUME_PROMPT_TIMEOUT_MS).toBe(15_000);
    expect(progressPercent(300, 600)).toBe(50);
  });

  it("R-076: series remember the last episode; progress is keyed by episode id (fix #3)", () => {
    const store = memoryStore();
    saveEpisodeProgress(
      store,
      PID,
      "s1",
      { id: "880201", seasonNumber: 2, episodeNumber: 1 },
      100,
      1800,
      false,
    );
    saveEpisodeProgress(
      store,
      PID,
      "s1",
      { id: "880203", seasonNumber: 2, episodeNumber: 3 },
      200,
      1800,
      false,
    );
    expect(episodeResumePosition(store, PID, "s1", "880201")).toBe(100);
    const last = lastWatched(store, PID, "s1");
    expect(last).toEqual({ id: "880203", s: 2, ep: 3 });
    expect(lastWatchedLabel(defined(last))).toBe("S2EP3");
    // Finishing every episode removes the series from the list.
    saveEpisodeProgress(
      store,
      PID,
      "s1",
      { id: "880201", seasonNumber: 2, episodeNumber: 1 },
      1795,
      1800,
      false,
    );
    saveEpisodeProgress(
      store,
      PID,
      "s1",
      { id: "880203", seasonNumber: 2, episodeNumber: 3 },
      1795,
      1800,
      false,
    );
    expect(continueWatchingIds(store, PID, "series")).toEqual([]);
  });

  it("R-077: clear watch lists removes the current playlist's progress", () => {
    const store = memoryStore();
    saveMovieProgress(store, PID, "m1", 120, 600, false);
    saveMovieProgress(store, "other", "m1", 120, 600, false);
    clearWatchList(store, PID, "movie");
    expect(continueWatchingIds(store, PID, "movie")).toEqual([]);
    expect(continueWatchingIds(store, "other", "movie")).toEqual(["m1"]);
  });

  it("R-078: the details page favourite is applied on leaving, as the net change", () => {
    expect(detailsFavouriteChange(false, true)).toBe("add");
    expect(detailsFavouriteChange(true, false)).toBe("remove");
    expect(detailsFavouriteChange(true, true)).toBeUndefined();
  });
});
