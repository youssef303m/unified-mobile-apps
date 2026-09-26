// Every IBO panel endpoint (02-backend/ibo-api-reference.md #2-#10). The flow that chains them
// (verify → login → device_info, re-login on AuthError) is the session layer's job (M3).
import { config } from "@/config";

import { decryptResponse, encryptRequest } from "../crypto";
import { FORM_CONTENT_TYPE, formEncode, send, tryParseJson } from "../http";
import { asArray, asObject, num, optStr, str, truthy, type JsonObject } from "../parse";
import { secureRandom, shuffled, type RandomSource } from "../random";

import type { PanelClient } from "./panel";
import { parsePlaylist } from "./playlists";
import type {
  DeviceIdentity,
  DeviceInfo,
  DeviceInfoResult,
  DeviceLoginResult,
  Playlist,
  RecaptchaResult,
  SavePlaylistResult,
} from "./types";

// ---------- #2 recaptcha ----------

export async function recaptcha(panel: PanelClient, macAddress: string): Promise<RecaptchaResult> {
  const { answer } = await panel.request({
    path: "recaptcha",
    payload: { mac_address: macAddress, app_type: panel.appType },
    encrypted: false,
    responseMode: "plain",
  });
  const o = asObject(answer);
  const status = str(o.status);
  if (status === "already_verified") return { kind: "already_verified" };
  const captcha = str(o.captcha);
  if (status === "success" && captcha)
    return { kind: "captcha", captchaSvg: captcha, token: str(o.token) };
  return { kind: "error" };
}

// ---------- #3 device_login ----------

export interface CaptchaAnswer {
  recaptchaCode?: string;
  recaptchaToken?: string;
  /** uid-captcha mode; uppercased before sending. */
  uidCaptchaCode?: string;
  uidCaptchaToken?: string;
}

function identityPayload(panel: PanelClient, id: DeviceIdentity): Record<string, unknown> {
  return { mac_address: id.macAddress, app_type: panel.appType, u_id: id.uid, version: id.version };
}

function uidCaptcha(o: JsonObject, tokenKey: string) {
  return {
    kind: "uid_captcha" as const,
    captchaSvg: str(o.captcha),
    captchaToken: str(o[tokenKey]),
    message: str(o.message),
  };
}

export async function deviceLogin(
  panel: PanelClient,
  id: DeviceIdentity,
  answer: CaptchaAnswer = {},
): Promise<DeviceLoginResult> {
  const payload = identityPayload(panel, id);
  if (answer.recaptchaCode !== undefined) {
    payload.recaptcha_code = answer.recaptchaCode;
    payload.recaptcha_token = answer.recaptchaToken ?? "";
  }
  if (answer.uidCaptchaCode !== undefined) {
    payload.uid_captcha_code = answer.uidCaptchaCode.toUpperCase();
    payload.uid_captcha_token = answer.uidCaptchaToken ?? "";
  }
  const { answer: reply } = await panel.request({
    path: "device_login",
    payload,
    encrypted: true,
    responseMode: "encrypted",
  });
  const o = asObject(reply);
  const status = str(o.status);
  const token = str(o.token);
  if (status === "success" && token) return { kind: "success", token };
  if (status === "uid_mismatch_captcha") return uidCaptcha(o, "captcha_token");
  const message = str(o.message);
  if (num(o.error_code) === 401 || /captcha/i.test(message))
    return { kind: "captcha_error", message };
  return { kind: "error", message: message || undefined };
}

// ---------- #4 device_info ----------

export function parseDeviceInfo(reply: unknown): DeviceInfo {
  const o = asObject(reply);
  return {
    mac_registered: truthy(o.mac_registered),
    expire_date: str(o.expire_date),
    is_trial: num(o.is_trial),
    trial_days: num(o.trial_days),
    device_key: optStr(o.device_key),
    ip_address: optStr(o.ip_address),
    parent_pin: optStr(o.parent_pin),
    tmdb_api_key: optStr(o.tmdb_api_key),
    themes: asArray(o.themes).map((t) => ({
      name: str(asObject(t).name),
      url: str(asObject(t).url),
    })),
    urls: asArray(o.urls).map(parsePlaylist),
    raw: o,
  };
}

export async function deviceInfo(
  panel: PanelClient,
  id: DeviceIdentity,
  token: string | null,
): Promise<DeviceInfoResult> {
  const reply = await panel.requestAuthed({
    path: "device_info",
    payload: identityPayload(panel, id),
    encrypted: true,
    responseMode: "encrypted",
    token,
  });
  const o = asObject(reply);
  const status = str(o.status);
  if (status === "uid_mismatch_captcha") return uidCaptcha(o, "captcha_token");
  if (status === "error") {
    if (num(o.error_code) === 404) return { kind: "not_found" };
    return { kind: "error", message: optStr(o.message) };
  }
  return { kind: "ok", info: parseDeviceInfo(reply) };
}

// ---------- #5-7 manage/add_playlist, update_playlist, delete_playlist ----------

/** add vs update (ibo-api-reference.md "Operation choice"). */
export function saveOperation(entry: Playlist): "add" | "update" {
  if (typeof entry.is_created === "boolean") return entry.is_created ? "add" : "update";
  return entry.id.startsWith("non_saved_") ? "add" : "update";
}

