import { readFileSync } from "fs";
import { join } from "path";

import { config } from "@/config";

import { CACHED_TMDB_ID } from "../__fixtures__/services";
import { fixtureTransport } from "../fixtureTransport";
import { NetworkError } from "../errors";
import { fetchTransport, getJson, setTransport } from "../http";
import { cachedImages } from "../imageCache";
import {
  cleanSearchQuery,
  setTmdbApiKey,
  tmdbCredits,
  tmdbImages,
  tmdbImageUrl,
  tmdbSearch,
} from "../tmdb";

describe("TMDB (services.md)", () => {
  afterEach(() => setTmdbApiKey(undefined));

  it("images, credits and search", async () => {
    const images = await tmdbImages("movie", "693134");
    expect(images.backdrops[0]?.file_path).toBe("/backdrop.jpg");
    expect(tmdbImageUrl("w1280", "/backdrop.jpg")).toBe(
      "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
    );
    expect((await tmdbCredits("693134"))[0]?.name).toBe("Fixture Actor");
    expect((await tmdbSearch("movie", "EN - Dune: Part Two (2024)"))[0]).toMatchObject({
      id: 693134,
      release_date: "2024-02-27",
    });
    expect((await tmdbSearch("tv", "The Bear"))[0]).toMatchObject({
      id: 136315,
      title: "The Bear",
    });
  });

  it("cleans titles for search", () => {
    expect(cleanSearchQuery("EN - Dune: Part Two (2024)")).toBe("dune: part two");
    expect(cleanSearchQuery("The Bear (US) (2022)")).toBe("the bear");
  });

  it("device_info.tmdb_api_key replaces the built-in key; undefined restores it", async () => {
    const urls: string[] = [];
    setTransport((request) => {
      urls.push(request.url);
      return fetchTransport(request);
    });
    setTmdbApiKey("custom_key");
    await tmdbImages("movie", "1");
    setTmdbApiKey(undefined);
    await tmdbImages("movie", "1");
    expect(urls[0]).toContain("api_key=custom_key");
    expect(urls[1]).toContain(`api_key=${config.tmdb.apiKey}`);
  });
});

describe("IBO image cache (Q-image-store: read-only)", () => {
  it("reads a cached entry", async () => {
    expect((await cachedImages("movie", CACHED_TMDB_ID)).tmdbId).toBe(603);
  });

  it("falls back to TMDB when the cache has nothing", async () => {
    const images = await cachedImages("tv", "136315");
    expect(images.tmdbId).toBe(136315);
    expect(images.logos[0]?.file_path).toBe("/logo.png");
  });
});

describe("use-fixtures mode", () => {
  it("answers requests in memory, and unknown hosts are a NetworkError", async () => {
    // Intercepting fetch here proves the fixture transport never touches the network.
    const realFetch = global.fetch;
    global.fetch = jest.fn(() =>
      Promise.reject(new Error("network used")),
    ) as unknown as typeof fetch;
    try {
      setTransport(fixtureTransport);
      const body = (await getJson(
        "http://xtream.fixture.test:8080/player_api.php?username=fixture_user&password=fixture_pass",
      )) as {
        user_info: { status: string };
      };
      expect(body.user_info.status).toBe("Active");
      await expect(getJson("https://real-server.example.com/x")).rejects.toBeInstanceOf(
        NetworkError,
      );
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      global.fetch = realFetch;
    }
  });
});

describe("src/config.ts is generated from the kit", () => {
  it("matches 02-backend/config.json minus the TV-only values", () => {
    const kit = JSON.parse(
      readFileSync(join(__dirname, "../../../iboplayer-mobile-kit/02-backend/config.json"), "utf8"),
    ) as Record<string, Record<string, unknown>>;
    delete kit.tvBootOnly;
    delete kit.store;
    delete kit.stararcs?.tvAssetToken;
    delete kit.defaults?.tvFallbackMac;
    expect(JSON.parse(JSON.stringify(config))).toEqual(kit);
  });
});
