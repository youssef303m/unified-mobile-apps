// IBO agent + panel fixture servers (02-backend/ibo-api-reference.md examples, fake values).
import { config } from "@/config";

import {
  FIXTURE_PANEL_DOMAINS,
  M3U_URL,
  STALKER_MAC,
  STALKER_PORTAL_URL,
  XTREAM_PASS,
  XTREAM_URL,
  XTREAM_USER,
} from "./hosts";
import { scenario } from "./scenario";
import { decryptRequest, encryptResponse } from "./serverCrypto";
import { json, networkError, params, type FixtureRequest, type FixtureResponse } from "./types";

export const FIXTURE_TOKEN = "eyJhbGciOiJIUzI1NiJ9.fixture.sig";
export const FIXTURE_CAPTCHA_CODE = "x7fk2";
export const FIXTURE_RECAPTCHA_TOKEN = "c1f0e2a4b6d8";
export const FIXTURE_DEVICE_KEY = "482913";
const CAPTCHA_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="50"><text x="10" y="35">x7fk2</text></svg>';

const agentHosts = new Set(config.iboBackend.agentUrls.map((u) => new URL(u).host));
const panelHosts = new Set(FIXTURE_PANEL_DOMAINS);

export const fixturePlaylists = [
  {
    id: "65f1c0ffee1234567890abcd",
    playlist_name: "Fixture Xtream",
    url: XTREAM_URL,
    playlist_type: "xc",
    username: XTREAM_USER,
    password: XTREAM_PASS,
    is_protected: 0,
    pin: "",
  },
  {
    id: "65f1c0ffee1234567890abce",
    playlist_name: "Fixture M3U",
    url: M3U_URL,
    playlist_type: "general",
  },
  {
    id: "65f1c0ffee1234567890abcf",
    playlist_name: "Fixture Portal",
    playlist_type: "stalker",
    portal_name: "Fixture Portal",
    url: STALKER_PORTAL_URL,
    portal_address: STALKER_PORTAL_URL,
    portal_fallback_address: "",
    stalker_mac_address: STALKER_MAC,
  },
];

export const demoPlaylist = {
  id: "demo",
  playlist_name: "Demo",
  url: M3U_URL,
  playlist_type: "general",
};

function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export function deviceInfoReply(): Record<string, unknown> {
  const byState = {
    active: { mac_registered: true, expire_date: isoDate(180), is_trial: 2 },
    trial: { mac_registered: false, expire_date: isoDate(7), is_trial: 1 },
    expired: { mac_registered: true, expire_date: isoDate(-3), is_trial: 1 },
  }[scenario.account];
  return {
    ...byState,
    trial_days: 7,
    device_key: FIXTURE_DEVICE_KEY,
    ip_address: "203.0.113.42",
    parent_pin: "0000",
    themes: [
      { name: "Future", url: `https://${FIXTURE_PANEL_DOMAINS[0]}/images/upload/125984.png` },
    ],
    languages: [],
    notification: {},
    urls: scenario.demoOnly ? [demoPlaylist] : [demoPlaylist, ...fixturePlaylists],
  };
}

const encrypted = (value: unknown, status = 200) => json(encryptResponse(value), status);

function readPayload(request: FixtureRequest): Record<string, unknown> {
  const body = JSON.parse(request.body || "{}") as Record<string, unknown>;
  return typeof body.data === "string"
    ? (decryptRequest(body.data) as Record<string, unknown>)
    : body;
}

function bearerOk(request: FixtureRequest): boolean {
  return request.headers.authorization === `Bearer ${FIXTURE_TOKEN}`;
}

const uidMismatch = {
  status: "uid_mismatch_captcha",
  captcha: '<svg xmlns="http://www.w3.org/2000/svg"><text>K7MQ3X</text></svg>',
  captcha_token: "9a8b7c",
  message: "Device ID mismatch. Enter the code shown to verify ownership.",
};

function v4(request: FixtureRequest, path: string): FixtureResponse {
  const payload = readPayload(request);
  switch (path) {
    case "recaptcha":
      return json(
        scenario.alreadyVerified
          ? { status: "already_verified" }
          : { status: "success", captcha: CAPTCHA_SVG, token: FIXTURE_RECAPTCHA_TOKEN },
      );
    case "device_login": {
      if (scenario.uidMismatch && payload.uid_captcha_code === undefined)
        return encrypted(uidMismatch);
      const typed = payload.recaptcha_code;
      if (
        typed !== undefined &&
        (typed !== FIXTURE_CAPTCHA_CODE || payload.recaptcha_token !== FIXTURE_RECAPTCHA_TOKEN)
      ) {
        return encrypted({ status: "error", error_code: 401, message: "Invalid captcha" });
      }
      if (
        typed === undefined &&
        !scenario.alreadyVerified &&
        payload.uid_captcha_code === undefined
      ) {
        return encrypted({
          status: "error",
          error_code: 401,
          message: "Captcha verification required",
        });
      }
      return encrypted({ status: "success", token: FIXTURE_TOKEN });
    }
    case "device_info":
      if (!bearerOk(request))
        return encrypted({
          status: "error",
          error_code: 401,
          message: "Invalid device login token",
        });
      if (scenario.deviceUnknown)
        return encrypted({ status: "error", error_code: 404, message: "Device not found" });
      if (scenario.uidMismatch) return encrypted(uidMismatch);
      return encrypted(deviceInfoReply());
    case "manage/add_playlist":
    case "manage/update_playlist": {
      if (!bearerOk(request))
        return encrypted({
          status: "error",
          error_code: 401,
          message: "Invalid device login token",
        });
      const id = path.endsWith("add_playlist")
        ? "65f1c0ffee00000000000001"
        : String(payload.playlistId);
      return json({
        status: "success",
        playlist: {
          _id: id,
          playlist_name: payload.playListName,
          url: payload.playListURL,
          username: payload.username,
          password: payload.password,
          playlist_type: payload.playlist_type,
          is_protected: payload.is_protected,
          pin: "",
        },
      });
    }
    case "manage/delete_playlist":
      if (!bearerOk(request))
        return encrypted({
          status: "error",
          error_code: 401,
          message: "Invalid device login token",
        });
      return json({ status: "success" });
    case "device/add":
      if (!bearerOk(request))
        return encrypted({
          status: "error",
          error_code: 401,
          message: "Invalid device login token",
        });
      return encrypted({ Success: true, Response: { Device: { Token: "st_fixture_token" } } });
    default:
      return json({ status: "error", message: "Unknown endpoint" }, 404);
  }
}

export function iboServer(request: FixtureRequest): FixtureResponse | undefined {
  const { host, pathname } = request.url;
  if (agentHosts.has(host) && pathname.endsWith(config.iboBackend.agentPath)) {
    if (scenario.agentsDown) return networkError();
    decryptRequest(params(request).get("data") ?? "");
    return encrypted({ domains: FIXTURE_PANEL_DOMAINS, main_domain: "api.fixture.test" });
  }
  if (scenario.panelsDown.includes(host)) return networkError();
  if (!panelHosts.has(host)) return undefined;
  if (pathname === "/api/changeParentPin") {
    decryptRequest(params(request).get("data") ?? "");
    return encrypted({ status: "success" });
  }
  if (pathname === "/api/edit_playlist") return json({ status: "success" });
  const m = /^\/api\/([^/]+)\/v4\/(.+)$/.exec(pathname);
  return m?.[2] ? v4(request, m[2]) : undefined;
}
