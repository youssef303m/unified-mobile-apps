import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

import { memoryStore } from "@/api/store";
import { globalKeys } from "@/storage/keys";

import {
  clearCache,
  EXIT_BACK_WINDOW_MS,
  homeBackAction,
  LICENSE_DATE_NOTICE,
  playlistExpiryNotice,
  PROXY_GATE_MS,
  proxyConnectedLabel,
  proxyUsable,
  resetProxyOnColdStart,
  setLoadOnDemand,
  TOAST_MS,
  TV_TOAST_MS,
  tmdbAllowed,
  weatherIsStale,
} from "../app";

describe("J. Expiry notifications", () => {
  const now = new Date(2026, 8, 26, 10, 0);
  const at = (days: number) => new Date(2026, 8, 26 + days, 23, 0).getTime() / 1000;

  it("R-114: 0–5 days before an Xtream playlist expires, the notice shows the days", () => {
    expect(playlistExpiryNotice("xtream", at(0), now)).toEqual({ kind: "hours" });
    expect(playlistExpiryNotice("xtream", at(1), now)).toEqual({ kind: "days", days: 1 });
    expect(playlistExpiryNotice("xtream", at(5), now)).toEqual({ kind: "days", days: 5 });
    expect(playlistExpiryNotice("xtream", at(6), now)).toBeUndefined();
    expect(playlistExpiryNotice("xtream", null, now)).toBeUndefined();
    expect(playlistExpiryNotice("stalker", at(1), now)).toBeUndefined();
    expect(playlistExpiryNotice("xtream", undefined, now)).toEqual({ kind: "unknown" });
  });

  it("R-111: the app licence date is displayed but never raises a notice", () => {
    expect(LICENSE_DATE_NOTICE).toBe(false);
  });
});

describe("K. Settings side-effects", () => {
  it("R-120: Clear Cache wipes every prefixed key (no analytics keys on the phone, D-080)", () => {
    const store = memoryStore({
      [globalKeys.termsApproved]: "true",
      [globalKeys.v4Token]: "t",
      gz3rYzUIC7_4821live_favourite: "[]",
      stalker_mac: "00:1A:79:00:00:01",
    });
    expect(clearCache(store)).toBe(3);
    expect(store.keys()).toEqual(["stalker_mac"]);
  });

  it("R-122: TMDB off disables TMDB calls", () => {
    const store = memoryStore();
    expect(tmdbAllowed(store)).toBe(true);
    store.set(globalKeys.tmdbChoice, "off");
    expect(tmdbAllowed(store)).toBe(false);
  });

  it("R-123: Load on Demand → Disabled restarts now; Enabled waits for the next launch", () => {
    const store = memoryStore();
    expect(setLoadOnDemand(store, false)).toEqual({ restartNow: true });
    expect(store.get(globalKeys.loadOnDemand)).toBe("0");
    expect(setLoadOnDemand(store, true)).toEqual({ restartNow: false });
  });
});

describe("L. Stararcs proxy", () => {
  it("R-110: a cold start clears the proxy unless Keep Connection is on or it was a Reload", () => {
    const withProxy = () =>
      memoryStore({
        [globalKeys.smartProxyConnectionState]: "true",
        [globalKeys.smartProxyCountry]: "2",
      });
    const plain = withProxy();
    expect(resetProxyOnColdStart(plain)).toEqual({ cleared: true, waitForProxy: false });
    expect(plain.get(globalKeys.smartProxyConnectionState)).toBeUndefined();
    const keep = withProxy();
    keep.set(globalKeys.keepConnection, "on");
    expect(resetProxyOnColdStart(keep)).toEqual({ cleared: false, waitForProxy: true });
    const reload = withProxy();
    reload.set(globalKeys.isRefresh, "true");
    expect(resetProxyOnColdStart(reload).cleared).toBe(false);
    expect(reload.get(globalKeys.isRefresh)).toBeUndefined();
    expect(PROXY_GATE_MS).toBe(15_000);
  });

  it("R-112: Success and Guest can use the proxy; anything else turns it off", () => {
    expect(proxyUsable("Success")).toBe(true);
    expect(proxyUsable("Guest")).toBe(true);
    expect(proxyUsable("Expired")).toBe(false);
    expect(proxyUsable(undefined)).toBe(false);
  });

  it("R-113: Home shows the connected country", () => {
    expect(proxyConnectedLabel(true, "Germany")).toBe("Germany");
    expect(proxyConnectedLabel(false, "Germany")).toBeUndefined();
  });
});

describe("M. Misc", () => {
  it("R-130: on Home, a second Back within 2 s exits", () => {
    expect(homeBackAction(undefined, 1000)).toBe("toast");
    expect(homeBackAction(1000, 1000 + EXIT_BACK_WINDOW_MS)).toBe("exit");
    expect(homeBackAction(1000, 1000 + EXIT_BACK_WINDOW_MS + 1)).toBe("toast");
  });

  it("R-131: toasts are 2 s on TV; the phone uses the design system's 4 s", () => {
    expect(TV_TOAST_MS).toBe(2000);
    expect(TOAST_MS).toBe(4000);
  });

  it("R-132: the weather cache is stale after 13 days", () => {
    const now = new Date(2026, 8, 26);
    expect(weatherIsStale(new Date(2026, 8, 14), now)).toBe(false);
    expect(weatherIsStale(new Date(2026, 8, 12), now)).toBe(true);
  });
});

describe("every business rule has a test named after it", () => {
  const root = join(__dirname, "../../../..");

  function testFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === "node_modules" ? [] : testFiles(path);
      return /\.test\.tsx?$/.test(name) ? [path] : [];
    });
  }

  // Rules the owner dropped from the phone app, with the decision that says so.
  const DROPPED: Record<string, string> = {
    "R-133": "D-080: no analytics in the phone app",
  };

  it("covers every R-xxx in 01-product/business-rules.md", () => {
    const rules = readFileSync(
      join(root, "iboplayer-mobile-kit/01-product/business-rules.md"),
      "utf8",
    );
    const ids = [...new Set([...rules.matchAll(/\*\*(R-\d{3})\b/g)].map((m) => m[1] as string))];
    const tested = new Set(
      testFiles(join(root, "src")).flatMap((file) =>
        [...readFileSync(file, "utf8").matchAll(/it\(\s*"(R-\d{3}):/g)].map((m) => m[1] as string),
      ),
    );
    expect(ids.length).toBeGreaterThan(80);
    expect(ids.filter((id) => !tested.has(id) && !(id in DROPPED))).toEqual([]);
  });
});
