// M2 acceptance: a fixture playlist of each type syncs into SQLite; category pages, lookups by
// id and search queries return the right data.
import { fixturePlaylists } from "@/api/__fixtures__/ibo";
import { defined } from "@/content/testing/defined";
import { DOWN_HOST } from "@/api/__fixtures__/router";
import { M3U_URL } from "@/api/__fixtures__/hosts";
import { XTREAM_BIG_COUNT } from "@/api/__fixtures__/xtream";
import { STALKER_CHANNEL_TOTAL } from "@/api/__fixtures__/stalker";
import { AuthError } from "@/api/errors";
import { parsePlaylist } from "@/api/ibo/playlists";
import type { Playlist } from "@/api/ibo/types";
import { memoryStore } from "@/api/store";
import type { Db } from "@/db/database";
import {
  categories,
  itemById,
  itemsByIds,
  itemsPage,
  search,
  syncState,
} from "@/db/queries/catalogue";
import { openTestDb } from "@/db/testing/testDb";
import { globalKeys } from "@/storage/keys";

import { CatalogueSession, login } from "../catalogue";
import { M3uSource } from "../M3uSource";

const [xtream, m3u, stalker] = fixturePlaylists.map(parsePlaylist) as [
  Playlist,
  Playlist,
  Playlist,
];

async function session(playlist: Playlist, db: Db, store = memoryStore()) {
  const { source, account, fellBack } = await login(playlist, store);
  return { session: new CatalogueSession(db, source, playlist), account, fellBack, store };
}

