import { FIXTURE_PANEL_DOMAINS } from "@/api/__fixtures__/hosts";
import { FIXTURE_TOKEN } from "@/api/__fixtures__/ibo";
import { setScenario } from "@/api/__fixtures__/scenario";
import { deviceInfo } from "@/api/ibo/client";
import { PanelClient } from "@/api/ibo/panel";
import { buildPanelUrls, MANUAL_URL_KEY } from "@/api/ibo/servers";
import type { Playlist } from "@/api/ibo/types";
import { memoryStore } from "@/api/store";
import { globalKeys } from "@/storage/keys";

import { pinAfterLogin } from "../parental";
import {
  acceptTerms,
  accountState,
  deviceCredentials,
  isLicenseExpired,
  isLoadable,
  LOADING_WATCHDOG_MS,
  licenseStatusLabel,
  mustReverify,
  removeDemoEntry,
  termsAccepted,
  watchdogDue,
  WATCHDOG_ACTIONS,
  whenAllServersFail,
} from "../startup";

const today = new Date(2026, 8, 26);
const id = { macAddress: "3A:E3:1A:46:33:A5", uid: "K7MQ3X", version: "1.0.0" };

describe("A. Startup, terms, device and licence", () => {
  it("R-001: the terms are asked until accepted, then never again", () => {
    const store = memoryStore();
    expect(termsAccepted(store)).toBe(false);
    acceptTerms(store);
    expect(store.get(globalKeys.termsApproved)).toBe("true");
    expect(termsAccepted(store)).toBe(true);
  });

  it("R-002: the device id and key; the key falls back to the cached account", () => {
    expect(deviceCredentials(id.macAddress, { device_key: "482913" }, undefined)).toEqual({
      deviceId: id.macAddress,
      deviceKey: "482913",
    });
    expect(
      deviceCredentials(id.macAddress, {}, JSON.stringify({ device_key: 111222 })).deviceKey,
    ).toBe("111222");
  });

  it("R-003: 401/403 and 'device not found' restart verification", async () => {
    expect(mustReverify({ kind: "auth_error" })).toBe(true);
    expect(mustReverify({ kind: "not_found" })).toBe(true);
    expect(mustReverify({ kind: "other" })).toBe(false);
    setScenario({ deviceUnknown: true });
    const panel = new PanelClient({
      panelUrls: buildPanelUrls(FIXTURE_PANEL_DOMAINS),
      store: memoryStore(),
    });
    expect(await deviceInfo(panel, id, FIXTURE_TOKEN)).toEqual({ kind: "not_found" });
  });

  it("R-004: servers are tried in turn; all failing → offline from cache, else the manual server screen", async () => {
    setScenario({ panelsDown: [FIXTURE_PANEL_DOMAINS[0] as string] });
    const busy: number[] = [];
    const panel = new PanelClient({
      panelUrls: buildPanelUrls(FIXTURE_PANEL_DOMAINS),
      store: memoryStore(),
      onServerBusy: (n) => busy.push(n),
    });
    expect((await deviceInfo(panel, id, FIXTURE_TOKEN)).kind).toBe("ok");
    expect(busy).toEqual([2]);
    expect(whenAllServersFail('{"expire_date":"2027-01-01"}')).toBe("offline");
    expect(whenAllServersFail(undefined)).toBe("server_urls_failed");
    // A custom domain that works is remembered.
    setScenario({ panelsDown: [] });
    const store = memoryStore({ [MANUAL_URL_KEY]: FIXTURE_PANEL_DOMAINS[1] as string });
    await deviceInfo(new PanelClient({ panelUrls: [], store }), id, FIXTURE_TOKEN);
    expect(store.get(MANUAL_URL_KEY)).toBe(FIXTURE_PANEL_DOMAINS[1]);
  });

  it("R-005: offline, the cached account is used and an expired cached date still blocks", () => {
    const cached = { expire_date: "2026-01-01", mac_registered: true };
    expect(whenAllServersFail(JSON.stringify(cached))).toBe("offline");
    expect(accountState(cached, { today })).toBe("expired");
    expect(accountState({ ...cached, expire_date: "2027-01-01" }, { today })).toBe("active");
  });

  it("R-006: expire_date before today blocks the app (expired screen)", () => {
    expect(isLicenseExpired("2026-09-25", today)).toBe(true);
    expect(isLicenseExpired("2026-09-26", today)).toBe(false);
    expect(accountState({ expire_date: "2026-09-25", mac_registered: true }, { today })).toBe(
      "expired",
    );
  });

  it("R-007: not registered → trial welcome; registered → active", () => {
    expect(accountState({ expire_date: "2027-01-01", mac_registered: false }, { today })).toBe(
      "trial",
    );
    expect(accountState({ expire_date: "2027-01-01", mac_registered: true }, { today })).toBe(
      "active",
    );
    // Expiry wins over the trial state.
    expect(accountState({ expire_date: "2026-01-01", mac_registered: false }, { today })).toBe(
      "expired",
    );
  });

  it("R-008: status label is Active for is_trial 2 or 3, Trial otherwise", () => {
    expect(licenseStatusLabel(2)).toBe("active");
    expect(licenseStatusLabel(3)).toBe("active");
    expect(licenseStatusLabel(0)).toBe("trial");
    expect(licenseStatusLabel(undefined)).toBe("trial");
  });

  it("R-009: the demo entry is removed when others exist; an entry without URL is not loadable", () => {
    const demo: Playlist = { id: "demo", playlist_type: "general", url: "" };
    const real: Playlist = { id: "1", playlist_type: "xc", url: "http://h" };
    expect(removeDemoEntry([demo, real]).map((p) => p.id)).toEqual(["1"]);
    expect(removeDemoEntry([demo]).map((p) => p.id)).toEqual(["demo"]);
    expect(isLoadable(demo)).toBe(false);
    expect(isLoadable(real)).toBe(true);
  });

  it("R-010: a parent_pin from device info replaces the local PIN at every login", () => {
    expect(pinAfterLogin("1111", "2222")).toBe("2222");
    expect(pinAfterLogin("1111", undefined)).toBe("1111");
    expect(pinAfterLogin(undefined, undefined)).toBe("0000");
    expect(pinAfterLogin("1111", "off")).toBe("off");
  });

  it("R-011: after 120 s of loading, offer Change Playlist / Restart / Dismiss", () => {
    expect(LOADING_WATCHDOG_MS).toBe(120_000);
    expect(watchdogDue(0, 119_999, true)).toBe(false);
    expect(watchdogDue(0, 120_000, true)).toBe(true);
    expect(watchdogDue(0, 200_000, false)).toBe(false);
    expect(WATCHDOG_ACTIONS).toEqual(["change_playlist", "restart_app", "dismiss"]);
  });
});
