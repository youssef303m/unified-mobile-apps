import { XTREAM_BIG_URL, XTREAM_PASS, XTREAM_URL, XTREAM_USER } from "../../__fixtures__/hosts";
import { XTREAM_BIG_COUNT } from "../../__fixtures__/xtream";
import { AuthError, ParseError } from "../../errors";
import { normalizeSeasons, parseAccount, XtreamClient } from "../client";
import type { XtreamPlaylist } from "../types";
import {
  accountInfoKey,
  episodeUrl,
  liveExtension,
  liveUrl,
  movieUrl,
  playerApiUrl,
  timeshiftUrl,
} from "../urls";

const playlist: XtreamPlaylist = {
  url: `${XTREAM_URL}/`,
  username: XTREAM_USER,
  password: XTREAM_PASS,
};
const client = new XtreamClient(playlist);

describe("Xtream login (xtream.md §2)", () => {
  it("returns the account with expiry and status", async () => {
    const account = await client.account();
    expect(account.status).toBe("Active");
    expect(account.expireDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isInteger(account.serverOffsetMinutes)).toBe(true);
  });

  it("rejected credentials (auth 0) → AuthError provider_auth", async () => {
    const bad = new XtreamClient({ ...playlist, password: "wrong" });
    await expect(bad.account()).rejects.toMatchObject({ reason: "provider_auth" });
  });

  it("expired / banned / disabled accounts", async () => {
    await expect(
      new XtreamClient({ ...playlist, username: "expired_user" }).account(),
    ).rejects.toMatchObject({
      reason: "provider_expired",
    });
    expect(() => parseAccount({ user_info: { auth: 1, status: "Banned" } })).toThrow(AuthError);
    expect(() => parseAccount({ user_info: { auth: "0" } })).toThrow(AuthError);
  });

  it("exp_date null means unlimited; a reply without user_info is a ParseError", () => {
    expect(
      parseAccount({ user_info: { auth: 1, status: "Active", exp_date: null } }).expireDate,
    ).toBeNull();
    expect(() => parseAccount({ server_info: {} })).toThrow(ParseError);
    expect(() => parseAccount("nope")).toThrow(ParseError);
  });
});

describe("Xtream catalogue (§3)", () => {
  it("lists categories and streams for live, VOD and series", async () => {
    const [liveCats, live, vodCats, vod, seriesCats, series] = await Promise.all([
      client.liveCategories(),
      client.liveStreams(),
      client.vodCategories(),
      client.vodStreams(),
      client.seriesCategories(),
      client.series(),
    ]);
    expect(liveCats).toHaveLength(5);
    expect(live).toHaveLength(50);
    expect(vodCats[0]).toEqual({ category_id: "40", category_name: "EN | ACTION", parent_id: "0" });
    expect(vod[0]).toMatchObject({ stream_id: "55000", container_extension: "m3u8" });
    expect(seriesCats).toHaveLength(5);
    expect(series[0]).toMatchObject({
      series_id: "3300",
      backdrop_path: ["http://img.fixture.test/series1_bd.jpg"],
    });
  });

  it("maps a null category to 'undefined' (Uncategorized)", async () => {
    const live = await client.liveStreams();
    expect(live[live.length - 1]?.category_id).toBe("undefined");
  });

  it("downloads the 20,000-channel set", async () => {
    const big = new XtreamClient({ ...playlist, url: XTREAM_BIG_URL });
    expect(await big.liveStreams()).toHaveLength(XTREAM_BIG_COUNT);
  });
});

