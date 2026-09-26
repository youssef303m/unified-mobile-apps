import { STALKER_HOST, STALKER_MAC, STALKER_PORTAL_URL } from "../../__fixtures__/hosts";
import { DOWN_HOST } from "../../__fixtures__/router";
import { setScenario } from "../../__fixtures__/scenario";
import {
  portalState,
  STALKER_CHANNEL_TOTAL,
  STALKER_LOADER_PATH,
} from "../../__fixtures__/stalker";
import { AuthError } from "../../errors";
import { fetchTransport, setTransport } from "../../http";
import { memoryStore } from "../../store";
import { mapProfile, StalkerClient } from "../client";
import { mapLiveChannel, pageResult, portalSort, StalkerContent } from "../content";
import { catchupAttempts, cleanCmd, linkUrl, repairMangledLink, StalkerLinks } from "../links";
import {
  absUrl,
  normalizePortalUrl,
  portalIdentity,
  portalOrigin,
  profileKey,
  profileOrder,
  quirksKey,
  randomVirtualMac,
} from "../portal";

const newClient = (store = memoryStore()) =>
  new StalkerClient({ portalUrl: STALKER_PORTAL_URL, macAddress: STALKER_MAC, store });

async function connected(store = memoryStore()) {
  const client = newClient(store);
  await client.connect();
  return client;
}

describe("portal URL and identity (stalker.md §2.1-2.3)", () => {
  it("normalises every documented URL form to the portal root", () => {
    expect(normalizePortalUrl(" http://p.tv:8080/c/ ")).toBe("http://p.tv:8080");
    expect(normalizePortalUrl("http://p.tv/stalker_portal/server/load.php?x=1")).toBe(
      "http://p.tv",
    );
    expect(normalizePortalUrl("http://p.tv/portal/")).toBe("http://p.tv");
    expect(portalOrigin("http://p.tv:8080/c/")).toBe("http://p.tv:8080");
    expect(portalOrigin("not a url")).toBeUndefined();
  });

  it("computes sn, device ids and signature from the MAC", () => {
    const id = portalIdentity("00:1a:79:12:34:56");
    expect(id.mac).toBe("00:1A:79:12:34:56");
    expect(id.sn).toBe("001A79123456");
    expect(id.deviceId).toBe("a7b48b071a49ed4fe8eef23ede037a0bbc6c29d4");
    expect(id.deviceId2).toMatch(/^[0-9a-f]{40}$/);
  });

  it("profiles: unknown → mag250, legacy stbstalker → iboplayer, iboplayer never a fallback", () => {
    expect(profileKey("nope")).toBe("mag250");
    expect(profileKey("stbstalker")).toBe("iboplayer");
    expect(profileOrder("iboplayer")).toEqual(["iboplayer", "mag250", "mag322", "mag520"]);
    expect(profileOrder("mag322")).toEqual(["mag322", "mag250", "mag520"]);
  });

  it("virtual MAC and quirks key", () => {
    expect(randomVirtualMac()).toMatch(/^00:1A:79:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/);
    expect(quirksKey("portal.example.tv:8080")).toBe("stalker_quirks_portal.example.tv_8080");
    expect(absUrl("/logo.png", "http://p.tv")).toBe("http://p.tv/logo.png");
  });

  it("mapProfile: status 0 and 1 are OK; expiry and registration", () => {
    expect(mapProfile({ id: "1", status: 0, phone: "2099-01-01 00:00:00" })).toMatchObject({
      status: 1,
      expired: false,
      registered: true,
    });
    expect(mapProfile({ id: 0, status: 2, end_date: "2000-01-01" })).toMatchObject({
      status: 0,
      expired: true,
      registered: false,
    });
  });
});

