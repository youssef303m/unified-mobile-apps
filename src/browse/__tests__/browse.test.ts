// M4 services on the fixtures: Home rows (N-01), tab rows and category lists, details, search,
// My List and parental control.
import { fixturePlaylists } from "@/api/__fixtures__/ibo";
import { parsePlaylist } from "@/api/ibo/playlists";
import type { Playlist } from "@/api/ibo/types";
import { memoryStore, type KeyValueStore } from "@/api/store";
import { CatalogueSession, login } from "@/content/catalogue";
import { customCategories, setCustomCategoriesEnabled } from "@/content/rules/customCategories";
import { addFavourite, saveEpisodeProgress, saveMovieProgress } from "@/content/rules/library";
import { defined } from "@/content/testing/defined";
import type { CatalogueItem } from "@/content/types";
import { itemById } from "@/db/queries/catalogue";
import { openTestDb } from "@/db/testing/testDb";
import { globalKeys, playlistKeys } from "@/storage/keys";

import type { BrowseContext } from "../context";
import {
  findItem,
  isAdultItem,
  movieInfo,
  movieResume,
  seriesDetails,
  seriesPlayTarget,
} from "../details";
import { loadHome } from "../home";
import { initialLiveSelection } from "../live";
import {
  addRecentSearch,
  clearRecentSearches,
  continueWatching,
  isFavouriteItem,
  mostOpenedCategories,
  recentChannels,
  recentSearches,
  recordCategoryOpen,
  recordChannelView,
  toggleFavourite,
} from "../library";
import { ParentalControl } from "../parental";
import { CategoryFeed, rowPreview, tabRows } from "../rows";
import { isSearchable, searchContent } from "../search";

const [xtream, , portal] = fixturePlaylists.map(parsePlaylist) as [Playlist, Playlist, Playlist];
const HOME = { homeFavorites: true, sorts: { movie: "added", series: "added" } } as const;

async function context(
  playlist: Playlist = xtream,
  store: KeyValueStore = memoryStore(),
): Promise<BrowseContext> {
  const db = await openTestDb();
  const { source } = await login(playlist, store);
  const catalogue = new CatalogueSession(db, source, playlist);
  for (const kind of ["live", "movie", "series"] as const) await catalogue.ensureSection(kind);
  return { db, store, catalogue };
}

const item = async (ctx: BrowseContext, kind: "live" | "movie" | "series", id: string) =>
  defined(await itemById(ctx.db, ctx.catalogue.playlistId, kind, id));

describe("N-01 Home", () => {
  it("R-054 / R-060: the hero is the newest movie with artwork; adult items are left out", async () => {
    const ctx = await context();
    const home = await loadHome(ctx, HOME);
    expect(home.hero?.item_id).toBe("55000");
    const recent = home.rows.find((r) => r.id === "recent_movies");
    expect(recent?.style).toBe("poster");
    const ids = recent && "items" in recent ? recent.items.map((i) => i.item_id) : [];
    // 55004 was added recently but sits in "ADULT MOVIES".
    expect(ids).toEqual(["55000", "55001", "55002", "55003"]);
    expect(home.rows.map((r) => r.id)).toEqual(["recent_movies", "recent_series"]);
  });

  it("R-074: Continue Watching and My List rows appear once there is something to show", async () => {
    const ctx = await context();
    const pid = ctx.catalogue.playlistId;
    saveMovieProgress(ctx.store, pid, "55010", 600, 6000, false, 1000);
    saveEpisodeProgress(
      ctx.store,
      pid,
      "3305",
      { id: "880203", seasonNumber: 2, episodeNumber: 3 },
      120,
      1800,
      false,
      2000,
    );
    addFavourite(ctx.store, pid, "vod", "55020", false);
    addFavourite(ctx.store, pid, "series", "3310", false);
    addFavourite(ctx.store, pid, "live", "10000", false);
    const home = await loadHome(ctx, HOME);
    expect(home.rows.map((r) => r.id)).toEqual([
      "continue_movies",
      "continue_series",
      "my_list",
      "live_now",
      "recent_movies",
      "recent_series",
    ]);
    const movies = defined(home.rows.find((r) => r.id === "continue_movies"));
    expect("entries" in movies && movies.entries[0]).toMatchObject({
      fraction: 0.1,
      position: 600,
    });
    const series = defined(home.rows.find((r) => r.id === "continue_series"));
    expect("entries" in series && series.entries[0]?.episode).toEqual({
      id: "880203",
      season: 2,
      episode: 3,
    });
  });

  it("R-071: no Live Now row when Home favourites are off", async () => {
    const ctx = await context();
    addFavourite(ctx.store, ctx.catalogue.playlistId, "live", "10000", false);
    const home = await loadHome(ctx, { ...HOME, homeFavorites: false });
    expect(home.rows.some((r) => r.id === "live_now")).toBe(false);
  });

  it("N-01: a row per most opened category; adult categories are never counted", async () => {
    const ctx = await context();
    const pid = ctx.catalogue.playlistId;
    recordCategoryOpen(ctx.store, pid, "movie", "41", false);
    recordCategoryOpen(ctx.store, pid, "movie", "41", false);
    recordCategoryOpen(ctx.store, pid, "series", "72", false);
    recordCategoryOpen(ctx.store, pid, "movie", "44", true);
    expect(mostOpenedCategories(ctx.store, pid, ["movie", "series"], 3)).toEqual([
      { kind: "movie", categoryId: "41", count: 2 },
      { kind: "series", categoryId: "72", count: 1 },
    ]);
    const home = await loadHome(ctx, HOME);
    const row = defined(home.rows.find((r) => r.id === "category:movie:41"));
    expect("name" in row && row.name).toBe("EN | DRAMA");
    expect("items" in row && row.items.every((i) => i.category_id === "41")).toBe(true);
  });
});

