import { M3U_URL, STALKER_MAC, STALKER_PORTAL_URL } from "@/api/__fixtures__/hosts";
import { AuthError, NetworkError } from "@/api/errors";
import { convertPlaylistPath } from "@/api/ibo/playlists";
import type { Playlist } from "@/api/ibo/types";
import { loadM3u } from "@/api/m3u/client";
import { StalkerClient, type StalkerProfile } from "@/api/stalker/client";
import { memoryStore } from "@/api/store";
import { parseAccount } from "@/api/xtream/client";
import { globalKeys, unprefixedKeys } from "@/storage/keys";

import {
  accountInfoIsFresh,
  afterDelete,
  canDeletePlaylist,
  failureScreen,
  IN_APP_PLAYLIST_TYPES,
  isValidPortalMac,
  loadDelayMs,
  loginErrorKey,
  mustClearInfoCache,
  newLocalPlaylistId,
  nextPlaylistAfterFailure,
  normalizeXtreamForm,
  playlistExpiry,
  profileToSave,
  queueFailedSave,
  readLocalData,
  renamePlaylistKeys,
  replayQueue,
  reportedAuth,
  selectPlaylist,
  splitPlaylists,
  stalkerLoginOutcome,
  startupPlaylist,
  testPortalBeforeSave,
  virtualStalkerMac,
} from "../playlists";

const xc = (id: string): Playlist => ({ id, playlist_type: "xc", url: `http://${id}.test` });
const portal = (id: string): Playlist => ({
  id,
  playlist_type: "stalker",
  url: "http://p.test/c/",
});
const profile = (p: Partial<StalkerProfile>): StalkerProfile => ({
  status: 1,
  expiry: "",
  msg: "",
  expired: false,
  registered: true,
  ...p,
});

describe("B. Choosing the playlist at startup", () => {
  it("R-020: automatic uses the saved playlist, or the first; playlist_first opens the chooser", () => {
    const list = [xc("a"), xc("b")];
    expect(startupPlaylist("automatic", "b", list)).toEqual({ kind: "load", playlist: list[1] });
    expect(startupPlaylist("automatic", "gone", list)).toEqual({ kind: "load", playlist: list[0] });
    expect(startupPlaylist("playlist_first", "b", list)).toEqual({ kind: "choose" });
  });

  it("R-021: auto switch tries the next untried playlist; none left → all failed", () => {
    const list = [xc("a"), xc("b"), xc("c")];
    expect(nextPlaylistAfterFailure(list, new Set(["a"]), true)?.id).toBe("b");
    expect(nextPlaylistAfterFailure(list, new Set(["a", "b", "c"]), true)).toBeUndefined();
    expect(nextPlaylistAfterFailure(list, new Set(["a"]), false)).toBeUndefined();
  });

  it("R-022: Xtream/M3U failures land on Playlists, Stalker on Portals", () => {
    expect(failureScreen("xc")).toBe("playlists");
    expect(failureScreen("general")).toBe("playlists");
    expect(failureScreen("stalker")).toBe("portals");
  });

  it("R-023: no user_info / auth 0 / Expired / Banned / Disabled fail; Expired has its own message", () => {
    expect(() => parseAccount({ user_info: { auth: 0 } })).toThrow(AuthError);
    let expired: unknown;
    try {
      parseAccount({ user_info: { auth: 1, status: "Expired" } });
    } catch (e) {
      expired = e;
    }
    expect(loginErrorKey(expired as AuthError)).toBe("playlist_expired");
    expect(loginErrorKey(new AuthError("x", "provider_banned"))).toBe("playlist_generic");
    expect(loginErrorKey(new NetworkError("x"))).toBe("playlist_generic");
  });

  it("R-025: an M3U reply must start with #EXTM3U", async () => {
    await expect(loadM3u(M3U_URL.replace("playlist.m3u", "broken.m3u"))).rejects.toThrow(
      "Not an M3U playlist",
    );
    await expect(loadM3u(M3U_URL)).resolves.toBeDefined();
  });

  it("R-026: portal profile not OK, expired or unregistered fails with the right message", () => {
    expect(stalkerLoginOutcome(profile({}))).toBe("ok");
    expect(stalkerLoginOutcome(profile({ expired: true }))).toBe("expired");
    expect(stalkerLoginOutcome(profile({ registered: false }))).toBe("expired");
    expect(stalkerLoginOutcome(profile({ status: 0 }))).toBe("unavailable");
    expect(loginErrorKey(new AuthError("x", "portal_expired"))).toBe("portal_expired");
  });

  it("R-027: exp_date null = unlimited, else the date; the server offset is computed", () => {
    expect(playlistExpiry(null)).toEqual({ kind: "unlimited" });
    expect(playlistExpiry("2027-01-01")).toEqual({ kind: "date", date: "2027-01-01" });
    const now = new Date(2024, 8, 26, 12, 0, 0);
    const account = parseAccount({
      user_info: { auth: 1, status: "Active", exp_date: null },
      server_info: { time_now: "2024-09-26 10:00:00", timestamp_now: now.getTime() / 1000 },
    });
    expect(account.serverOffsetMinutes).toBe(120);
  });
});

