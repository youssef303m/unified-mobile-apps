// Wires the platform-free session flows to the phone: MMKV, the persisted device id, the
// catalogue database and the network mode. The boot screens call these functions and navigate
// by the route they return.
import * as Application from "expo-application";
import { Image } from "expo-image";

import { webVerifyUrl } from "@/api/ibo/links";
import { PanelClient } from "@/api/ibo/panel";
import { MANUAL_URL_KEY, panelUrlFromManualInput } from "@/api/ibo/servers";
import type { Playlist } from "@/api/ibo/types";
import { clearCache } from "@/content/rules/app";
import { startupPlaylist } from "@/content/rules/playlists";
import { forgetAllPlaylists } from "@/content/sync";
import { acceptTerms, termsAccepted } from "@/content/rules/startup";
import type { Db } from "@/db/database";
import { openCatalogueDb } from "@/db/expoDb";
import { getOrCreateDeviceMac } from "@/platform/deviceIdentity";
import { globalKeys } from "@/storage/keys";
import { kvStore, KEYS, prefixed } from "@/storage/kv";

import { afterDeviceInfo, type AccountRoute } from "./account";
import { DeviceFlow, type CaptchaChallenge, type DeviceOutcome, type DeviceStep } from "./device";
import { networkMode } from "./network";
import { discoverPanelUrls } from "./networkMode";
import { loadPlaylist, type LoadStep } from "./playlistLoad";
import type { ManageDeps } from "./playlists";
import { session } from "./store";

export type BootRoute = "terms" | "verify" | "server_failed" | AccountRoute;
export type BootStep = "identifying_device" | "finding_server" | "server_busy" | DeviceStep;
export type AfterLoad = "home" | "playlists" | "portals";

let dbPromise: Promise<Db> | undefined;

/** The catalogue database, opened (and migrated) once per app run. */
export function catalogueDb(): Promise<Db> {
  dbPromise ??= openCatalogueDb();
  dbPromise.catch(() => {
    dbPromise = undefined;
  });
  return dbPromise;
}

let flow: DeviceFlow | undefined;
let panel: PanelClient | undefined;
let stepListener: ((step: BootStep) => void) | undefined;

/** The status line of the screen currently showing progress. */
export function onBootStep(listener: ((step: BootStep) => void) | undefined): void {
  stepListener = listener;
}

function appVersion(): string {
  return Application.nativeApplicationVersion ?? "1.0.0";
}

function newFlow(panelUrls: string[], macAddress: string): DeviceFlow {
  panel = new PanelClient({
    panelUrls,
    store: kvStore,
    onServerBusy: () => stepListener?.("server_busy"),
  });
  flow = new DeviceFlow({
    store: kvStore,
    panel,
    macAddress,
    version: appVersion(),
    onStep: (step) => stepListener?.(step),
  });
  return flow;
}

function deviceMac(): string {
  stepListener?.("identifying_device");
  const macAddress = getOrCreateDeviceMac();
  session.set({ macAddress });
  return macAddress;
}

/** R-001 then the device flow: terms, device id, servers, verification or device info. */
export async function startBoot(): Promise<BootRoute> {
  if (!termsAccepted(kvStore)) return "terms";
  const macAddress = deviceMac();
  stepListener?.("finding_server");
  const urls = await discoverPanelUrls(networkMode(), macAddress, kvStore);
  return routeDevice(await newFlow(urls, macAddress).start());
}

export function accept(): void {
  acceptTerms(kvStore);
}

/** "Try again" on Server URLs failed with a typed domain (overview.md §4.4). */
export async function retryWithServer(input: string): Promise<BootRoute> {
  const macAddress = deviceMac();
  const typed = input.trim();
  const urls = typed
    ? [panelUrlFromManualInput(typed)]
    : await discoverPanelUrls(networkMode(), macAddress, kvStore);
  const route = await routeDevice(await newFlow(urls, macAddress).start());
  // Remembered only once a server answered through it.
  if (typed && route !== "server_failed") kvStore.set(MANUAL_URL_KEY, typed);
  return route;
}

function currentFlow(): DeviceFlow {
  if (!flow) throw new Error("The device flow has not started");
  return flow;
}

export type VerifyAction =
  { kind: "submit"; code: string } | { kind: "new_code" } | { kind: "web_continue" };

/** The Verify screen's buttons. */
export async function verify(
  challenge: CaptchaChallenge,
  action: VerifyAction,
): Promise<BootRoute> {
  const f = currentFlow();
  const outcome =
    action.kind === "submit"
      ? await f.submit(challenge, action.code)
      : action.kind === "new_code"
        ? await f.newCode(challenge)
        : await f.continueAfterWebVerify(challenge);
  return routeDevice(outcome);
}

