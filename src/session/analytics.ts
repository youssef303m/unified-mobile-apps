// Usage analytics wiring (02-backend/services.md "Analytics", R-133, Q-analytics; docs/decisions.md
// D-080). The client (src/api/analytics.ts) batches and uploads; this module decides when. It runs
// only in the production network mode: IBO's analytics server is a real IBO server, never called
// from fixtures or the dev backend.
import { Analytics, type AnalyticsDevice } from "@/api/analytics";
import type { KeyValueStore } from "@/api/store";
import type { DeviceInfo } from "@/api/ibo/types";
import { sectionTracker } from "@/content/rules/app";
import type { ContentKind } from "@/content/types";

import type { NetworkMode } from "./networkMode";

export interface AnalyticsDeps {
  store: KeyValueStore;
  mode: NetworkMode;
  macAddress: string;
  appVersion: string;
  device: AnalyticsDevice;
}

let client: Analytics | undefined;

export function analyticsEnabled(mode: NetworkMode): boolean {
  return mode === "production";
}

/**
 * After each device_info (boot, Check again): one session per launch, the IP from the reply, and
 * the upload rule (≥ 10 events buffered, or the oldest ≥ 24 h old).
 */
export async function analyticsAfterDeviceInfo(
  deps: AnalyticsDeps,
  info: Pick<DeviceInfo, "ip_address">,
): Promise<void> {
  if (!analyticsEnabled(deps.mode)) return;
  if (!client) {
    client = new Analytics(deps.store, {
      macAddress: deps.macAddress,
      appVersion: deps.appVersion,
      device: deps.device,
    });
    client.startSession();
  }
  client.setLocation({ ip: info.ip_address });
  if (client.shouldFlushAfterDeviceInfo()) await client.upload();
}

const TAB_KINDS: Partial<Record<string, ContentKind>> = {
  live: "live",
  movies: "movie",
  series: "series",
};

/** R-133: opening Live TV, Movies or Series (the TV's home tiles) is an event. */
export async function trackTabOpened(tab: string): Promise<void> {
  const kind = TAB_KINDS[tab];
  if (!client || !kind) return;
  await client.track(sectionTracker(kind));
}

/** Uploads what is buffered when the app goes to the background. */
export async function flushAnalytics(): Promise<void> {
  await client?.upload();
}

/** Tests only. */
export function resetAnalyticsForTests(): void {
  client = undefined;
}
