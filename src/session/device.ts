// The V4 device flow (02-backend/device-and-auth.md §4.2): captcha verification, device_login and
// device_info, with the offline start from the cached reply (R-003, R-004, R-005). Platform-free:
// the storage, the panel client and the identity are injected, so Jest runs it on the fixtures.
import { generateUid } from "@/api/crypto";
import { AuthError, NetworkError } from "@/api/errors";
import {
  deviceInfo,
  deviceLogin,
  parseDeviceInfo,
  recaptcha,
  type CaptchaAnswer,
} from "@/api/ibo/client";
import type { PanelClient } from "@/api/ibo/panel";
import type { DeviceIdentity, DeviceInfo } from "@/api/ibo/types";
import type { KeyValueStore } from "@/api/store";
import { whenAllServersFail } from "@/content/rules/startup";
import { globalKeys } from "@/storage/keys";

export type CaptchaMode = "recaptcha" | "uid";

/** A TV message without a locale key (current-app-inventory.md §3), or the server's own text. */
export type VerifyError =
  { key: "enter_code" | "not_verified_yet" | "network" | "failed" } | { message: string };

export interface CaptchaChallenge {
  mode: CaptchaMode;
  /** The SVG markup the backend drew. */
  svg: string;
  token: string;
  /** uid mode: the server's explanation ("Device ID mismatch…"). */
  message?: string;
  error?: VerifyError;
}

export type DeviceOutcome =
  | { kind: "captcha"; challenge: CaptchaChallenge }
  | { kind: "server_failed" }
  | { kind: "account"; info: DeviceInfo; offline: boolean };

/** Boot status lines (loading_* keys, current-app-inventory.md §1). */
export type DeviceStep = "verifying_device" | "registering_device" | "account";

export interface DeviceFlowDeps {
  store: KeyValueStore;
  panel: PanelClient;
  macAddress: string;
  version: string;
  onStep?: (step: DeviceStep) => void;
}

const captcha = (challenge: CaptchaChallenge): DeviceOutcome => ({ kind: "captcha", challenge });
const SERVER_FAILED: DeviceOutcome = { kind: "server_failed" };

export class DeviceFlow {
  /** §4.1: a new u_id is only persisted once the backend accepts it. */
  private pendingUid: string | undefined;
  /** §4.3: one automatic re-verification per flow, so a broken token cannot loop. */
  private reverified = false;

  constructor(private readonly deps: DeviceFlowDeps) {}

  identity(): DeviceIdentity {
    const { store, macAddress, version } = this.deps;
    const stored = store.get(globalKeys.v4Uid);
    if (stored) return { macAddress, uid: stored, version };
    this.pendingUid ??= generateUid();
    return { macAddress, uid: this.pendingUid, version };
  }

  private acceptUid(): void {
    this.deps.store.set(globalKeys.v4Uid, this.identity().uid);
  }

  /** begin(): device info with a stored token, otherwise verification first. */
  start(): Promise<DeviceOutcome> {
    return this.deps.store.get(globalKeys.v4Token) ? this.fetchInfo() : this.getCaptcha();
  }

  /** getCaptcha(): anything but a captcha or "already verified" is the Server URLs failed screen. */
  async getCaptcha(): Promise<DeviceOutcome> {
    this.deps.onStep?.("verifying_device");
    let reply;
    try {
      reply = await recaptcha(this.deps.panel, this.deps.macAddress);
    } catch {
      return SERVER_FAILED;
    }
    if (reply.kind === "already_verified") return this.login({});
    if (reply.kind === "captcha")
      return captcha({ mode: "recaptcha", svg: reply.captchaSvg, token: reply.token });
    return SERVER_FAILED;
  }