describe("connect (§3)", () => {
  it("discovers the loader, handshakes and reads the profile", async () => {
    const store = memoryStore();
    const client = newClient(store);
    const result = await client.connect();
    expect(result.profile).toMatchObject({ status: 1, registered: true, expired: false });
    expect(result.workingProfile).toBe("mag250");
    expect(client.loader).toBe(`http://${STALKER_HOST}${STALKER_LOADER_PATH}`);
    expect(client.token).toBe("tok-1");
    expect(JSON.parse(store.get(quirksKey(STALKER_HOST)) ?? "{}")).toEqual({
      loader: client.loader,
    });
  });

  it("sends the MAG headers and cookie (Q-stream-headers)", async () => {
    const client = await connected();
    const profileRequest = portalState.requests.find((r) => r.action === "get_profile");
    expect(profileRequest?.headers["x-user-agent"]).toBe("Model: MAG250; Link: Ethernet");
    expect(profileRequest?.headers.authorization).toBe("Bearer tok-1");
    expect(client.streamHeaders().Cookie).toContain("mac=00%3A1A%3A79%3A12%3A34%3A56");
  });

  it("an invalid MAC or portal URL fails without walking the profiles", async () => {
    const client = new StalkerClient({
      portalUrl: STALKER_PORTAL_URL,
      macAddress: "bad",
      store: memoryStore(),
    });
    await expect(client.connect()).rejects.toThrow("Invalid MAC address");
  });
});

describe("content (§4)", () => {
  it("categories skip the 'All' entry", async () => {
    const content = new StalkerContent(await connected());
    const genres = await content.categories("live");
    expect(genres.map((g) => g.category_name)).toEqual(["UK | Sports", "UK | News", "XXX Adults"]);
    expect((await content.categories("movie")).map((c) => c.category_id)).toEqual(["20"]);
  });

  it("pages live channels (3 pages) and maps them", async () => {
    const content = new StalkerContent(await connected());
    const pages = await Promise.all([1, 2, 3].map((p) => content.liveChannels("5", p)));
    expect(pages.map((p) => p.data.length)).toEqual([14, 14, 7]);
    expect(pages[0]?.total_items).toBe(STALKER_CHANNEL_TOTAL);
    expect(pages[0]?.data[0]).toMatchObject({
      stream_id: "1200",
      num: "100",
      stream_icon: `http://${STALKER_HOST}/stalker_portal/misc/logos/320/1200.png`,
      tv_archive: 1,
      tv_archive_duration: 7,
    });
  });

  it("Q-behaviour-fixes #6: tv_archive '0' means no archive", () => {
    const ch = mapLiveChannel({ id: 1, tv_archive: "0" }, "5", "http://p");
    expect(ch).toMatchObject({ tv_archive: 0, tv_archive_duration: 0 });
    expect(mapLiveChannel({ id: 1, archive: 1 }, "5", "http://p").tv_archive_duration).toBe(7);
  });

  it("movies, series, seasons and locally built episodes", async () => {
    const content = new StalkerContent(await connected());
    const movies = await content.movies("20", 1, "a_z");
    expect(movies.data[0]).toMatchObject({
      stream_id: "7700",
      duration: "166 min",
      cast: "Fixture Actor",
    });
    const series = await content.series("30", 1);
    const first = series.data[0];
    if (!first) throw new Error("no series");
    const seasons = await content.seasons(first);
    expect(seasons.map((s) => s.name)).toEqual(["Season 1", "Season 2"]);
    expect(seasons[1]?.episodes.map((e) => e.id)).toEqual(["3300:2:1", "3300:2:2", "3300:2:3"]);
    expect(portalSort("z_a")).toBe("added");
  });

  it("search and EPG", async () => {
    const content = new StalkerContent(await connected());
    expect((await content.search("movie", "dune")).length).toBeGreaterThan(0);
    const epg = await content.shortEpg("1200");
    expect(epg[0]).toMatchObject({ title: "Now on Portal", start: "2024-09-25 20:00:00" });
    const catchup = await content.catchupProgrammes("1284");
    expect(catchup[0]).toMatchObject({ title: "Premier League Live", start: "2024-09-25 20:00" });
  });

  it("pageResult tolerates arrays and missing totals", () => {
    expect(pageResult({ js: [1, 2] })).toEqual({ data: [1, 2], total_items: 2 });
    expect(pageResult({})).toEqual({ data: [], total_items: 0 });
  });
});

