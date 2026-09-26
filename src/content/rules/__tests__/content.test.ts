import { fixturePlaylists } from "@/api/__fixtures__/ibo";
import { parsePlaylist } from "@/api/ibo/playlists";
import type { Playlist } from "@/api/ibo/types";
import { classifyAttributed, groupSeries } from "@/api/m3u/parser";
import type { RandomSource } from "@/api/random";
import { memoryStore } from "@/api/store";
import { categories, recentlyAdded, topRatedCandidates } from "@/db/queries/catalogue";
import { openTestDb } from "@/db/testing/testDb";
import { globalKeys } from "@/storage/keys";

import { CatalogueSession, login } from "../../catalogue";
import { writeCatalogue } from "../../sync";
import type { CatalogueItem } from "../../types";
import {
  buildRows,
  firstLiveCategory,
  isNewlyAdded,
  MovieInfoCache,
  NEW_WINDOW_SECONDS,
  pickTopRated,
  searchScope,
  sectionsAtLogin,
} from "../content";

const xtream = parsePlaylist(fixturePlaylists[0]) as Playlist;
const item = (id: string, rating?: number, added?: number, category = "c1"): CatalogueItem => ({
  kind: "movie",
  item_id: id,
  name: `Movie ${id}`,
  icon: "",
  category_id: category,
  rating,
  added,
  tv_archive: 0,
  tv_archive_duration: 0,
});
const sequence = (values: number[]): RandomSource => {
  let i = 0;
  return { int: (max) => (values[i++] ?? 0) % max };
};