  /** Verify: the typed code (uppercased in uid mode by the client). */
  submit(challenge: CaptchaChallenge, code: string): Promise<DeviceOutcome> {
    const typed = code.trim();
    if (!typed) return Promise.resolve(captcha({ ...challenge, error: { key: "enter_code" } }));
    const answer: CaptchaAnswer =
      challenge.mode === "recaptcha"
        ? { recaptchaCode: typed, recaptchaToken: challenge.token }
        : { uidCaptchaCode: typed, uidCaptchaToken: challenge.token };
    return this.login(answer, challenge);
  }

  /** New Code: a fresh captcha; in uid mode, device_login again without the old token. */
  newCode(challenge: CaptchaChallenge): Promise<DeviceOutcome> {
    return challenge.mode === "recaptcha" ? this.getCaptcha() : this.login({}, challenge);
  }

  /** "I've verified — Continue": the website verification happened, log in without codes. */
  continueAfterWebVerify(challenge: CaptchaChallenge): Promise<DeviceOutcome> {
    return this.login({}, challenge, true);
  }

  private async login(
    answer: CaptchaAnswer,
    current?: CaptchaChallenge,
    fromContinue = false,
  ): Promise<DeviceOutcome> {
    this.deps.onStep?.("registering_device");
    let reply;
    try {
      reply = await deviceLogin(this.deps.panel, this.identity(), answer);
    } catch {
      return current ? captcha({ ...current, error: { key: "network" } }) : SERVER_FAILED;
    }
    switch (reply.kind) {
      case "success":
        this.acceptUid();
        this.deps.store.set(globalKeys.v4Token, reply.token);
        return this.fetchInfo();
      case "uid_captcha":
        return captcha({
          mode: "uid",
          svg: reply.captchaSvg,
          token: reply.captchaToken,
          message: reply.message || undefined,
        });
      case "captcha_error": {
        if (fromContinue && current)
          return captcha({ ...current, error: { key: "not_verified_yet" } });
        // A wrong code: show the message with a new captcha.
        const next = await this.getCaptcha();
        if (next.kind !== "captcha" || !reply.message) return next;
        return captcha({ ...next.challenge, error: { message: reply.message } });
      }
      case "error":
        if (!current) return SERVER_FAILED;
        return captcha({
          ...current,
          error: reply.message ? { message: reply.message } : { key: "failed" },
        });
    }
  }

  /** fetchDeviceInfo(): the account reply, cached as `api_data` for offline starts. */
  async fetchInfo(): Promise<DeviceOutcome> {
    this.deps.onStep?.("account");
    const token = this.deps.store.get(globalKeys.v4Token) ?? null;
    let result;
    try {
      result = await deviceInfo(this.deps.panel, this.identity(), token);
    } catch (error) {
      if (error instanceof AuthError) return this.reverify();
      if (error instanceof NetworkError) return this.offlineStart();
      throw error;
    }
    switch (result.kind) {
      case "uid_captcha":
        return captcha({
          mode: "uid",
          svg: result.captchaSvg,
          token: result.captchaToken,
          message: result.message || undefined,
        });
      case "not_found":
        return this.reverify();
      case "error":
        return SERVER_FAILED;
      case "ok":
        this.acceptUid();
        this.deps.store.set(globalKeys.apiData, JSON.stringify(result.info.raw));
        return { kind: "account", info: result.info, offline: false };
    }
  }

  /** R-003: an invalid token or an unknown device forgets the token and verifies again. */
  private reverify(): Promise<DeviceOutcome> {
    this.deps.store.remove(globalKeys.v4Token);
    if (this.reverified) return Promise.resolve(SERVER_FAILED);
    this.reverified = true;
    return this.getCaptcha();
  }

  /** R-004: no server answered; start from the cached account if there is one. */
  private offlineStart(): DeviceOutcome {
    const cached = this.deps.store.get(globalKeys.apiData);
    if (whenAllServersFail(cached) === "server_urls_failed" || !cached) return SERVER_FAILED;
    try {
      return { kind: "account", info: parseDeviceInfo(JSON.parse(cached)), offline: true };
    } catch {
      return SERVER_FAILED;
    }
  }
}
