// A. Startup, terms, device and licence (01-product/business-rules.md R-001…R-011).
import type { KeyValueStore } from "@/api/store";
import type { DeviceInfo, Playlist } from "@/api/ibo/types";
import { globalKeys } from "@/storage/keys";

/** R-001: the terms are shown until accepted; acceptance is stored for good. */
export function termsAccepted(store: KeyValueStore): boolean {
  return store.get(globalKeys.termsApproved) === "true";
}

export function acceptTerms(store: KeyValueStore): void {
  store.set(globalKeys.termsApproved, "true");
}

/**
 * R-002: the device id and device key shown to the user. The key comes from device info, or
 * the cached `api_data` when the reply has none.
 */
export function deviceCredentials(
  macAddress: string,
  info: Pick<DeviceInfo, "device_key"> | undefined,
  cachedApiData: string | undefined,
): { deviceId: string; deviceKey: string } {
  let cachedKey = "";
  try {
    const cached = cachedApiData
      ? (JSON.parse(cachedApiData) as { device_key?: unknown })
      : undefined;
    if (typeof cached?.device_key === "string" || typeof cached?.device_key === "number")
      cachedKey = String(cached.device_key);
  } catch {
    cachedKey = "";
  }
  return { deviceId: macAddress, deviceKey: info?.device_key || cachedKey };
}

/** R-003: these replies clear the token and restart verification. */
export function mustReverify(
  reply: { kind: "auth_error" } | { kind: "not_found" } | { kind: "other" },
): boolean {
  return reply.kind === "auth_error" || reply.kind === "not_found";
}

/**
 * R-004: when every server failed, start offline from the cached account if there is one,
 * otherwise show the "Server URLs failed" screen.
 */
export function whenAllServersFail(
  cachedApiData: string | undefined,
): "offline" | "server_urls_failed" {
  return cachedApiData ? "offline" : "server_urls_failed";
}

/** R-006: the licence is expired when `expire_date` (YYYY-MM-DD) is before today (device date). */
export function isLicenseExpired(expireDate: string, today: Date = new Date()): boolean {
  if (!expireDate) return false;
  return expireDate < localIsoDate(today);
}

export function localIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type AccountState = "expired" | "trial" | "active";

/**
 * R-005, R-006, R-007: the account state that routes the app after device info. Offline, `info`
 * is the cached reply of the last successful connection, and an expired date there blocks the app
 * just as online (owner's answer to Q-offline-expired, docs/decisions.md D-035). A new device on
 * its 7-day trial (the backend creates it with is_trial 0) sees the Welcome screen even though the
 * backend reports it registered (owner's answer to Q-mac-registered, D-056).
 */
export function accountState(
  info: Pick<DeviceInfo, "expire_date" | "mac_registered" | "is_trial">,
  options: { today?: Date } = {},
): AccountState {
  if (isLicenseExpired(info.expire_date, options.today)) return "expired";
  return info.mac_registered && info.is_trial !== 0 ? "active" : "trial";
}

/** R-008 (Q-is-trial): "Active" when is_trial is 2 or 3, otherwise "Trial". */
export function licenseStatusLabel(isTrial: number | undefined): "active" | "trial" {
  return isTrial === 2 || isTrial === 3 ? "active" : "trial";
}

/** R-009: with more than one playlist, a first entry with id "demo" is removed. */
export function removeDemoEntry(playlists: readonly Playlist[]): Playlist[] {
  if (playlists.length > 1 && playlists[0]?.id === "demo") return playlists.slice(1);
  return [...playlists];
}

/** R-009: an entry without a URL cannot be loaded ("This playlist has no server address…"). */
export function isLoadable(playlist: Playlist): boolean {
  return Boolean(playlist.url || playlist.portal_address);
}

/** R-011: the loading watchdog. */
export const LOADING_WATCHDOG_MS = 120_000;
export const WATCHDOG_ACTIONS = ["change_playlist", "restart_app", "dismiss"] as const;

export function watchdogDue(startedAt: number, now: number, stillLoading: boolean): boolean {
  return stillLoading && now - startedAt >= LOADING_WATCHDOG_MS;
}