describe("C. Playlists and portals management", () => {
  it("R-030: a failed save is queued, replayed at launch, and a new id renames every key", async () => {
    const store = memoryStore();
    const local = { ...xc(newLocalPlaylistId(new Date(1_727_000_000_000))), playlist_name: "Mine" };
    expect(local.id).toBe("non_saved_1727000000");
    store.set(`gz3rYzUIC7_${local.id}live_favourite`, '["1"]');
    store.set(`gz3rYzUIC7_${local.id}_saved_vod_times`, "[]");
    store.set(globalKeys.playlistId, local.id);
    queueFailedSave(store, local);
    expect(readLocalData(store).playlist_urls).toHaveLength(1);

    const accepted = await replayQueue(
      store,
      async (entry) => ({ ...entry, id: "65f1" }),
      async () => true,
    );
    expect(accepted.map((p) => p.id)).toEqual(["65f1"]);
    expect(store.get("gz3rYzUIC7_65f1live_favourite")).toBe('["1"]');
    expect(store.get("gz3rYzUIC7_65f1_saved_vod_times")).toBe("[]");
    expect(store.get(`gz3rYzUIC7_${local.id}live_favourite`)).toBeUndefined();
    expect(store.get(globalKeys.playlistId)).toBe("65f1");
    expect(store.get(globalKeys.localData)).toBeUndefined();
  });

  it("R-030: entries the server still refuses stay queued", async () => {
    const store = memoryStore();
    queueFailedSave(store, xc("non_saved_1"));
    await replayQueue(
      store,
      async () => undefined,
      async () => false,
    );
    expect(readLocalData(store).playlist_urls.map((p) => p.id)).toEqual(["non_saved_1"]);
  });

  it("R-030: the rename only touches keys where the id ends right after the prefix", () => {
    const store = memoryStore({
      gz3rYzUIC7_12live_favourite: "a",
      gz3rYzUIC7_123live_favourite: "b",
    });
    renamePlaylistKeys(store, "12", "99");
    expect(store.get("gz3rYzUIC7_99live_favourite")).toBe("a");
    expect(store.get("gz3rYzUIC7_123live_favourite")).toBe("b");
  });

  it("R-031: name, URL, user and password required; a pasted get.php URL is split", () => {
    expect(
      normalizeXtreamForm({ name: "", url: "http://h", username: "u", password: "p" }).error,
    ).toBe("missing_fields");
    expect(
      normalizeXtreamForm({
        name: "Mine",
        url: "http://h:8080/get.php?username=u1&password=p1&type=m3u",
        username: "",
        password: "",
      }).value,
    ).toEqual({ name: "Mine", url: "http://h:8080", username: "u1", password: "p1" });
  });

  it("R-032: <host>/playlist/<user>/<pass>/<type>[/<output>] becomes an Xtream entry", () => {
    expect(
      convertPlaylistPath({
        id: "1",
        playlist_type: "general",
        url: "http://h/playlist/u/p/m3u_plus",
      }),
    ).toMatchObject({
      playlist_type: "xc",
      url: "http://h",
      username: "u",
      password: "p",
    });
  });

  it("R-033: deleting the only playlist is refused", () => {
    expect(canDeletePlaylist([xc("a")])).toBe(false);
    expect(canDeletePlaylist([xc("a"), xc("b")])).toBe(true);
  });

  it("R-034: deleting the active entry clears the selection; the active portal → Playlists", () => {
    expect(afterDelete("a", xc("a"))).toEqual({ clearSelection: true });
    expect(afterDelete("p", portal("p"))).toEqual({ clearSelection: true, goTo: "playlists" });
    expect(afterDelete("a", xc("b"))).toEqual({ clearSelection: false });
  });

  it("R-035: playlists and portals are listed separately", () => {
    const { playlists, portals } = splitPlaylists([
      xc("a"),
      portal("p"),
      { id: "m", playlist_type: "general", url: "u" },
    ]);
    expect(playlists.map((p) => p.id)).toEqual(["a", "m"]);
    expect(portals.map((p) => p.id)).toEqual(["p"]);
  });

  it("R-036: only Xtream and Stalker can be added in the app (Q-m3u-in-app)", () => {
    expect(IN_APP_PLAYLIST_TYPES).toEqual(["xc", "stalker"]);
  });

  it("R-037: account info is refreshed after 5 minutes; auth 0 is reported Unknown", () => {
    const now = new Date("2026-09-26T10:10:00Z");
    expect(accountInfoIsFresh("2026-09-26T10:06:00Z", now)).toBe(true);
    expect(accountInfoIsFresh("2026-09-26T10:04:00Z", now)).toBe(false);
    expect(accountInfoIsFresh(undefined, now)).toBe(false);
    expect(reportedAuth(1)).toBe("Active");
    expect(reportedAuth(2)).toBe("Inactive");
    expect(reportedAuth(0)).toBe("Unknown");
  });

  it("R-038: prefix + last 3 bytes of the hardware MAC, else a persisted random one", () => {
    const store = memoryStore();
    expect(virtualStalkerMac(store, "00:1C:1D", "a1-b2-c3-d4-e5-f6")).toBe("00:1C:1D:D4:E5:F6");
    const first = virtualStalkerMac(store);
    expect(first).toMatch(/^00:1A:79:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/);
    expect(virtualStalkerMac(store)).toBe(first);
    expect(store.get(unprefixedKeys.stalkerMac)).toBeDefined();
    expect(isValidPortalMac("00:1A:79:12:34:56")).toBe(true);
    expect(isValidPortalMac("00-1A-79-12-34-56")).toBe(false);
  });

  it("R-039: a portal is saved only after it connects (primary, then fallback)", async () => {
    const store = memoryStore();
    const connect = async (url: string) =>
      (await new StalkerClient({ portalUrl: url, macAddress: STALKER_MAC, store }).connect(false))
        .profile;
    const ok = await testPortalBeforeSave(
      connect,
      "http://down.fixture.test/c/",
      STALKER_PORTAL_URL,
    );
    expect(ok).toMatchObject({ ok: true, url: STALKER_PORTAL_URL });
    expect((await testPortalBeforeSave(connect, "http://down.fixture.test/c/")).ok).toBe(false);
  });
});

describe("D. Switching playlist / portal", () => {
  it("R-040: a switch saves playlist_id and the entry", () => {
    const store = memoryStore();
    selectPlaylist(store, xc("b"));
    expect(store.get(globalKeys.playlistId)).toBe("b");
    expect(JSON.parse(store.get(globalKeys.playlist) ?? "{}").id).toBe("b");
  });

  it("R-041: the movie-info cache is cleared when the host changes", () => {
    expect(mustClearInfoCache("http://a", "http://b")).toBe(true);
    expect(mustClearInfoCache("http://a", "http://a")).toBe(false);
    expect(mustClearInfoCache(undefined, "http://a")).toBe(false);
  });

  it("R-042: with the proxy on, loading waits 1 s", () => {
    expect(loadDelayMs(true)).toBe(1000);
    expect(loadDelayMs(false)).toBe(0);
  });

  it("R-043: the working STB profile is saved, unless IBOPlayer was chosen", () => {
    expect(profileToSave("mag250", "mag322")).toBe("mag322");
    expect(profileToSave("mag250", "mag250")).toBeUndefined();
    expect(profileToSave("iboplayer", "mag250")).toBeUndefined();
  });
});
