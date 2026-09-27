import { XTREAM_PASS, XTREAM_URL, XTREAM_USER } from "@/api/__fixtures__/hosts";
import { defined } from "@/content/testing/defined";
import { memoryStore } from "@/api/store";
import { openTestDb } from "@/db/testing/testDb";
import { search } from "@/db/queries/catalogue";
import { globalKeys, playlistKeys } from "@/storage/keys";

import { writeCatalogue } from "../../sync";
import type { CatalogueItem } from "../../types";
import { XtreamSource } from "../../XtreamSource";
import {
  addCustomMember,
  addStalkerCustomMember,
  createCustomCategory,
  customCategories,
  customMembers,
  customRows,
  deleteCustomCategory,
  favouriteAction,
  setCustomCategoriesEnabled,
  validCustomName,
} from "../customCategories";
import { buildRows } from "../content";
import {
  applyArrangement,
  applyLegacyOrders,
  canMoveCategory,
  channelTapAction,
  DEFAULT_SORTS,
  epgSource,
  GUIDE,
  guideGivesUp,
  guideTapAction,
  hasArchive,
  hasChannelOrder,
  hiddenCategories,
  liveInitialization,
  liveSearchAvailable,
  moveStep,
  orderChannels,
  orderRows,
  readArrangement,
  replayAvailability,
  saveArrangement,
  saveChannelOrder,
  saveRowOrder,
  sortItems,
  sortOptions,
  toggleHiddenCategory,
} from "../live";
import {
  buildSportsRows,
  hasSportsChannels,
  isSportsCategory,
  isSportsChannel,
  mySportsChannelIds,
  SPORTS_MODE,
  toggleMySportsChannel,
} from "../sports";

const PID = "4821";
const ch = (id: string, name = `Ch ${id}`, category = "10"): CatalogueItem => ({
  kind: "live",
  item_id: id,
  name,
  icon: "",
  category_id: category,
  tv_archive: 0,
  tv_archive_duration: 0,
});

describe("H. Custom categories", () => {
  it("R-080: default off; off toggles Favourites directly, on opens the chooser; data kept", () => {
    const store = memoryStore();
    expect(favouriteAction(false, false)).toBe("toggle_favourite");
    expect(favouriteAction(true, false)).toBe("open_chooser");
    const cat = createCustomCategory(store, "Mine");
    expect(customRows(store)).toEqual([]);
    setCustomCategoriesEnabled(store, true);
    expect(customRows(store)).toEqual([cat]);
    setCustomCategoriesEnabled(store, false);
    expect(customCategories(store)).toEqual([cat]);
  });

  it("R-081: definitions are global; membership per playlist and type, max 500 (Stalker objects)", () => {
    const store = memoryStore();
    const cat = defined(createCustomCategory(store, "Mine"));
    expect(store.get(globalKeys.customCategories)).toContain('"Mine"');
    addCustomMember(store, PID, "live", cat.id, "1", false);
    expect(customMembers(store, PID, "live", cat.id)).toEqual(["1"]);
    expect(customMembers(store, "other", "live", cat.id)).toEqual([]);
    expect(addCustomMember(store, PID, "live", cat.id, "2", true)).toBe(false);
    for (let i = 0; i < 505; i++) addCustomMember(store, PID, "vod", cat.id, String(i), false);
    expect(customMembers(store, PID, "vod", cat.id)).toHaveLength(500);
    expect(customMembers(store, PID, "vod", cat.id)[0]).toBe("5");
    addStalkerCustomMember(store, PID, "live", cat.id, ch("9"), false);
    expect(store.get(playlistKeys(PID).stalkerCustomMembers("live", cat.id))).toContain('"9"');
  });

  it("R-082: custom rows come right after Favourites", () => {
    const rows = buildRows({
      kind: "live",
      source: "xtream",
      categories: [],
      customRows: [{ id: "cc1", name: "Mine", icon: "cc-heart" }],
    });
    expect(rows.map((r) => r.id)).toEqual(["all", "recent", "favourite", "cc1"]);
  });

  it("R-083: deleting a category removes it and its membership for the current playlist", () => {
    const store = memoryStore();
    const cat = defined(createCustomCategory(store, "Mine"));
    addCustomMember(store, PID, "live", cat.id, "1", false);
    addCustomMember(store, "other", "live", cat.id, "1", false);
    deleteCustomCategory(store, PID, cat.id);
    expect(customCategories(store)).toEqual([]);
    expect(customMembers(store, PID, "live", cat.id)).toEqual([]);
    expect(customMembers(store, "other", "live", cat.id)).toEqual(["1"]);
  });

  it("R-084: names are trimmed, 1–32 characters; default icon cc-heart", () => {
    expect(validCustomName("  Kids  ")).toBe("Kids");
    expect(validCustomName("   ")).toBeUndefined();
    expect(validCustomName("x".repeat(33))).toBeUndefined();
    expect(createCustomCategory(memoryStore(), "Mine")?.icon).toBe("cc-heart");
  });
});

