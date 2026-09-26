import { readFileSync } from "fs";
import { join } from "path";

import { config } from "@/config";

import { CACHED_TMDB_ID, analyticsReceived } from "../__fixtures__/services";
import { ANALYTICS_SESSIONS_KEY, Analytics, sessionId } from "../analytics";
import { fixtureTransport } from "../fixtureTransport";
import { NetworkError } from "../errors";
import { fetchTransport, getJson, setTransport } from "../http";
import { cachedImages } from "../imageCache";
import { memoryStore } from "../store";
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

describe("analytics (Q-analytics)", () => {
  const device = {
    platform: "android",
    modelName: "Pixel",
    version: "15",
    sdkVersion: "35",
    screenWidth: 1080,
    screenHeight: 2400,
    uhd: false,
  };

  it("session id is s_ + SHA256(start_mac)", () => {
    expect(sessionId(1758873600, "3A:E3:1A:46:33:A5")).toMatch(/^s_[0-9a-f]{64}$/);
  });

  it("uploads once 5 events are buffered and removes exactly the sent ones", async () => {
    const store = memoryStore();
    const analytics = new Analytics(store, {
      macAddress: "3A:E3:1A:46:33:A5",
      appVersion: "1.0.0",
      device,
    });
    analytics.startSession(1758873600);
    analytics.setLocation({ ip: "203.0.113.42", country: "Egypt" });
    analytics.setLocation({ ip: "198.51.100.1" });
    for (const t of ["live_opened", "movies_opened", "series_opened", "live_opened"] as const)
      await analytics.track(t, 1758873625);
    expect(analyticsReceived).toHaveLength(0);
    await analytics.track("movies_opened", 1758873700);
    expect(analyticsReceived).toHaveLength(1);
    const payload = analyticsReceived[0] as {
      app_name: string;
      device: { platform: string };
      sessions: { ip_address: string; events: unknown[] }[];
    };
    expect(payload.app_name).toBe("iboplayer");
    expect(payload.device.platform).toBe("android");
    expect(payload.sessions[0]?.ip_address).toBe("203.0.113.42");
    expect(payload.sessions[0]?.events).toHaveLength(5);
    expect(analytics.bufferedCount()).toBe(0);
  });

  it("keeps at most 10 sessions and flushes old events after device_info", () => {
    const store = memoryStore();
    const analytics = new Analytics(store, { macAddress: "m", appVersion: "1", device });
    for (let i = 0; i < 12; i++) analytics.startSession(1000 + i);
    expect(JSON.parse(store.get(ANALYTICS_SESSIONS_KEY) ?? "[]")).toHaveLength(10);
    store.set(
      ANALYTICS_SESSIONS_KEY,
      JSON.stringify([
        {
          session_id: "s",
          start_time: 0,
          ip_address: "",
          userCountry: "",
          userCity: "",
          events: [{ tracker: "live_opened", timestamp: 0 }],
        },
      ]),
    );
    expect(analytics.shouldFlushAfterDeviceInfo(86_400)).toBe(true);
    expect(analytics.shouldFlushAfterDeviceInfo(100)).toBe(false);
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
