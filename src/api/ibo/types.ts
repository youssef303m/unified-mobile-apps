// IBO backend shapes (02-backend/ibo-api-reference.md, data-models.md §1).

export type PlaylistType = "xc" | "general" | "stalker" | "code";

export interface Playlist {
  id: string;
  playlist_name?: string;
  playlist_type: PlaylistType;
  url: string;
  username?: string;
  password?: string;
  origin_type?: string;
  origin_url?: string;
  is_protected?: number;
  pin?: string;
  expiration_date?: string;
  status?: string;
  auth?: string;
  fetched_at?: string;
  // Stalker
  portal_name?: string;
  portal_address?: string;
  portal_fallback_address?: string;
  stalker_mac_address?: string;
  stalker_mac_mode?: "prefix_001A79" | "prefix_001C1D";
  stalker_stb_profile?: string;
  expiry?: string;
  is_created?: boolean;
}

export interface Theme {
  name: string;
  url: string;
}

export interface DeviceInfo {
  mac_registered: boolean;
  expire_date: string;
  is_trial?: number;
  trial_days?: number;
  device_key?: string;
  ip_address?: string;
  parent_pin?: string;
  tmdb_api_key?: string;
  themes: Theme[];
  urls: Playlist[];
  /** The whole decoded reply, cached as `api_data` for offline starts. */
  raw: Record<string, unknown>;
}

export type RecaptchaResult =
  | { kind: "already_verified" }
  | { kind: "captcha"; captchaSvg: string; token: string }
  | { kind: "error" };

export type DeviceLoginResult =
  | { kind: "success"; token: string }
  | { kind: "uid_captcha"; captchaSvg: string; captchaToken: string; message: string }
  /** error_code 401 or a message about the captcha: show it and get a new captcha. */
  | { kind: "captcha_error"; message: string }
  | { kind: "error"; message?: string };

export type DeviceInfoResult =
  | { kind: "ok"; info: DeviceInfo }
  | { kind: "uid_captcha"; captchaSvg: string; captchaToken: string; message: string }
  /** error + 404: the device is unknown; forget the token and verify again. */
  | { kind: "not_found" }
  | { kind: "error"; message?: string };

export interface DeviceIdentity {
  macAddress: string;
  uid: string;
  version: string;
}

export type SavePlaylistResult =
  { kind: "success"; playlist: Record<string, unknown> } | { kind: "error"; message?: string };