describe("token rotation and failures (§2.5, §3.5)", () => {
  it("an expired token triggers one re-handshake and the call is retried", async () => {
    setScenario({ stalkerTokenExpires: true });
    const client = await connected();
    const content = new StalkerContent(client);
    await content.categories("live");
    const genres = await content.categories("live");
    expect(genres.length).toBeGreaterThan(0);
    expect(client.token).not.toBe("tok-1");
    expect(portalState.handshakes).toBeGreaterThanOrEqual(2);
  });

  it("405 on GET: remembers POST in the quirks cache and retries", async () => {
    setScenario({ stalkerPostOnly: true });
    const store = memoryStore();
    const content = new StalkerContent(await connected(store));
    expect((await content.categories("live")).length).toBeGreaterThan(0);
    expect(JSON.parse(store.get(quirksKey(STALKER_HOST)) ?? "{}").preferred_method).toBe("POST");
    const methods = portalState.requests
      .filter((r) => r.action === "get_genres")
      .map((r) => r.method);
    expect(methods).toEqual(["GET", "POST"]);
  });

  it("keepalive sends the watchdog", async () => {
    const client = await connected();
    await client.keepalive();
    expect(portalState.requests.some((r) => r.action === "get_events")).toBe(true);
  });

  it("an unreachable portal walks every loader path for each profile, then fails (as on TV)", async () => {
    const seen: string[] = [];
    const client = new StalkerClient({
      portalUrl: `http://${DOWN_HOST}/c/`,
      macAddress: STALKER_MAC,
      store: memoryStore(),
    });
    setTransport((request) => {
      seen.push(request.url);
      return fetchTransport(request);
    });
    await expect(client.connect()).rejects.toBeInstanceOf(AuthError);
    expect(seen).toHaveLength(15 * 3);
  });
});

describe("create_link (§4.7)", () => {
  it("live: resolves the portal's link with a play_token", async () => {
    const links = new StalkerLinks(await connected());
    expect(await links.live("ffmpeg http://localhost/ch/1200_", "1200")).toBe(
      "http://cdn.stalker.fixture.test/live/play/1200?stream=1200&play_token=Xyz123&sn2=",
    );
  });

  it("movie and episode links", async () => {
    const links = new StalkerLinks(await connected());
    expect(await links.movie("/media/file_7700.mpg", "", "")).toBe(
      "http://cdn.stalker.fixture.test/media/7700.mkv?play_token=AbC987",
    );
    expect(await links.episode("eyJ0", "3", "")).toBe(
      "http://cdn.stalker.fixture.test/series/ep3.mkv?play_token=Ser456",
    );
  });

  it("cleanCmd, linkUrl and the mangled-link repair", () => {
    expect(cleanCmd("ffmpeg http://h/x?mac=%MAC% extra", "00:1A")).toBe("http://h/x?mac=00:1A");
    expect(linkUrl({ cmd: "/media/1.mpg" }, ["cmd", "url"], "m", "http://p")).toBe(
      "http://p/media/1.mpg",
    );
    expect(
      repairMangledLink("http://p/cdn.h:8080/live/1?play_token=T", "http://cdn.h:8080/live/1"),
    ).toBe("http://cdn.h:8080/live/1?play_token=T");
    expect(repairMangledLink("http://cdn/live/1?play_token=T", "http://cdn.h/live/1")).toBe(
      "http://cdn/live/1?play_token=T",
    );
  });

  it("catch-up attempts: ordered, empty series skipped, de-duplicated", () => {
    const attempts = catchupAttempts("ffmpeg http://h/ch/1284_", 1727290800, {
      id: "1727290800_1284",
      real_id: "1284_1727290800",
    });
    expect(attempts[0]).toEqual({ cmd: "auto /media/1727290800_1284.mpg", series: "" });
    expect(attempts[1]).toEqual({
      cmd: "ffmpeg http://h/ch/1284_1727290800",
      series: "1727290800",
    });
    const keys = attempts.map((a) => `${a.cmd}||${a.series}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(attempts.slice(1).every((a) => a.series !== "")).toBe(true);
  });
});