describe("Sports mode", () => {
  it("R-100: include/exclude keyword rules; My Sports Channels first (global); empty categories dropped", () => {
    expect(isSportsCategory("UK | SPORTS")).toBe(true);
    expect(isSportsCategory("SPORTS NEWS")).toBe(false);
    expect(isSportsChannel("beIN Sports 1")).toBe(true);
    expect(isSportsChannel("Sky Sports F1")).toBe(false);
    const store = memoryStore();
    toggleMySportsChannel(store, "3");
    expect(mySportsChannelIds(store)).toEqual(["3"]);
    const rows = buildSportsRows(
      [
        {
          category_id: "10",
          category_name: "UK | SPORTS",
          channels: [ch("1", "Sky Sports Main"), ch("2", "Sky Sports F1")],
        },
        { category_id: "11", category_name: "UK | NEWS", channels: [ch("3", "BBC News")] },
        { category_id: "12", category_name: "FOOTBALL", channels: [ch("4", "Cartoon Network")] },
      ],
      mySportsChannelIds(store),
    );
    expect(rows.map((r) => [r.id, r.channels.map((c) => c.item_id)])).toEqual([
      ["sports_my", ["3"]],
      ["10", ["1"]],
    ]);
    expect(hasSportsChannels([{ id: "sports_my", name: "", channels: [] }])).toBe(false);
  });

  it("R-101: in sports mode the favourite action opens the chooser; no arrange; sports-only search", () => {
    expect(favouriteAction(false, true)).toBe("open_chooser");
    expect(SPORTS_MODE).toEqual({
      favouriteOpensChooser: true,
      arrangeAvailable: false,
      searchLimitedToSports: true,
    });
  });
});