describe("E. Content loading and caching", () => {
  it("R-050: load on demand loads nothing at login; off loads all six lists; Stalker is always on demand", async () => {
    expect(sectionsAtLogin("xtream", true)).toEqual([]);
    expect(sectionsAtLogin("xtream", false)).toEqual(["live", "movie", "series"]);
    expect(sectionsAtLogin("stalker", false)).toEqual([]);
    const db = await openTestDb();
    const store = memoryStore();
    const { source } = await login(xtream, store);
    expect(store.get(globalKeys.loadOnDemand)).toBe("1");
    const session = new CatalogueSession(db, source, xtream);
    await session.loadAll();
    expect(["live", "movie", "series"].every((k) => session.isLoaded(k as "live"))).toBe(true);
  });

  it("R-051: search is always available (Q-search-lod); Stalker searches the portal, no live search", () => {
    expect(searchScope("xtream")).toEqual({
      kinds: ["live", "movie", "series"],
      portalSearch: false,
    });
    expect(searchScope("stalker")).toEqual({ kinds: ["movie", "series"], portalSearch: true });
  });

  it("R-053: virtual rows, custom rows after Favourites, provider categories; Stalker has fewer", () => {
    const cats = [
      { category_id: "10", category_name: "Sports", is_adult: false },
      { category_id: "undefined", category_name: "Uncategorized", is_adult: false },
    ];
    const ids = (rows: ReturnType<typeof buildRows>) => rows.map((r) => r.id);
    expect(ids(buildRows({ kind: "live", source: "xtream", categories: cats }))).toEqual([
      "all",
      "recent",
      "favourite",
      "10",
      "undefined",
    ]);
    expect(
      ids(
        buildRows({
          kind: "movie",
          source: "xtream",
          categories: cats,
          customRows: [{ id: "cc1", name: "Mine", icon: "cc-heart" }],
        }),
      ),
    ).toEqual(["all", "recent", "favourite", "cc1", "top_rated", "newly_added", "10", "undefined"]);
    expect(ids(buildRows({ kind: "series", source: "xtream", categories: cats }))).toContain(
      "recently_modified",
    );
    expect(ids(buildRows({ kind: "movie", source: "stalker", categories: cats }))).toEqual([
      "recent",
      "favourite",
      "10",
      "undefined",
    ]);
    // Hidden rows vanish; Search All cannot be hidden.
    expect(
      ids(
        buildRows({
          kind: "live",
          source: "xtream",
          categories: cats,
          hidden: ["all", "recent", "10"],
        }),
      ),
    ).toEqual(["all", "favourite", "undefined"]);
  });

  it("R-053: Uncategorized exists only when some items have no category", async () => {
    const db = await openTestDb();
    await writeCatalogue(db, "p", "movie", {
      categories: [{ category_id: "c1", category_name: "A", parent_id: "0" }],
      items: [item("1")],
    });
    expect((await categories(db, "p", "movie")).map((c) => c.category_id)).toEqual(["c1"]);
    await writeCatalogue(db, "p", "movie", {
      categories: [{ category_id: "c1", category_name: "A", parent_id: "0" }],
      items: [item("1"), item("2", undefined, undefined, "undefined")],
    });
    expect((await categories(db, "p", "movie")).map((c) => c.category_id)).toEqual([
      "c1",
      "undefined",
    ]);
  });

  it("R-054: added within 15 days, adult categories excluded (incl. 'sex')", async () => {
    const now = 2_000_000_000;
    expect(isNewlyAdded(now - NEW_WINDOW_SECONDS, now)).toBe(true);
    expect(isNewlyAdded(now - NEW_WINDOW_SECONDS - 1, now)).toBe(false);
    expect(isNewlyAdded(undefined, now)).toBe(false);
    const db = await openTestDb();
    await writeCatalogue(db, "p", "movie", {
      categories: [
        { category_id: "c1", category_name: "Action", parent_id: "0" },
        { category_id: "c2", category_name: "Sex Comedies", parent_id: "0" },
      ],
      items: [
        item("new", 5, now - 60),
        item("old", 5, now - NEW_WINDOW_SECONDS - 60),
        item("hidden", 5, now - 60, "c2"),
      ],
    });
    expect(
      (await recentlyAdded(db, "p", "movie", now, NEW_WINDOW_SECONDS)).map((i) => i.item_id),
    ).toEqual(["new"]);
  });

  it("R-055: top 10 by rating; more than 10 sharing the best → 10 of them shuffled; shuffle at ≥ 20", async () => {
    const db = await openTestDb();
    const many = Array.from({ length: 25 }, (_, i) => item(String(i), i < 22 ? 9.5 : 5));
    await writeCatalogue(db, "p", "movie", {
      categories: [{ category_id: "c1", category_name: "A", parent_id: "0" }],
      items: many,
    });
    const { top, pool } = await topRatedCandidates(db, "p", "movie");
    expect(pool).toHaveLength(22);
    const picked = pickTopRated(
      top,
      pool,
      sequence([3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6]),
    );
    expect(picked.items).toHaveLength(10);
    expect(picked.canShuffle).toBe(true);
    expect(picked.items.every((i) => i.rating === 9.5)).toBe(true);
    const few = pickTopRated([item("a", 9), item("b", 8)], [item("a", 9)]);
    expect(few).toEqual({ items: [item("a", 9), item("b", 8)], canShuffle: false });
  });

  it("R-056: M3U types by URL, group-title categories, 'Season xx' grouping", () => {
    expect(classifyAttributed("http://h/movie/1.mp4")).toBe("vod");
    expect(classifyAttributed("http://h/vod/1")).toBe("vod");
    expect(classifyAttributed("http://h/get?type=movie")).toBe("vod");
    expect(classifyAttributed("http://h/series/1.mp4")).toBe("series");
    expect(classifyAttributed("http://h/live/1")).toBe("live");
    const series = groupSeries([
      { stream_id: "1", name: "Show S01 E02", stream_icon: "", url: "u", num: 1, category_id: "g" },
    ]);
    expect(series[0]?.seasons[0]?.name).toBe("Season 01");
  });

  it("R-057: info cache: max 100 keys (the second key dropped), cleared on another host", () => {
    const store = memoryStore();
    const cache = new MovieInfoCache(store, "http://a");
    for (let i = 0; i < 100; i++) cache.set("movie", String(i), { name: String(i) });
    expect(cache.get("movie", "0")).toBeUndefined();
    expect(cache.get<{ name: string }>("movie", "99")?.name).toBe("99");
    expect(
      Object.keys(JSON.parse(store.get(globalKeys.savedMovieInfo) ?? "{}")).length,
    ).toBeLessThanOrEqual(100);
    expect(new MovieInfoCache(store, "http://b").get("movie", "99")).toBeUndefined();
  });

  it("R-058: Live opens the first category with channels (Stalker: the first real category)", () => {
    expect(
      firstLiveCategory("xtream", [
        { category_id: "a", item_count: 0 },
        { category_id: "b", item_count: 3 },
      ]),
    ).toBe("b");
    expect(
      firstLiveCategory("stalker", [
        { category_id: "*", item_count: 0 },
        { category_id: "5", item_count: 0 },
      ]),
    ).toBe("5");
  });
});
