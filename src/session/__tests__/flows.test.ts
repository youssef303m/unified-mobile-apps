// After device info (account routing), loading a playlist (auto switch, errors), and adding or
// deleting playlists and portals, on the fixtures.
import { DOWN_HOST } from "@/api/__fixtures__/router";
import {
  FIXTURE_PANEL_DOMAINS,
  STALKER_MAC,
  STALKER_PORTAL_URL,
  XTREAM_PASS,
  XTREAM_URL,
  XTREAM_USER,
} from "@/api/__fixtures__/hosts";
import { deviceInfoReply, FIXTURE_TOKEN, fixturePlaylists } from "@/api/__fixtures__/ibo";
import { setScenario } from "@/api/__fixtures__/scenario";
import { parseDeviceInfo } from "@/api/ibo/client";
import { PanelClient } from "@/api/ibo/panel";
import { parsePlaylist } from "@/api/ibo/playlists";
import { buildPanelUrls } from "@/api/ibo/servers";
import type { Playlist } from "@/api/ibo/types";
import { memoryStore, type KeyValueStore } from "@/api/store";
import { queueFailedSave, readLocalData } from "@/content/rules/playlists";
import { categories } from "@/db/queries/catalogue";
import { openTestDb } from "@/db/testing/testDb";
import { globalKeys } from "@/storage/keys";

import { afterDeviceInfo } from "../account";
import { discoverPanelUrls, DEV_BACKEND_DOMAIN, parseNetworkMode } from "../networkMode";
import { loadPlaylist, type LoadStep } from "../playlistLoad";
import { addPortal, addXtreamPlaylist, removePlaylist } from "../playlists";

const MAC = "3A:E3:1A:46:33:A5";
const [xtream, m3u, portal] = fixturePlaylists.map(parsePlaylist) as [Playlist, Playlist, Playlist];

function registeredStore(extra: Record<string, string> = {}): KeyValueStore {
  return memoryStore({
    [globalKeys.v4Token]: FIXTURE_TOKEN,
    [globalKeys.v4Uid]: "K7MQ3X",
    ...extra,
  });
}

function deps(store: KeyValueStore = registeredStore()) {
  const panel = new PanelClient({ panelUrls: buildPanelUrls(FIXTURE_PANEL_DOMAINS), store });
  return { store, panel, macAddress: MAC };
}

const info = () => parseDeviceInfo(deviceInfoReply());

describe("account routing (user-flows.md §1 steps 6-10)", () => {
  it("R-006: an expired licence goes to the Expired screen with no playlists", async () => {
    setScenario({ account: "expired" });
    expect(await afterDeviceInfo(deps(), info(), false)).toEqual({
      state: "expired",
      route: "expired",
      playlists: [],
    });
  });

  it("R-005: offline, an expired cached licence still blocks", async () => {
    setScenario({ account: "expired" });
    expect((await afterDeviceInfo(deps(), info(), true)).route).toBe("expired");
  });

  it("R-007: trial → Welcome; registered → load. R-009: the demo entry is dropped", async () => {
    setScenario({ account: "trial" });
    const trial = await afterDeviceInfo(deps(), info(), false);
    expect(trial.route).toBe("welcome");
    expect(trial.playlists.map((p) => p.id)).toEqual(fixturePlaylists.map((p) => p.id));
    setScenario({ account: "active" });
    expect((await afterDeviceInfo(deps(), info(), false)).route).toBe("load");
  });

  it("R-020: Playlist Selection opens the chooser (before the Welcome screen)", async () => {
    setScenario({ account: "trial" });
    const store = registeredStore({ [globalKeys.appInitializationChoice]: "playlist_first" });
    expect((await afterDeviceInfo(deps(store), info(), false)).route).toBe("choose_playlist");
  });

  it("R-010: the server PIN is saved at login", async () => {
    const store = registeredStore({ [globalKeys.parentPin]: "1234" });
    await afterDeviceInfo(deps(store), info(), false);
    expect(store.get(globalKeys.parentPin)).toBe("0000");
  });

  it("R-030: queued offline saves are replayed and join the list with their server id", async () => {
    const store = registeredStore();
    queueFailedSave(store, { ...xtream, id: "non_saved_1700000000", is_created: true });
    const result = await afterDeviceInfo(deps(store), info(), false);
    expect(result.playlists.map((p) => p.id)).toContain("65f1c0ffee00000000000001");
    expect(readLocalData(store).playlist_urls).toEqual([]);
  });

  it("R-030: offline, queued entries stay in the list and in the queue", async () => {
    const store = registeredStore();
    const queued = { ...xtream, id: "non_saved_1700000000", is_created: true };
    queueFailedSave(store, queued);
    const result = await afterDeviceInfo(deps(store), info(), true);
    expect(result.playlists.map((p) => p.id)).toContain(queued.id);
    expect(readLocalData(store).playlist_urls).toHaveLength(1);
  });
});