describe("Xtream playlist → SQLite", () => {
  it("syncs each section on demand and serves pages, lookups and search", async () => {
    const db = await openTestDb();
    const { session: s, account, store } = await session(xtream, db);
    expect(account?.status).toBe("Active");
    // R-050: load on demand defaults to on after the first Xtream login.
    expect(store.get(globalKeys.loadOnDemand)).toBe("1");
    expect(s.isLoaded("live")).toBe(false);

    const progress: number[] = [];
    await s.ensureSection("live", { onProgress: (p) => progress.push(p.fraction) });
    expect(progress[progress.length - 1]).toBe(1);
    expect(s.isLoaded("live")).toBe(true);

    const live = await categories(db, s.playlistId, "live");
    expect(live.map((c) => c.category_name)).toEqual([
      "UK | SPORTS",
      "UK | NEWS",
      "FR | GENERAL",
      "KIDS",
      "XXX ADULTS",
      "Uncategorized",
    ]);
    expect(live.find((c) => c.category_name === "XXX ADULTS")?.is_adult).toBe(true);
    expect(live[0]?.item_count).toBe(10);

    const page = await itemsPage(db, s.playlistId, "live", "10", { offset: 0, limit: 3 });
    expect(page.map((i) => i.item_id)).toEqual(["10000", "10005", "10010"]);
    expect(await itemById(db, s.playlistId, "live", "10005")).toMatchObject({
      name: "Fixture Channel 6",
      tv_archive: 0,
    });
    expect(
      (await itemsByIds(db, s.playlistId, "live", ["10010", "missing", "10000"])).map(
        (i) => i.item_id,
      ),
    ).toEqual(["10010", "10000"]);

    await s.ensureSection("movie");
    const hits = await search(db, s.playlistId, "fixture movie 1", { kinds: ["movie"] });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.name.toLowerCase().includes("fixture movie 1"))).toBe(true);
    expect((await syncState(db, s.playlistId, "movie"))?.item_count).toBe(50);
  });

  it("sorts pages (R-090 in SQL): added, rating and A-Z", async () => {
    const db = await openTestDb();
    const { session: s } = await session(xtream, db);
    await s.ensureSection("movie");
    const byAdded = await itemsPage(db, s.playlistId, "movie", "40", {
      offset: 0,
      limit: 50,
      sort: "added",
    });
    const added = byAdded.map((i) => i.added ?? 0);
    expect([...added].sort((a, b) => b - a)).toEqual(added);
    const byName = await itemsPage(db, s.playlistId, "movie", "40", {
      offset: 0,
      limit: 50,
      sort: "a_z",
    });
    const names = byName.map((i) => i.name.toLowerCase());
    expect([...names].sort()).toEqual(names);
    const byRating = await itemsPage(db, s.playlistId, "movie", "40", {
      offset: 0,
      limit: 50,
      sort: "rating",
    });
    const ratings = byRating.map((i) => i.rating ?? 0);
    expect([...ratings].sort((a, b) => b - a)).toEqual(ratings);
  });

  it("writes the 20,000-channel playlist", async () => {
    const db = await openTestDb();
    const big = { ...xtream, url: "http://xtream-big.fixture.test" };
    const { session: s } = await session(big, db);
    await s.ensureSection("live");
    expect((await syncState(db, s.playlistId, "live"))?.item_count).toBe(XTREAM_BIG_COUNT);
    // Performance budget (architecture.md): first search results in < 300 ms.
    const started = Date.now();
    const hits = await search(db, s.playlistId, "channel 19999", { kinds: ["live"] });
    const broad = await search(db, s.playlistId, "fixture", { kinds: ["live"] });
    expect(Date.now() - started).toBeLessThan(300);
    expect(hits[0]?.item_id).toBe(String(10_000 + 19_998));
    expect(broad).toHaveLength(60);
  });

  it("R-023: rejected credentials are an AuthError, not an M3U fallback", async () => {
    const db = await openTestDb();
    await expect(
      session({ ...xtream, password: "wrong", origin_url: M3U_URL }, db),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("R-024: a network failure retries the playlist as M3U from its get.php URL", async () => {
    const db = await openTestDb();
    const broken: Playlist = { ...xtream, url: `http://${DOWN_HOST}`, origin_url: M3U_URL };
    const { session: s, fellBack } = await session(broken, db);
    expect(fellBack).toBe(true);
    expect(s.source).toBeInstanceOf(M3uSource);
    await s.ensureSection("live");
    expect((await categories(db, s.playlistId, "live")).length).toBeGreaterThan(0);
  });

  it("R-024 / Q-behaviour-fixes #8: when M3U also fails, the original Xtream error is shown", async () => {
    const db = await openTestDb();
    const broken: Playlist = {
      ...xtream,
      url: `http://${DOWN_HOST}`,
      origin_url: `http://${DOWN_HOST}/get.php`,
    };
    await expect(session(broken, db)).rejects.toMatchObject({ name: "NetworkError" });
  });
});

describe("M3U playlist → SQLite", () => {
  it("syncs all three kinds from one download", async () => {
    const db = await openTestDb();
    const { session: s } = await session(m3u, db);
    await s.loadAll();
    const live = await categories(db, s.playlistId, "live");
    expect(live.map((c) => c.category_id)).toEqual(["UK | General", "UK | Sports"]);
    const movies = await itemsPage(db, s.playlistId, "movie", "Movies | 2024", {
      offset: 0,
      limit: 10,
    });
    expect(movies[0]?.url).toContain("/movie/");
    const series = await itemById(db, s.playlistId, "series", "The Bear");
    expect(series?.data?.seasons).toHaveLength(2);
    const info = await s.source.seriesInfo(defined(series));
    expect(info?.seasons[0]?.episodes.map((e) => e.id)).toEqual(["Season 01:01", "Season 01:02"]);
    expect((await search(db, s.playlistId, "bear", { kinds: ["series"] }))[0]?.name).toBe(
      "The Bear",
    );
  });
});

describe("Stalker portal → SQLite", () => {
  it("syncs categories, then caches pages as they load", async () => {
    const db = await openTestDb();
    const { session: s } = await session(stalker, db);
    await s.ensureSection("live");
    const genres = await categories(db, s.playlistId, "live");
    expect(genres.map((g) => g.category_name)).toEqual(["UK | Sports", "UK | News", "XXX Adults"]);

    let next = await s.loadPages("live", "5", 1);
    while (next !== undefined) next = await s.loadPages("live", "5", next);
    const all = await itemsPage(db, s.playlistId, "live", "5", { offset: 0, limit: 100 });
    expect(all).toHaveLength(STALKER_CHANNEL_TOTAL);
    expect(await itemById(db, s.playlistId, "live", "1203")).toMatchObject({
      cmd: "ffmpeg http://localhost/ch/1203_",
    });

    // Movies: up to 5 pages per batch.
    await s.ensureSection("movie");
    expect(await s.loadPages("movie", "20", 1)).toBeUndefined();
    expect(
      await itemsPage(db, s.playlistId, "movie", "20", { offset: 0, limit: 100 }),
    ).toHaveLength(20);
  });

  it("resolves stream links at play time with the MAG headers", async () => {
    const db = await openTestDb();
    const { session: s } = await session(stalker, db);
    await s.ensureSection("live");
    await s.loadPages("live", "5", 1);
    const channel = await itemById(db, s.playlistId, "live", "1200");
    const target = await s.source.streamUrl({ kind: "live", item: defined(channel) });
    expect(target.url).toContain("play_token=");
    expect(target.headers?.["User-Agent"]).toContain("MAG200");
  });
});

describe("refresh (R-052 / N-09)", () => {
  it("R-052: re-downloads the sections loaded so far", async () => {
    const db = await openTestDb();
    const { session: s } = await session(xtream, db);
    await s.ensureSection("live");
    const before = (await syncState(db, s.playlistId, "live"))?.synced_at;
    await s.refresh();
    expect(s.isLoaded("live")).toBe(true);
    expect(s.isLoaded("movie")).toBe(false);
    expect((await syncState(db, s.playlistId, "live"))?.synced_at).toBeGreaterThanOrEqual(
      before ?? 0,
    );
  });
});
