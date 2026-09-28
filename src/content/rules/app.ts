// J. Expiry notifications, K. settings side-effects, L. Stararcs proxy, M. misc
// (01-product/business-rules.md R-110…R-133).
import type { KeyValueStore } from "@/api/store";
import { globalKeys, P } from "@/storage/keys";

import type { SourceType } from "../types";

// ---------- J ----------

export type ExpiryNotice = { kind: "hours" } | { kind: "days"; days: number } | { kind: "unknown" };

/**
 * R-114: on entering Home, an Xtream playlist expiring in 0–5 days (ceil of days until the
 * date, from local midnight) shows the notice. Not for Stalker, not for unlimited.
 */
export function playlistExpiryNotice(
  source: SourceType,
  expUnix: number | null | undefined,
  now: Date = new Date(),
): ExpiryNotice | undefined {
  if (source !== "xtream" || expUnix === null) return undefined;
  if (expUnix === undefined || !Number.isFinite(expUnix)) return { kind: "unknown" };
  const expiry = new Date(expUnix * 1000);
  const midnight = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate()).getTime();
  const days = Math.ceil((midnight - now.getTime()) / 86_400_000);
  if (days < 0 || days > 5) return undefined;
  return days === 0 ? { kind: "hours" } : { kind: "days", days };
}

/** R-111: the app licence date is shown (Home, Account) but never raises a notice. */
export const LICENSE_DATE_NOTICE = false;

// ---------- K ----------

/**
 * R-120: Clear Cache deletes every prefixed key (settings go back to defaults, the device
 * re-verifies). The TV keeps its analytics keys; the phone has none (D-080). The caller
 * restarts the app afterwards.
 */
export function clearCache(store: KeyValueStore): number {
  let removed = 0;
  for (const key of store.keys()) {
    if (key.startsWith(P)) {
      store.remove(key);
      removed++;
    }
  }
  return removed;
}

// R-121 (language applies immediately, English fallback) lives in src/i18n (changeLanguage).

/** R-122: TMDB off disables every TMDB call. */
export function tmdbAllowed(store: KeyValueStore): boolean {
  return store.get(globalKeys.tmdbChoice) !== "off";
}

/** R-123: switching Load on Demand to Disabled restarts the app; Enabled waits for next launch. */
export function setLoadOnDemand(store: KeyValueStore, enabled: boolean): { restartNow: boolean } {
  store.set(globalKeys.loadOnDemand, enabled ? "1" : "0");
  return { restartNow: !enabled };
}

// ---------- L ----------

const PROXY_KEYS = [
  globalKeys.smartProxyConnectionState,
  globalKeys.smartProxyRegion,
  globalKeys.smartProxyCountry,
  globalKeys.smartProxyServer,
];

/**
 * R-110: on a cold start the proxy selection is cleared unless Keep Connection is on or the
 * start was an in-app Reload (`isRefresh`, consumed here).
 */
export function resetProxyOnColdStart(store: KeyValueStore): {
  cleared: boolean;
  waitForProxy: boolean;
} {
  const keep = store.get(globalKeys.keepConnection) === "on";
  const refresh = store.get(globalKeys.isRefresh) === "true";
  store.remove(globalKeys.isRefresh);
  if (!keep && !refresh) {
    for (const key of PROXY_KEYS) store.remove(key);
    return { cleared: true, waitForProxy: false };
  }
  return { cleared: false, waitForProxy: keep };
}

/** R-110: with Keep Connection on, loading waits at most 15 s for the proxy status. */
export const PROXY_GATE_MS = 15_000;

/** R-112: Success and Guest can use the proxy; any other status turns it off. */
export function proxyUsable(status: string | undefined): boolean {
  return status === "Success" || status === "Guest";
}

/** R-113: Home shows "Connected to <country>" while the proxy is connected. */
export function proxyConnectedLabel(
  connected: boolean,
  country: string | undefined,
): string | undefined {
  return connected && country ? country : undefined;
}

// ---------- M ----------

/** R-130 (screens.md): on Home, a second Back within 2 s exits; the first shows a toast. */
export const EXIT_BACK_WINDOW_MS = 2000;

export function homeBackAction(lastBackAt: number | undefined, now: number): "toast" | "exit" {
  return lastBackAt !== undefined && now - lastBackAt <= EXIT_BACK_WINDOW_MS ? "exit" : "toast";
}

/**
 * R-131: toasts last 2 s on TV; the mobile design system specifies 4 s (design-system.md §5),
 * which the phone uses (docs/decisions.md D-039).
 */
export const TV_TOAST_MS = 2000;
export const TOAST_MS = 4000;

/** R-132: the weather cache is stale after 13 days. */
export const WEATHER_MAX_AGE_DAYS = 13;

export function weatherIsStale(savedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - savedAt.getTime() > WEATHER_MAX_AGE_DAYS * 86_400_000;
}