describe("tab rows and category lists", () => {
  it("R-053: movie rows start with the virtual rows, without Search All", async () => {
    const ctx = await context();
    const rows = await tabRows(ctx, "movie");
    expect(rows.slice(0, 4).map((r) => r.id)).toEqual([
      "recent",
      "favourite",
      "top_rated",
      "newly_added",
    ]);
    expect(rows.filter((r) => r.type === "category")).toHaveLength(5);
  });

  it("R-082: custom rows follow Favourites when the feature is on", async () => {
    const ctx = await context();
    setCustomCategoriesEnabled(ctx.store, true);
    ctx.store.set(
      globalKeys.customCategories,
      JSON.stringify([{ id: "cc1", name: "Weekend", icon: "cc-heart" }]),
    );
    expect(customCategories(ctx.store)).toHaveLength(1);
    const rows = await tabRows(ctx, "live");
    expect(rows.slice(0, 3).map((r) => r.id)).toEqual(["recent", "favourite", "cc1"]);
  });

  it("R-055: Top Rated has 10 items, best first, none from an adult category", async () => {
    const ctx = await context();
    const { items } = await rowPreview(ctx, "movie", { type: "virtual", id: "top_rated" }, "added");
    expect(items).toHaveLength(10);
    const ratings = items.map((i) => defined(i.rating));
    expect([...ratings].sort((a, b) => b - a)).toEqual(ratings);
    expect(items.some((i) => i.category_id === "44")).toBe(false);
  });

  it("R-090: a category list is paged from SQLite in the chosen sort", async () => {
    const ctx = await context();
    const row = { type: "category", id: "40", name: "EN | ACTION", isAdult: false } as const;
    const feed = new CategoryFeed(ctx, "movie", row, "a_z");
    const first = await feed.next(4);
    const second = await feed.next(4);
    const last = await feed.next(4);
    expect([first.done, second.done, last.done]).toEqual([false, false, true]);
    const names = [...first.items, ...second.items, ...last.items].map((i) => i.name);
    expect(names).toHaveLength(10);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it("Stalker: a category list fetches portal pages as it grows", async () => {
    const ctx = await context(portal);
    const rows = await tabRows(ctx, "movie");
    // Stalker: no Top Rated / Newly Added rows (R-053); the portal's "All" is removed.
    expect(rows.map((r) => r.id)).toEqual(["recent", "favourite", "20"]);
    const feed = new CategoryFeed(ctx, "movie", defined(rows[2]), "added");
    const first = await feed.next(10);
    expect(first).toMatchObject({ done: false });
    expect(first.items).toHaveLength(10);
    const rest = await feed.next(60);
    expect(rest.done).toBe(true);
    expect(first.items.length + rest.items.length).toBe(20);
  });
});

describe("Live tab", () => {
  it("R-092: Default opens row 2 (Favourites) when it has channels, else the first non-empty row", async () => {
    const ctx = await context();
    expect(await initialLiveSelection(ctx, "default")).toEqual({
      rowId: "10",
      channelId: "10000",
    });
    addFavourite(ctx.store, ctx.catalogue.playlistId, "live", "10003", false);
    expect(await initialLiveSelection(ctx, "default")).toEqual({
      rowId: "favourite",
      channelId: "10003",
    });
  });

  it("R-092: Last opens the most recently watched channel in its category", async () => {
    const ctx = await context();
    recordChannelView(ctx, await item(ctx, "live", "10006"), false);
    expect(await initialLiveSelection(ctx, "last")).toEqual({ rowId: "11", channelId: "10006" });
  });

  it("R-058: Stalker opens the first real portal category", async () => {
    const ctx = await context(portal);
    expect((await initialLiveSelection(ctx, "default")).rowId).toBe("5");
  });
});

describe("details", () => {
  it("R-057: movie info is fetched once and then read from the cache", async () => {
    const ctx = await context();
    const movie = await item(ctx, "movie", "55001");
    const info = await movieInfo(ctx, movie);
    expect(info).toMatchObject({ director: "Fixture Director", youtubeTrailer: "Way9Dexny3w" });
    const source = ctx.catalogue.source;
    const spy = jest.spyOn(source, "movieInfo");
    expect(await movieInfo(ctx, movie)).toMatchObject({ director: "Fixture Director" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("R-075: the resume position and percentage come from the saved progress", async () => {
    const ctx = await context();
    const movie = await item(ctx, "movie", "55001");
    expect(movieResume(ctx, movie)).toBeUndefined();
    saveMovieProgress(ctx.store, ctx.catalogue.playlistId, "55001", 1500, 6000, false);
    expect(movieResume(ctx, movie)).toEqual({ position: 1500, duration: 6000, percent: 25 });
  });

  it("R-076: Play on a series resumes the last episode, else starts S1E1", async () => {
    const ctx = await context();
    const series = await item(ctx, "series", "3300");
    const result = await seriesDetails(ctx, series);
    if (result.kind !== "ok") throw new Error("expected seasons");
    const seasons = result.details.seasons;
    expect(seasons.map((s) => s.number)).toEqual([1, 2]);
    expect(seriesPlayTarget(ctx, series, seasons)?.episode.id).toBe("880101");
    saveEpisodeProgress(
      ctx.store,
      ctx.catalogue.playlistId,
      "3300",
      { id: "880203", seasonNumber: 2, episodeNumber: 3 },
      300,
      1800,
      false,
    );
    const target = defined(seriesPlayTarget(ctx, series, seasons));
    expect(target.episode.id).toBe("880203");
    expect(target.resume).toMatchObject({ position: 300, percent: 17 });
  });

  it("R-060: an item's category decides whether it is adult", async () => {
    const ctx = await context();
    expect(await isAdultItem(ctx, await item(ctx, "movie", "55004"))).toBe(true);
    expect(await isAdultItem(ctx, await item(ctx, "movie", "55000"))).toBe(false);
  });

  it("Stalker: a favourite that is not stored is found among the favourite objects", async () => {
    const ctx = await context(portal);
    const obj: CatalogueItem = {
      kind: "movie",
      item_id: "9999",
      name: "Saved portal movie",
      icon: "",
      category_id: "20",
      tv_archive: 0,
      tv_archive_duration: 0,
    };
    expect(toggleFavourite(ctx, obj, false)).toBe("added");
    expect((await findItem(ctx, "movie", "9999"))?.name).toBe("Saved portal movie");
  });
});

describe("My List", () => {
  it("R-062 / R-070: favourites toggle; adult items are refused; removing always works", async () => {
    const ctx = await context();
    const movie = await item(ctx, "movie", "55001");
    expect(toggleFavourite(ctx, movie, false)).toBe("added");
    expect(isFavouriteItem(ctx, movie)).toBe(true);
    expect(toggleFavourite(ctx, movie, false)).toBe("removed");
    expect(toggleFavourite(ctx, await item(ctx, "movie", "55004"), true)).toBe("refused_adult");
  });

  it("R-070: a full list refuses new favourites (D-037)", async () => {
    const ctx = await context();
    ctx.store.set(
      playlistKeys(ctx.catalogue.playlistId).favourites("vod"),
      JSON.stringify(Array.from({ length: 200 }, (_, i) => String(i))),
    );
    expect(toggleFavourite(ctx, await item(ctx, "movie", "55001"), false)).toBe("full");
  });

  it("R-072 / R-063: viewed channels go first; adult channels are not recorded", async () => {
    const ctx = await context();
    recordChannelView(ctx, await item(ctx, "live", "10000"), false);
    recordChannelView(ctx, await item(ctx, "live", "10001"), false);
    expect(recordChannelView(ctx, await item(ctx, "live", "10004"), true)).toBe(false);
    expect((await recentChannels(ctx)).map((c) => c.item_id)).toEqual(["10001", "10000"]);
  });

  it("R-074: Continue Watching lists the movies with progress, newest first", async () => {
    const ctx = await context();
    const pid = ctx.catalogue.playlistId;
    saveMovieProgress(ctx.store, pid, "55001", 100, 1000, false, 1);
    saveMovieProgress(ctx.store, pid, "55002", 100, 1000, false, 2);
    expect((await continueWatching(ctx, "movie")).map((e) => e.item.item_id)).toEqual([
      "55002",
      "55001",
    ]);
  });

  it("recent searches: newest first, no duplicates, max 10, clearable", () => {
    const store = memoryStore();
    for (let i = 0; i < 12; i++) addRecentSearch(store, "p1", `query ${i}`);
    addRecentSearch(store, "p1", "QUERY 5");
    const list = recentSearches(store, "p1");
    expect(list).toHaveLength(10);
    expect(list[0]).toBe("QUERY 5");
    expect(list.filter((q) => q.toLowerCase() === "query 5")).toHaveLength(1);
    clearRecentSearches(store, "p1");
    expect(recentSearches(store, "p1")).toEqual([]);
  });
});

describe("search", () => {
  it("R-064: finds channels, movies and series; never items from adult categories", async () => {
    const ctx = await context();
    expect(isSearchable("f")).toBe(false);
    const all = await searchContent(ctx, "fixture", "all");
    expect(all.live.length).toBeGreaterThan(0);
    expect(all.movie.length).toBeGreaterThan(0);
    expect(all.series.length).toBeGreaterThan(0);
    expect(all.live.some((c) => c.category_id === "14")).toBe(false);
    expect(all.movie.some((m) => m.category_id === "44")).toBe(false);
    const movies = await searchContent(ctx, "fixture movie", "movie");
    expect(movies.live).toEqual([]);
    expect(movies.movie.length).toBeGreaterThan(20);
  });

  it("R-051 / R-098: Stalker searches movies and series on the portal; no live search", async () => {
    const ctx = await context(portal);
    const results = await searchContent(ctx, "portal", "all");
    expect(results.liveUnavailable).toBe(true);
    expect(results.live).toEqual([]);
    expect(results.movie.length).toBeGreaterThan(0);
  });
});

describe("parental control", () => {
  it("R-061: adult categories ask for the PIN (default 0000) unless control is off", async () => {
    const store = memoryStore();
    const parental = new ParentalControl(store, async () => true);
    expect(parental.pin).toBe("0000");
    expect(parental.locks(true)).toBe(true);
    expect(parental.locks(false)).toBe(false);
    expect(parental.check("1234")).toBe(false);
    expect(parental.check("0000")).toBe(true);
    await parental.turnOff();
    expect(parental.locks(true)).toBe(false);
    expect(parental.settingsLocked).toBe(false);
  });

  it("R-065: a new PIN needs both fields, equal, 4 digits", async () => {
    const parental = new ParentalControl(memoryStore(), async () => true);
    expect(await parental.setPin("", "")).toEqual({ error: "fill_all_fields" });
    expect(await parental.setPin("1234", "1235")).toEqual({ error: "pins_do_not_match" });
    expect(await parental.setPin("12a4", "12a4")).toEqual({ error: "must_be_4_digits" });
    expect(await parental.setPin("1234", "1234")).toEqual({ saved: "synced" });
    expect(parental.check("1234")).toBe(true);
  });

  it("R-066: the PIN is kept on the device when the backend cannot be reached", async () => {
    const store = memoryStore();
    const sent: string[] = [];
    const parental = new ParentalControl(store, async (pin) => {
      sent.push(pin);
      return false;
    });
    expect(await parental.setPin("4321", "4321")).toEqual({ saved: "saved_on_device_only" });
    expect(store.get(globalKeys.parentPin)).toBe("4321");
    expect(sent).toEqual(["4321"]);
  });
});