describe("loading a playlist", () => {
  const down: Playlist = {
    ...xtream,
    id: "down1",
    url: `http://${DOWN_HOST}`,
    origin_url: undefined,
  };

  it("R-040: an Xtream playlist logs in, is saved as the selection, and reports its account", async () => {
    const store = memoryStore();
    const steps: LoadStep[] = [];
    const outcome = await loadPlaylist(
      { store, db: await openTestDb(), onStep: (s) => steps.push(s) },
      xtream,
      [xtream],
    );
    expect(outcome.kind).toBe("ready");
    if (outcome.kind !== "ready") return;
    expect(outcome.provider).toMatchObject({ type: "xtream", account: { status: "Active" } });
    expect(store.get(globalKeys.playlistId)).toBe(xtream.id);
    // Load on demand: nothing is synced at login, sections load when opened.
    expect(outcome.session.isLoaded("live")).toBe(false);
    expect(steps).toEqual(["playlist", "provider", "almost_ready"]);
  });

  it("an M3U playlist is read at login (R-025), so its sections are ready", async () => {
    const db = await openTestDb();
    const outcome = await loadPlaylist({ store: memoryStore(), db }, m3u, [m3u]);
    expect(outcome.kind === "ready" && outcome.session.isLoaded("live")).toBe(true);
    expect((await categories(db, m3u.id, "live")).length).toBeGreaterThan(0);
  });

  it("a Stalker portal connects and reports its profile", async () => {
    const outcome = await loadPlaylist({ store: memoryStore(), db: await openTestDb() }, portal, [
      portal,
    ]);
    expect(outcome.kind === "ready" && outcome.provider).toMatchObject({
      type: "stalker",
      mac: STALKER_MAC,
    });
  });

  it("R-022 / R-023: a failed Xtream login lands on Playlists with the provider message", async () => {
    const expired: Playlist = {
      ...xtream,
      id: "exp1",
      username: "expired_user",
      origin_url: undefined,
    };
    const outcome = await loadPlaylist({ store: memoryStore(), db: await openTestDb() }, expired, [
      expired,
    ]);
    expect(outcome).toEqual({
      kind: "failed",
      failure: { screen: "playlists", error: "playlist_expired" },
    });
  });

  it("R-009: an entry without a URL cannot load", async () => {
    const demo: Playlist = { id: "demo", playlist_type: "general", url: "" };
    const outcome = await loadPlaylist({ store: memoryStore(), db: await openTestDb() }, demo, [
      demo,
    ]);
    expect(outcome.kind === "failed" && outcome.failure.error).toBe("no_url");
  });

  it("R-021: with Auto Switch the next playlist is tried; all failing gives all_failed", async () => {
    const store = memoryStore({ [globalKeys.autoSwitchPlaylist]: "on" });
    const db = await openTestDb();
    const next = await loadPlaylist({ store, db }, down, [down, m3u]);
    expect(next.kind === "ready" && next.playlist.id).toBe(m3u.id);
    expect(store.get(globalKeys.playlistId)).toBe(m3u.id);

    const down2: Playlist = { ...down, id: "down2" };
    const all = await loadPlaylist({ store, db }, down, [down, down2]);
    expect(all.kind === "failed" && all.failure.error).toBe("all_failed");
  });

  it("R-021: without Auto Switch the failure stops at the first playlist", async () => {
    const outcome = await loadPlaylist({ store: memoryStore(), db: await openTestDb() }, down, [
      down,
      m3u,
    ]);
    expect(outcome.kind === "failed" && outcome.failure.error).toBe("playlist_generic");
  });

  it("R-011: an aborted load reports aborted, on the Portals screen for a portal", async () => {
    const controller = new AbortController();
    controller.abort();
    const outcome = await loadPlaylist(
      { store: memoryStore(), db: await openTestDb(), signal: controller.signal },
      portal,
      [portal],
    );
    expect(outcome).toEqual({ kind: "failed", failure: { screen: "portals", error: "aborted" } });
  });
});