/** "Verify on website": this device's /device/verify link (device-and-auth.md §4.2). */
export function webVerifyLink(challenge: CaptchaChallenge): string {
  return webVerifyUrl(currentFlow().identity(), panelClient().appType, challenge.mode);
}

/** "Check again" on the Expired screen: device info again. */
export async function checkAgain(): Promise<BootRoute> {
  return routeDevice(await currentFlow().fetchInfo());
}

async function routeDevice(outcome: DeviceOutcome): Promise<BootRoute> {
  if (outcome.kind === "captcha") {
    session.set({ challenge: outcome.challenge });
    return "verify";
  }
  if (outcome.kind === "server_failed") return "server_failed";
  const macAddress = session.get().macAddress ?? "";
  const result = await afterDeviceInfo(
    { store: kvStore, panel: panel as PanelClient, macAddress },
    outcome.info,
    outcome.offline,
  );
  session.set({
    info: outcome.info,
    offline: outcome.offline,
    accountState: result.state,
    playlists: result.playlists,
    challenge: undefined,
    startupChooser: result.route === "choose_playlist",
    active: result.route === "expired" ? undefined : session.get().active,
  });
  return result.route;
}

/** The panel client of this boot (Playlists and Portals save and delete through it). */
export function panelClient(): PanelClient {
  if (!panel) throw new Error("The device flow has not started");
  return panel;
}

/**
 * Loads a playlist: the given one (a switch), else the saved or first one (R-020). With no
 * playlist at all, the Playlists screen shows its empty state.
 */
export async function loadActivePlaylist(
  options: {
    playlistId?: string;
    signal?: AbortSignal;
    onStep?: (step: LoadStep) => void;
    /** R-021: Auto Switch loaded this playlist instead of the requested one. */
    onAutoSwitch?: (playlist: Playlist) => void;
  } = {},
): Promise<AfterLoad> {
  const { playlists } = session.get();
  const requested = options.playlistId
    ? playlists.find((p) => p.id === options.playlistId)
    : undefined;
  const choice = requested
    ? { kind: "load" as const, playlist: requested }
    : startupPlaylist("automatic", kvStore.get(globalKeys.playlistId), playlists);
  if (choice.kind === "choose") {
    session.set({ failure: undefined, active: undefined });
    return "playlists";
  }
  session.set({ active: undefined });
  const outcome = await loadPlaylist(
    { store: kvStore, db: await catalogueDb(), signal: options.signal, onStep: options.onStep },
    choice.playlist,
    playlists,
  );
  if (outcome.kind === "failed") {
    session.set({ failure: outcome.failure });
    return outcome.failure.screen;
  }
  if (outcome.switched) options.onAutoSwitch?.(outcome.playlist);
  session.set({
    active: { playlist: outcome.playlist, catalogue: outcome.session, provider: outcome.provider },
    failure: undefined,
    startupChooser: false,
  });
  return "home";
}

/** Replaces the playlist list after an add or delete. */
export function setPlaylists(playlists: Playlist[]): void {
  session.set({ playlists });
}

/**
 * Dev and preview builds: forget everything but the language and the network mode, as after a
 * fresh install (used when switching network mode and by the e2e flows). The device id stays.
 */
export function resetAppData(): void {
  const keep = new Map<string, string | undefined>(
    [KEYS.language, KEYS.networkMode].map((k) => [prefixed(k), kvStore.get(prefixed(k))]),
  );
  clearCache(kvStore);
  for (const [key, value] of keep) if (value !== undefined) kvStore.set(key, value);
  flow = undefined;
  panel = undefined;
  session.reset();
}

/**
 * Settings → Clear Cache (R-120): every setting, favourite and position goes (the device id stays,
 * so the device re-verifies with the same MAC), with the cached catalogue and images. The dev-build
 * network mode and fixture scenario stay, so a development build never falls back to production.
 * The caller restarts the app.
 */
export async function clearAppCache(): Promise<void> {
  const keep = new Map<string, string | undefined>(
    [KEYS.networkMode, KEYS.fixtureScenario].map((k) => [prefixed(k), kvStore.get(prefixed(k))]),
  );
  clearCache(kvStore);
  for (const [key, value] of keep) if (value !== undefined) kvStore.set(key, value);
  await forgetAllPlaylists(await catalogueDb());
  await Image.clearDiskCache();
}

/** The Playlists and Portals screens' add and delete calls. */
export function manageDeps(): ManageDeps {
  return { store: kvStore, panel: panelClient(), macAddress: session.get().macAddress ?? "" };
}
