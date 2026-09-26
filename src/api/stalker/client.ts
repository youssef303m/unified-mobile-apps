// Stalker portal transport and auth (02-backend/stalker.md §2-3).
import { AuthError, NetworkError, ParseError, TimeoutError } from "../errors";
import { FORM_CONTENT_TYPE, formEncode, send, type HttpResponse } from "../http";
import { asObject, isObject, str, type JsonObject } from "../parse";
import { secureRandom, type RandomSource } from "../random";
import { readJson, type KeyValueStore } from "../store";

import {
  HW_VERSION,
  LOADER_PATHS,
  MAC_PATTERN,
  STB_PROFILES,
  normalizePortalUrl,
  portalIdentity,
  portalOrigin,
  profileOrder,
  quirksKey,
  type PortalIdentity,
  type StbProfileKey,
} from "./portal";

const TIMEOUT_MS = 15_000;
const KEEPALIVE_MS = 90_000;

type Params = Record<string, string | number>;

export interface StalkerProfile {
  status: 0 | 1;
  expiry: string;
  msg: string;
  expired: boolean;
  registered: boolean;
}

export interface ConnectResult {
  profile: StalkerProfile;
  /** The STB profile that worked (save it when it differs from the configured one). */
  workingProfile: StbProfileKey;
  portalUrl: string;
}

interface Quirks {
  loader?: string;
  preferred_method?: "GET" | "POST";
}

/** §3.3 mapProfile: status 0 and 1 both mean "OK". */
export function mapProfile(js: JsonObject, now: number = Date.now()): StalkerProfile {
  const status = [1, 0, "1", "0"].includes(js.status as number | string) ? 1 : 0;
  const expiry = str(js.phone) || str(js.end_date) || str(js.expire_date);
  const t = expiry ? Date.parse(expiry.replace(" ", "T")) : NaN;
  return {
    status,
    expiry,
    msg: str(js.msg),
    expired: !isNaN(t) && t < now,
    registered: js.id !== undefined && js.id !== null && Number(js.id) !== 0,
  };
}

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export interface StalkerClientOptions {
  portalUrl: string;
  macAddress: string;
  profile?: StbProfileKey;
  fallbackUrl?: string;
  store: KeyValueStore;
  random?: RandomSource;
}

export class StalkerClient {
  token: string | null = null;
  origin = "";
  loader = "";
  private identity?: PortalIdentity;
  private profileKey: StbProfileKey;
  private keepaliveTimer?: ReturnType<typeof setInterval>;
  private pendingConnect?: Promise<ConnectResult>;
  private readonly random: RandomSource;

  constructor(private readonly options: StalkerClientOptions) {
    this.profileKey = options.profile ?? "mag250";
    this.random = options.random ?? secureRandom;
  }

  get mac(): string {
    return this.options.macAddress.trim().toUpperCase();
  }

  get profile() {
    return STB_PROFILES[this.profileKey];
  }