describe("adding and deleting", () => {
  const form = { name: "Mine", url: XTREAM_URL, username: XTREAM_USER, password: XTREAM_PASS };

  it("R-031: a missing field is reported in form order", async () => {
    expect(await addXtreamPlaylist(deps(), { ...form, name: " ", password: "" })).toEqual({
      kind: "invalid",
      field: "name",
    });
  });

  it("R-031: a playlist the provider rejects is not saved", async () => {
    expect((await addXtreamPlaylist(deps(), { ...form, password: "nope" })).kind).toBe(
      "not_working",
    );
  });

  it("R-031: a working playlist is saved on the backend and gets its server id", async () => {
    const result = await addXtreamPlaylist(deps(), form);
    expect(result).toMatchObject({
      kind: "saved",
      queued: false,
      playlist: { id: "65f1c0ffee00000000000001", playlist_name: "Mine", playlist_type: "xc" },
    });
  });

  it("R-030: when the backend is unreachable the playlist is kept and queued", async () => {
    const d = deps();
    setScenario({ panelsDown: [...FIXTURE_PANEL_DOMAINS] });
    const result = await addXtreamPlaylist(d, form);
    expect(result).toMatchObject({ kind: "saved", queued: true });
    expect(readLocalData(d.store).playlist_urls).toHaveLength(1);
  });

  it("R-038 / R-039: a portal needs a valid MAC and must connect before it is saved", async () => {
    const portalForm = { name: "P", url: STALKER_PORTAL_URL, fallbackUrl: "", mac: STALKER_MAC };
    expect(await addPortal(deps(), { ...portalForm, mac: "12:34" })).toEqual({
      kind: "invalid",
      field: "mac_format",
    });
    expect((await addPortal(deps(), { ...portalForm, url: `http://${DOWN_HOST}/c/` })).kind).toBe(
      "not_working",
    );
    expect(await addPortal(deps(), portalForm)).toMatchObject({
      kind: "saved",
      playlist: { playlist_type: "stalker", stalker_mac_address: STALKER_MAC },
    });
  });

  it("R-033 / R-034: the last playlist cannot go; deleting the selected one clears it", async () => {
    const d = deps(registeredStore({ [globalKeys.playlistId]: xtream.id }));
    expect(await removePlaylist(d, [xtream], [xtream], xtream)).toEqual({ kind: "last_one" });
    const result = await removePlaylist(d, [xtream, m3u, portal], [xtream, m3u], xtream);
    expect(result).toMatchObject({ kind: "deleted", clearedSelection: true, toPlaylists: false });
    expect(result.kind === "deleted" && result.playlists.map((p) => p.id)).toEqual([
      m3u.id,
      portal.id,
    ]);
    expect(d.store.get(globalKeys.playlistId)).toBeUndefined();
  });

  it("R-034: deleting the selected portal sends the user to Playlists", async () => {
    const d = deps(registeredStore({ [globalKeys.playlistId]: portal.id }));
    const second = { ...portal, id: "p2" };
    expect(await removePlaylist(d, [portal, second], [portal, second], portal)).toMatchObject({
      toPlaylists: true,
    });
  });

  it("a delete the backend refuses (or cannot receive) changes nothing", async () => {
    const d = deps(memoryStore());
    expect(await removePlaylist(d, [xtream, m3u], [xtream, m3u], xtream)).toEqual({
      kind: "failed",
    });
  });
});

describe("network mode (D-050)", () => {
  it("defaults to the fixtures; the old switch set to off meant production", () => {
    expect(parseNetworkMode(undefined, undefined)).toBe("fixtures");
    expect(parseNetworkMode(undefined, "0")).toBe("production");
    expect(parseNetworkMode("dev_backend", "0")).toBe("dev_backend");
    expect(parseNetworkMode("bogus", undefined)).toBe("fixtures");
  });

  it("the dev backend is the only panel and no agent is asked", async () => {
    setScenario({ agentsDown: true });
    expect(await discoverPanelUrls("dev_backend", MAC, memoryStore())).toEqual([
      `https://${DEV_BACKEND_DOMAIN}/api`,
    ]);
  });

  it("the other modes ask the agents for the panel domains", async () => {
    expect(await discoverPanelUrls("fixtures", MAC, memoryStore())).toEqual(
      buildPanelUrls(FIXTURE_PANEL_DOMAINS),
    );
  });
});
