import { analyticsReceived } from "@/api/__fixtures__/services";
import { ANALYTICS_SESSIONS_KEY } from "@/api/analytics";
import { memoryStore } from "@/api/store";

import {
  analyticsAfterDeviceInfo,
  analyticsEnabled,
  flushAnalytics,
  resetAnalyticsForTests,
  trackTabOpened,
  type AnalyticsDeps,
} from "../analytics";

const device = {
  platform: "android",
  modelName: "Pixel",
  version: "15",
  sdkVersion: "35",
  screenWidth: 1080,
  screenHeight: 2400,
  uhd: false,
};

function deps(mode: AnalyticsDeps["mode"]): AnalyticsDeps {
  return {
    store: memoryStore(),
    mode,
    macAddress: "3A:E3:1A:46:33:A5",
    appVersion: "1.0.0",
    device,
  };
}

function events(store: AnalyticsDeps["store"]): string[] {
  const sessions = JSON.parse(store.get(ANALYTICS_SESSIONS_KEY) ?? "[]") as {
    events: { tracker: string }[];
  }[];
  return sessions.flatMap((s) => s.events.map((e) => e.tracker));
}

beforeEach(() => {
  resetAnalyticsForTests();
  analyticsReceived.length = 0;
});

describe("analytics wiring (R-133, Q-analytics)", () => {
  it("runs only in the production network mode", async () => {
    expect(analyticsEnabled("production")).toBe(true);
    expect(analyticsEnabled("fixtures")).toBe(false);
    expect(analyticsEnabled("dev_backend")).toBe(false);
    const d = deps("fixtures");
    await analyticsAfterDeviceInfo(d, { ip_address: "203.0.113.42" });
    await trackTabOpened("live");
    await flushAnalytics();
    expect(d.store.get(ANALYTICS_SESSIONS_KEY)).toBeUndefined();
    expect(analyticsReceived).toHaveLength(0);
  });

  it("R-133: opening Live TV, Movies or Series is an event; other tabs are not", async () => {
    const d = deps("production");
    await analyticsAfterDeviceInfo(d, { ip_address: "203.0.113.42" });
    for (const tab of ["home", "live", "movies", "series", "my-list"]) await trackTabOpened(tab);
    expect(events(d.store)).toEqual(["live_opened", "movies_opened", "series_opened"]);
  });

  it("starts one session per launch, even after Check again", async () => {
    const d = deps("production");
    await analyticsAfterDeviceInfo(d, { ip_address: "203.0.113.42" });
    await analyticsAfterDeviceInfo(d, { ip_address: "198.51.100.1" });
    const sessions = JSON.parse(d.store.get(ANALYTICS_SESSIONS_KEY) ?? "[]") as {
      ip_address: string;
    }[];
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.ip_address).toBe("203.0.113.42");
  });

  it("uploads what is buffered when the app goes to the background", async () => {
    const d = deps("production");
    await analyticsAfterDeviceInfo(d, {});
    await trackTabOpened("movies");
    expect(analyticsReceived).toHaveLength(0);
    await flushAnalytics();
    expect(analyticsReceived).toHaveLength(1);
    expect(events(d.store)).toEqual([]);
  });
});