export function savePlaylistPayload(
  entry: Playlist,
  op: "add" | "update",
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    playListName: entry.playlist_name ?? entry.portal_name ?? "",
    playListURL: entry.origin_url ?? entry.url ?? "",
    username: entry.username ?? "",
    password: entry.password ?? "",
    playlist_type: entry.playlist_type ?? entry.origin_type ?? "",
    is_protected: entry.is_protected ? 1 : 0,
  };
  if (entry.pin) payload.pin = entry.pin;
  if (op === "update") payload.playlistId = entry.id;
  if (entry.playlist_type === "stalker") {
    payload.portal_name = entry.portal_name ?? "";
    payload.portal_address = entry.portal_address ?? "";
    payload.portal_fallback_address = entry.portal_fallback_address ?? "";
    payload.stalker_mac_address = entry.stalker_mac_address ?? "";
  }
  return payload;
}

async function manage(
  panel: PanelClient,
  path: string,
  payload: Record<string, unknown>,
  macAddress: string,
  token: string | null,
): Promise<SavePlaylistResult> {
  const reply = await panel.requestAuthed({
    path: `manage/${path}`,
    payload: { ...payload, mac_address: macAddress, app_type: panel.appType },
    encrypted: true,
    responseMode: "plainWithEncryptedErrors",
    token,
  });
  const o = asObject(reply);
  if (str(o.status) === "success") return { kind: "success", playlist: asObject(o.playlist) };
  // The backend puts some errors under `result` ("not found", another device's playlist).
  return { kind: "error", message: optStr(o.msg) ?? optStr(o.message) ?? optStr(o.result) };
}

export function savePlaylist(
  panel: PanelClient,
  entry: Playlist,
  macAddress: string,
  token: string | null,
): Promise<SavePlaylistResult> {
  const op = saveOperation(entry);
  return manage(panel, `${op}_playlist`, savePlaylistPayload(entry, op), macAddress, token);
}

export function deletePlaylist(
  panel: PanelClient,
  playlistId: string,
  macAddress: string,
  token: string | null,
): Promise<SavePlaylistResult> {
  return manage(panel, "delete_playlist", { playlistId }, macAddress, token);
}

// ---------- #8 device/add (Stararcs token) ----------

const STARARCS_TOKEN_PATHS = [
  ["Response", "Device", "Token"],
  ["Response", "Token"],
  ["Token"],
  ["response", "device", "Token"],
  ["response", "device", "token"],
  ["response", "token"],
] as const;

export function extractStararcsToken(reply: unknown): string | undefined {
  for (const path of STARARCS_TOKEN_PATHS) {
    let node: unknown = reply;
    for (const key of path) node = asObject(node)[key];
    const token = optStr(node);
    if (token) return token;
  }
  return undefined;
}

export async function registerStararcsDevice(
  panel: PanelClient,
  macAddress: string,
  token: string | null,
): Promise<string | undefined> {
  const reply = await panel.requestAuthed({
    path: "device/add",
    payload: { mac_address: macAddress, app_type: panel.appType },
    encrypted: true,
    responseMode: "encrypted",
    token,
  });
  return extractStararcsToken(reply);
}

// ---------- #9 legacy changeParentPin ----------

// No timeout on TV; a phone needs a limit (docs/decisions.md D-023).
const LEGACY_TIMEOUT_MS = 30_000;

/**
 * Q-legacy-endpoints: kept exactly as documented. Random panel order, retrying the others on
 * error. Returns false when every server failed or rejected it (the PIN stays saved locally).
 */
export async function changeParentPin(
  panelUrls: readonly string[],
  macAddress: string,
  pinCode: string,
  random: RandomSource = secureRandom,
): Promise<boolean> {
  const body = formEncode({ data: encryptRequest({ mac_address: macAddress, pin_code: pinCode }) });
  for (const base of shuffled(panelUrls, random)) {
    try {
      const response = await send({
        url: base + config.iboBackend.legacyPanelPaths.changeParentPin,
        method: "POST",
        headers: { "Content-Type": FORM_CONTENT_TYPE },
        body,
        timeoutMs: LEGACY_TIMEOUT_MS,
      });
      const reply = asObject(decryptResponse(tryParseJson(response.text)));
      if (str(reply.status) !== "error") return true;
    } catch {
      // next server
    }
  }
  return false;
}

// ---------- #10 legacy edit_playlist ----------

export interface ProviderAccountReport {
  playlistId: string;
  expirationDate: string | null;
  status: string;
  auth: string;
  fetchedAt: string;
}

/** Q-legacy-endpoints: plain form PUT with `Custom-Proxy-Mode: 1`, one random server, reply ignored. */
export async function reportPlaylistAccount(
  panelUrls: readonly string[],
  macAddress: string,
  report: ProviderAccountReport,
  random: RandomSource = secureRandom,
): Promise<void> {
  const base = panelUrls[random.int(panelUrls.length)];
  if (!base) return;
  try {
    await send({
      url: base + config.iboBackend.legacyPanelPaths.editPlaylist,
      method: "PUT",
      headers: { "Content-Type": FORM_CONTENT_TYPE, "Custom-Proxy-Mode": "1" },
      body: formEncode({
        mac_address: macAddress,
        id: report.playlistId,
        expiration_date: report.expirationDate,
        status: report.status,
        auth: report.auth,
        fetched_at: report.fetchedAt,
      }),
      timeoutMs: LEGACY_TIMEOUT_MS,
    });
  } catch {
    // Response ignored on TV (only logged).
  }
}