describe("I. Live TV rules", () => {
  it("R-090: sort orders, defaults and the Stalker options", () => {
    const items = [
      { ...ch("1", "b"), added: 1, rating: 5, num: 3 },
      { ...ch("2", "a"), added: 3, rating: 9, num: 1 },
      { ...ch("3", "c"), added: 2, rating: 7, num: 2 },
    ];
    expect(sortItems(items, "added").map((i) => i.item_id)).toEqual(["2", "3", "1"]);
    expect(sortItems(items, "rating").map((i) => i.item_id)).toEqual(["2", "3", "1"]);
    expect(sortItems(items, "a_z").map((i) => i.name)).toEqual(["a", "b", "c"]);
    expect(sortItems(items, "z_a").map((i) => i.name)).toEqual(["c", "b", "a"]);
    expect(sortItems(items, "number").map((i) => i.item_id)).toEqual(["2", "3", "1"]);
    expect(sortItems(items, "default").map((i) => i.item_id)).toEqual(["1", "2", "3"]);
    // Judged on the first item: without the field, provider order is kept.
    expect(sortItems([ch("1"), { ...ch("2"), rating: 9 }], "rating").map((i) => i.item_id)).toEqual(
      ["1", "2"],
    );
    expect(DEFAULT_SORTS).toEqual({ movie: "added", series: "added", replay: "default" });
    expect(sortOptions("movie", "stalker")).toEqual(["default", "added", "a_z", "rating"]);
    expect(sortOptions("series", "stalker")).toEqual(["default", "added", "a_z"]);
    expect(sortOptions("movie", "xtream")).toContain("z_a");
  });

  it("R-091: first tap previews, a tap on the playing channel goes fullscreen", () => {
    expect(channelTapAction(undefined, "1")).toBe("preview");
    expect(channelTapAction("2", "1")).toBe("preview");
    expect(channelTapAction("1", "1")).toBe("fullscreen");
  });

  it("R-092: Live Initialization default / last / favorite, with fallbacks; Stalker opens the first real category", () => {
    const rows = [
      { id: "all", channels: [] },
      { id: "recent", channels: [ch("7")] },
      { id: "favourite", channels: [ch("4")] },
      { id: "10", channels: [ch("4"), ch("7")] },
    ];
    expect(liveInitialization("default", "xtream", rows, [])).toEqual({
      categoryId: "favourite",
      channelId: "4",
    });
    expect(liveInitialization("last", "xtream", rows, ["7"])).toEqual({
      categoryId: "10",
      channelId: "7",
    });
    expect(liveInitialization("favorite", "xtream", rows, [])).toEqual({
      categoryId: "favourite",
      channelId: "4",
    });
    const noFav = rows.map((r) => (r.id === "favourite" ? { ...r, channels: [] } : r));
    expect(liveInitialization("favorite", "xtream", noFav, [])).toEqual({
      categoryId: "recent",
      channelId: "7",
    });
    expect(
      liveInitialization(
        "default",
        "stalker",
        [
          { id: "recent", channels: [] },
          { id: "5", channels: [] },
        ],
        [],
      ),
    ).toEqual({
      categoryId: "5",
    });
  });

  it("R-093: legacy Move orders apply per playlist; Search All cannot move, nothing above row 1", () => {
    const store = memoryStore();
    store.set(playlistKeys(PID).categoryOrders, JSON.stringify([{ id: "c", position: 0 }]));
    store.set(
      playlistKeys(PID).channelOrders,
      JSON.stringify({ a: [{ id: "2", name: "Ch 2", position: 0 }] }),
    );
    const cats = [
      { category_id: "a", channels: [ch("1"), ch("2")] },
      { category_id: "b", channels: [] },
      { category_id: "c", channels: [] },
    ];
    const ordered = applyLegacyOrders(store, PID, cats);
    expect(ordered.map((c) => c.category_id)).toEqual(["c", "a", "b"]);
    expect(ordered[1]?.channels.map((c) => c.item_id)).toEqual(["2", "1"]);
    const rows = [{ id: "all" }, { id: "recent" }, { id: "10" }];
    expect(canMoveCategory(rows, 0, 1)).toBe(false);
    expect(canMoveCategory(rows, 2, 0)).toBe(false);
    expect(canMoveCategory(rows, 2, 1)).toBe(true);
  });

  it("R-093: phone moves step by step and save the whole order, which replays exactly", () => {
    const store = memoryStore();
    const rows = ["all", "recent", "favourite", "a", "b", "c"].map((id) => ({ id }));
    // Search All stays first and nothing moves above it; the ends stop.
    expect(moveStep(rows, 0, 1, "category")).toBeUndefined();
    expect(moveStep(rows, 1, -1, "category")).toBeUndefined();
    expect(moveStep(rows, 5, 1, "category")).toBeUndefined();
    const moved = defined(moveStep(rows, 5, -1, "category"));
    expect(moved.map((r) => r.id)).toEqual(["all", "recent", "favourite", "a", "c", "b"]);
    saveRowOrder(store, PID, moved);
    expect(orderRows(store, PID, rows).map((r) => r.id)).toEqual(moved.map((r) => r.id));
    // A category the provider added later keeps its place after the ordered ones.
    expect(orderRows(store, PID, [...rows, { id: "d" }]).map((r) => r.id)).toEqual([
      "all",
      "recent",
      "favourite",
      "a",
      "c",
      "b",
      "d",
    ]);

    const channels = [ch("1"), ch("2"), ch("3")];
    expect(hasChannelOrder(store, PID, "10")).toBe(false);
    const withIds = channels.map((c) => ({ ...c, id: c.item_id }));
    const down = defined(moveStep(withIds, 0, 1, "channel"));
    expect(moveStep(withIds, 0, -1, "channel")).toBeUndefined();
    saveChannelOrder(store, PID, "10", down);
    expect(hasChannelOrder(store, PID, "10")).toBe(true);
    expect(orderChannels(store, PID, "10", channels).map((c) => c.item_id)).toEqual([
      "2",
      "1",
      "3",
    ]);
    // The TV matches a channel by id and name: a renamed channel is not moved, the others are.
    const renamed = [ch("2", "New name"), ch("3"), ch("1")];
    expect(orderChannels(store, PID, "10", renamed).map((c) => c.item_id)).toEqual(["2", "1", "3"]);
    expect(orderChannels(store, PID, "10", renamed)[0]?.name).toBe("New name");
  });

  it("R-094: arrangement keeps pinned rows, then chosen ids, then the rest; empty removes the key", () => {
    const cats = ["all", "recent", "favourite", "a", "b", "c"].map((category_id) => ({
      category_id,
    }));
    expect(applyArrangement(cats, ["c", "missing", "a"]).map((c) => c.category_id)).toEqual([
      "all",
      "recent",
      "favourite",
      "c",
      "a",
      "b",
    ]);
    const store = memoryStore();
    saveArrangement(store, PID, ["favourite", "c", "a"]);
    expect(readArrangement(store, PID)).toEqual(["c", "a"]);
    saveArrangement(store, PID, ["recent"]);
    expect(store.get(playlistKeys(PID).liveCategoryArrangement)).toBeUndefined();
  });

  it("R-095: EPG from Xtream or the portal; M3U has none", () => {
    expect(epgSource("xtream")).toBe("xtream");
    expect(epgSource("stalker")).toBe("stalker");
    expect(epgSource("m3u")).toBe("none");
  });

  it("R-096: guide limits; gives up when the first 8 rows are empty; past programmes do not play", () => {
    expect(GUIDE.maxConcurrent).toBe(4);
    expect(guideGivesUp([0, 0, 0, 0, 0, 0, 0, 0])).toBe(true);
    expect(guideGivesUp([0, 0, 3, 0, 0, 0, 0, 0])).toBe(false);
    expect(guideGivesUp([0, 0])).toBe(false);
    const now = new Date(2024, 8, 25, 20, 30);
    expect(
      guideTapAction({ start: "2024-09-25 20:00", stop: "2024-09-25 21:00", title: "" }, now),
    ).toBe("play_live");
    expect(
      guideTapAction({ start: "2024-09-25 21:00", stop: "2024-09-25 22:00", title: "" }, now),
    ).toBe("details");
    expect(
      guideTapAction({ start: "2024-09-25 18:00", stop: "2024-09-25 19:00", title: "" }, now),
    ).toBe("none");
  });

  it("R-097: Replay is Xtream-only; channels need tv_archive and a duration", () => {
    expect(replayAvailability("xtream")).toBe("available");
    expect(replayAvailability("stalker")).toBe("stalker_blocked");
    expect(replayAvailability("m3u")).toBe("not_available");
    expect(hasArchive({ tv_archive: 1, tv_archive_duration: 7 })).toBe(true);
    expect(hasArchive({ tv_archive: 1, tv_archive_duration: 0 })).toBe(false);
  });

  it("R-098: live search skips hidden categories and is not available on Stalker", async () => {
    expect(liveSearchAvailable("stalker")).toBe(false);
    const store = memoryStore();
    toggleHiddenCategory(store, PID, "live", "11");
    expect(hiddenCategories(store, PID, "live")).toEqual(["11"]);
    expect(toggleHiddenCategory(store, PID, "live", "all")).toBe(false);
    const db = await openTestDb();
    await writeCatalogue(db, PID, "live", {
      categories: [
        { category_id: "10", category_name: "A", parent_id: "0" },
        { category_id: "11", category_name: "B", parent_id: "0" },
      ],
      items: [ch("1", "Match 1", "10"), ch("2", "Match 2", "11")],
    });
    const hits = await search(db, PID, "match", {
      kinds: ["live"],
      hidden: { live: hiddenCategories(store, PID, "live") },
    });
    expect(hits.map((h) => h.item_id)).toEqual(["1"]);
  });

  it("R-099: the Xtream live URL is <host>/live/<user>/<pass>/<id>.ts", async () => {
    const source = new XtreamSource({
      id: "1",
      playlist_type: "xc",
      url: XTREAM_URL,
      username: XTREAM_USER,
      password: XTREAM_PASS,
    });
    expect((await source.streamUrl({ kind: "live", item: ch("10231") })).url).toBe(
      `${XTREAM_URL}/live/${XTREAM_USER}/${XTREAM_PASS}/10231.ts`,
    );
    const m3u8 = new XtreamSource(
      {
        id: "1",
        playlist_type: "xc",
        url: XTREAM_URL,
        username: XTREAM_USER,
        password: XTREAM_PASS,
      },
      { streamFormat: "m3u8" },
    );
    expect((await m3u8.streamUrl({ kind: "live", item: ch("1") })).url.endsWith(".m3u8")).toBe(
      true,
    );
  });
});