  /** §2.4. Q-stream-headers: User-Agent and Cookie are sent (a native app can, unlike the TV). */
  headers(withAuth: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "*/*",
      "User-Agent": this.profile.userAgent,
      "X-User-Agent": this.profile.xUserAgent,
      Cookie: `PHPSESSID=null; timezone=UTC; mac=${encodeURIComponent(this.mac)}; stb_lang=English; language=en`,
    };
    if (withAuth && this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  /** Headers for the player's stream requests (Q-stream-headers). */
  streamHeaders(): Record<string, string> {
    const { "User-Agent": userAgent = "", Cookie: cookie = "" } = this.headers(false);
    return { "User-Agent": userAgent, Cookie: cookie };
  }

  private host(): string {
    return this.origin.replace(/^https?:\/\//i, "");
  }

  private quirks(): Quirks {
    return readJson<Quirks>(this.options.store, quirksKey(this.host())) ?? {};
  }

  private saveQuirks(quirks: Quirks): void {
    this.options.store.set(quirksKey(this.host()), JSON.stringify(quirks));
  }

  /** `_stbGet`: handshake and get_profile. Non-JSON → null. Errors: TIMEOUT or AUTH_FAILED. */
  private async stbGet(loader: string, params: Params, withAuth: boolean): Promise<unknown> {
    let response: HttpResponse;
    try {
      response = await send({
        url: `${loader}?${formEncode(params)}`,
        headers: this.headers(withAuth),
        timeoutMs: TIMEOUT_MS,
      });
    } catch (error) {
      if (error instanceof TimeoutError) throw error;
      throw new AuthError("Portal request failed", "unauthorized", 0, error);
    }
    if (!response.ok)
      throw new AuthError(`Portal HTTP ${response.status}`, "unauthorized", response.status);
    const body = parseBody(response.text);
    return isObject(body) ? body : null;
  }

  private async sendRequest(
    method: "GET" | "POST",
    params: Params,
    withAuth: boolean,
  ): Promise<HttpResponse> {
    const encoded = formEncode(params);
    try {
      return await send(
        method === "GET"
          ? {
              url: `${this.loader}?${encoded}`,
              headers: this.headers(withAuth),
              timeoutMs: TIMEOUT_MS,
            }
          : {
              url: this.loader,
              method: "POST",
              headers: { ...this.headers(withAuth), "Content-Type": FORM_CONTENT_TYPE },
              body: encoded,
              timeoutMs: TIMEOUT_MS,
            },
      );
    } catch (error) {
      if (error instanceof TimeoutError) throw error;
      throw new NetworkError("Portal unreachable", error);
    }
  }

  /** `_request` (§2.5): every call except handshake/get_profile. */
  async request(callParams: Params, withAuth = true): Promise<unknown> {
    const params: Params = {
      mac: this.mac,
      sn: this.mac.replace(/:/g, ""),
      JsHttpRequest: "1-xml",
    };
    if (withAuth && this.token) params.token = this.token;
    Object.assign(params, callParams);
    const method = this.quirks().preferred_method ?? "GET";
    let response = await this.sendRequest(method, params, withAuth);
    if (response.status === 405 && method === "GET") {
      this.saveQuirks({ ...this.quirks(), preferred_method: "POST" });
      response = await this.sendRequest("POST", params, withAuth);
    }
    if (!response.ok)
      throw new AuthError(`Portal HTTP ${response.status}`, "unauthorized", response.status);
    if (response.text === "" || response.text === "null") throw new ParseError("EMPTY_RESPONSE");
    const body = parseBody(response.text);
    const rotated = str(asObject(asObject(body).js).token);
    if (rotated) this.token = rotated;
    return body;
  }

  /** A content call: one re-handshake and retry when the token was rejected (401/403). */
  async call(params: Params): Promise<unknown> {
    try {
      return await this.request(params);
    } catch (error) {
      if (!(error instanceof AuthError) || (error.status !== 401 && error.status !== 403))
        throw error;
      this.token = null;
      await this.connect();
      return this.request(params);
    }
  }

  private async discoverLoader(): Promise<{ url: string; token: string | null }> {
    const cached = this.quirks().loader;
    const candidates = cached
      ? [cached, ...LOADER_PATHS.map((p) => this.origin + p)]
      : LOADER_PATHS.map((p) => this.origin + p);
    const handshake = {
      mac: this.mac,
      sn: this.mac.replace(/:/g, ""),
      action: "handshake",
      type: "stb",
      prehash: 0,
    };
    for (const url of [...new Set(candidates)]) {
      try {
        const body = await this.stbGet(url, handshake, false);
        if (body === null) continue;
        // Rewrites the quirks entry with the loader only (as on TV, stalker.md Notes).
        this.saveQuirks({ loader: url });
        const token = str(asObject(asObject(body).js).token);
        return { url, token: token || null };
      } catch {
        // next path
      }
    }
    throw new AuthError("No valid loader path found");
  }

  private async handshake(): Promise<string> {
    const body = await this.stbGet(
      this.loader,
      {
        mac: this.mac,
        sn: this.mac.replace(/:/g, ""),
        action: "handshake",
        type: "stb",
        prehash: 0,
      },
      false,
    );
    const token = str(asObject(asObject(body).js).token);
    if (!token) throw new AuthError("No token in handshake response");
    return token;
  }

  private async getProfile(): Promise<StalkerProfile> {
    const id = this.identity as PortalIdentity;
    const p = this.profile;
    const body = await this.stbGet(
      this.loader,
      {
        mac: id.mac,
        sn: id.sn,
        action: "get_profile",
        type: "stb",
        ver: p.ver,
        device_id: id.deviceId,
        device_id2: id.deviceId2,
        signature: id.signature,
        stb_type: p.stbType,
        not_valid_token: 0,
        num_banks: 1,
        hw_version: HW_VERSION,
      },
      true,
    );
    const js = asObject(body).js;
    if (!isObject(js)) throw new ParseError("EMPTY_RESPONSE");
    return mapProfile(js);
  }

  private async connectToUrl(url: string, profile: StbProfileKey): Promise<StalkerProfile> {
    const origin = portalOrigin(url);
    if (!origin) throw new ParseError("Invalid portal URL");
    if (!MAC_PATTERN.test(this.options.macAddress.trim()))
      throw new ParseError("Invalid MAC address");
    this.origin = origin;
    this.profileKey = profile;
    this.identity = portalIdentity(this.options.macAddress, this.random);
    const loader = await this.discoverLoader();
    this.loader = loader.url;
    this.token = loader.token ?? (await this.handshake());
    return this.getProfile();
  }

  /**
   * §3 connect: each URL (primary, then fallback) × each STB profile. The next profile is tried
   * only after AUTH_FAILED; other errors go straight to the fallback URL.
   */
  connect(includeFallback = true): Promise<ConnectResult> {
    this.pendingConnect ??= this.runConnect(includeFallback).finally(() => {
      this.pendingConnect = undefined;
    });
    return this.pendingConnect;
  }

  private async runConnect(includeFallback: boolean): Promise<ConnectResult> {
    const urls = [this.options.portalUrl];
    if (includeFallback && this.options.fallbackUrl) urls.push(this.options.fallbackUrl);
    let lastError: unknown = new AuthError("Portal connection failed");
    for (const url of urls) {
      for (const profile of profileOrder(this.options.profile ?? "mag250")) {
        try {
          const result = await this.connectToUrl(url, profile);
          return { profile: result, workingProfile: profile, portalUrl: normalizePortalUrl(url) };
        } catch (error) {
          lastError = error;
          if (!(error instanceof AuthError)) break;
        }
      }
    }
    throw lastError;
  }

  /** §3.5: watchdog every 90 s; a rejected token reconnects (no fallback URL). */
  startKeepalive(): void {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => void this.keepalive(), KEEPALIVE_MS);
  }

  async keepalive(): Promise<void> {
    if (!this.token) return;
    try {
      await this.request({ action: "get_events", type: "watchdog", init: "0" });
    } catch (error) {
      if (error instanceof AuthError) await this.connect(false).catch(() => undefined);
    }
  }

  stopKeepalive(): void {
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    this.keepaliveTimer = undefined;
  }
}