describe("Xtream details (§4-5)", () => {
  it("get_vod_info reads info only", async () => {
    const info = await client.vodInfo("55000");
    expect(info).toMatchObject({
      tmdbId: "693134",
      releaseDate: "2024-02-27",
      backdrop: "http://img.fixture.test/movie_bd.jpg",
      youtubeTrailer: "Way9Dexny3w",
    });
  });

  it("get_series_info builds 2 seasons from the episodes keys", async () => {
    const info = await client.seriesInfo("3300");
    expect(info?.seasons.map((s) => s.name)).toEqual(["Season 1", "Season 2"]);
    expect(info?.seasons[1]?.episodes[2]).toMatchObject({
      id: "880203",
      container_extension: "mp4",
      duration_secs: 1800,
    });
  });

  it("normalizeSeasons: array form, non-numeric keys, empty seasons dropped", () => {
    // Numbers are assigned before empty seasons are dropped (as on TV): "extra" gets 3.
    const seasons = normalizeSeasons({ "2": [{ id: "a" }], extra: [{ id: "b" }], "1": [] });
    expect(seasons.map((s) => [s.season_number, s.name])).toEqual([
      [2, "Season 2"],
      [3, "Season 3"],
    ]);
    expect(
      normalizeSeasons([[{ id: "x" }], "bad", [{ id: "y" }]]).map((s) => s.season_number),
    ).toEqual([1, 3]);
  });
});

describe("Xtream URLs (§6-7)", () => {
  const p: XtreamPlaylist = {
    url: "http://line.example.tv:8080",
    username: "demo123",
    password: "pass456",
  };

  it("builds live, movie and episode URLs", () => {
    expect(liveUrl(p, "10231")).toBe("http://line.example.tv:8080/live/demo123/pass456/10231.ts");
    expect(movieUrl(p, "55012", "mkv")).toBe(
      "http://line.example.tv:8080/movie/demo123/pass456/55012.mkv",
    );
    expect(episodeUrl(p, "880011", "mp4")).toBe(
      "http://line.example.tv:8080/series/demo123/pass456/880011.mp4",
    );
  });

  it("Q-behaviour-fixes #11: encodes credentials with special characters", () => {
    const special = { ...p, username: "a&b", password: "p#s w" };
    expect(liveUrl(special, "1")).toBe("http://line.example.tv:8080/live/a%26b/p%23s%20w/1.ts");
    expect(playerApiUrl(special)).toBe(
      "http://line.example.tv:8080/player_api.php?username=a%26b&password=p%23s%20w",
    );
  });

  it("live extension from the setting, then origin_url output=", () => {
    expect(liveExtension(p, "m3u8")).toBe("m3u8");
    expect(
      liveExtension({
        ...p,
        origin_url: "http://h/get.php?username=u&password=p&type=m3u_plus&output=hls",
      }),
    ).toBe("m3u8");
    expect(liveExtension({ ...p, origin_url: "http://h/get.php?output=mpegts" })).toBe("ts");
    // As on TV: text after output= must match exactly.
    expect(liveExtension({ ...p, origin_url: "http://h/get.php?output=m3u8&x=1" })).toBe("ts");
  });

  it("timeshift: server wall clock start and whole-minute duration (§3.5 example)", () => {
    // Device UTC+3, server UTC+1 → offset +120; programme shown 22:00-23:00.
    const result = timeshiftUrl(
      p,
      "10231",
      { start: "2024-09-25 22:00", stop: "2024-09-25 23:00" },
      120,
    );
    expect(result?.url).toBe(
      "http://line.example.tv:8080/streaming/timeshift.php?username=demo123&password=pass456&stream=10231&start=2024-09-25:20-00&duration=60",
    );
  });

  it("account-info key: Java 32-bit hash of host_user_pass in base 36", () => {
    expect(accountInfoKey(p)).toBe("tblojj");
  });
});

describe("Xtream EPG (epg-and-catchup.md §2-3)", () => {
  it("short EPG decodes base64 titles", async () => {
    const programmes = await client.shortEpg("10000", 0);
    expect(programmes).toHaveLength(4);
    expect(programmes[0]?.title).toBe("Programme 1 – Café");
    expect(programmes[0]?.start).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("catch-up keeps only archived programmes, with their description (fix #5)", async () => {
    const programmes = await client.catchupProgrammes("10000", 0);
    expect(programmes.length).toBeGreaterThan(0);
    expect(programmes.length).toBeLessThan(30);
    expect(programmes[0]?.description).toBe("Description 1");
  });
});
