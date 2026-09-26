// V4 request transport with server failover (02-backend/overview.md §4.3) and the response
// decoding rules of ibo-api-reference.md ("Common rules for V4 calls").
import { config } from "@/config";

import { decryptResponse, encryptRequest, isEnvelope } from "../crypto";
import { AllServersFailedError, AuthError } from "../errors";
import { send, tryParseJson, type HttpResponse } from "../http";
import { asObject, num, str } from "../parse";
import type { KeyValueStore } from "../store";

import { buildFailoverBases, MANUAL_URL_KEY } from "./servers";

export type ResponseMode = "encrypted" | "plain" | "plainWithEncryptedErrors";

export interface V4Call {
  path: string;
  payload: Record<string, unknown>;
  encrypted: boolean;
  responseMode: ResponseMode;
  /** Bearer token for protected calls (null = protected but missing). */
  token?: string | null;
}

export interface PanelOptions {
  panelUrls: readonly string[];
  store: KeyValueStore;
  appType?: string;
  /** "Server busy, trying another (n/N)..." */
  onServerBusy?: (attempt: number, total: number) => void;
}

/** A transport-level failure of one server: move on to the next (§4.3). */
class TryNextServer extends Error {}

const INVALID_TOKEN = "Invalid device login token";
const AUTH_MESSAGE = /token is required|invalid device login token|token does not match/i;

function decryptOr(body: unknown, errorCode: number): unknown {
  try {
    return decryptResponse(body);
  } catch {
    return { status: "error", error_code: errorCode, message: INVALID_TOKEN };
  }
}

function decodeAnswer(body: unknown, mode: ResponseMode, httpOk: boolean): unknown {
  // HTTP error with a JSON body: the server's answer, decrypted if it is an envelope.
  if (!httpOk) return isEnvelope(body) ? decryptOr(body, 403) : body;
  switch (mode) {
    case "plain":
      return body;
    case "plainWithEncryptedErrors":
      return isEnvelope(body) ? decryptOr(body, 401) : body;
    case "encrypted":
      try {
        return decryptResponse(body);
      } catch {
        // A success body that fails to decode is a transport failure (§4.3).
        throw new TryNextServer();
      }
  }
}

function interpret(response: HttpResponse, mode: ResponseMode): unknown {
  const body = tryParseJson(response.text);
  // An HTTP error without a JSON body is a transport failure; with one, it is the answer.
  if (body === undefined) throw new TryNextServer();
  return decodeAnswer(body, mode, response.ok);
}

/** §4.3 of device-and-auth.md: does this reply mean the session token is no longer valid? */
export function isAuthFailure(status: number, answer: unknown): boolean {
  if (status === 401 || status === 403) return true;
  const obj = asObject(answer);
  const code = num(obj.error_code);
  if (code === 401 || code === 403) return true;
  return str(obj.status) === "error" && AUTH_MESSAGE.test(str(obj.message));
}

export class PanelClient {
  readonly appType: string;
  /** The first base that answered, without "/api" (used for background images). */
  workingWebsiteHost?: string;

  constructor(private readonly options: PanelOptions) {
    this.appType = options.appType ?? config.app.mobileAppType; // Q-app-type
  }

  private bases(): string[] {
    return buildFailoverBases(this.options.panelUrls, this.options.store.get(MANUAL_URL_KEY));
  }

  private async tryBase(base: string, call: V4Call): Promise<{ status: number; answer: unknown }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (call.token) headers.Authorization = `Bearer ${call.token}`;
    const body = call.encrypted ? { data: encryptRequest(call.payload) } : call.payload;
    let response: HttpResponse;
    try {
      response = await send({
        url: `${base}/${this.appType}/v4/${call.path}`,
        method: "POST",
        headers,
        body: JSON.stringify(body),
        timeoutMs: config.iboBackend.v4TimeoutMs,
      });
    } catch {
      throw new TryNextServer();
    }
    return { status: response.status, answer: interpret(response, call.responseMode) };
  }

  /** Walks every base in order; returns the first server's answer. */
  async request(call: V4Call): Promise<{ status: number; answer: unknown }> {
    const { store } = this.options;
    const manualUrl = store.get(MANUAL_URL_KEY);
    const bases = this.bases();
    for (const [index, base] of bases.entries()) {
      if (index > 0) this.options.onServerBusy?.(index + 1, bases.length);
      try {
        const result = await this.tryBase(base, call);
        this.workingWebsiteHost = base.replace("/api", "");
        if (manualUrl && base === buildFailoverBases([], manualUrl)[0])
          store.set(MANUAL_URL_KEY, manualUrl);
        return result;
      } catch (error) {
        if (!(error instanceof TryNextServer)) throw error;
      }
    }
    if (manualUrl) store.remove(MANUAL_URL_KEY);
    throw new AllServersFailedError("Every panel server failed");
  }

  /** A protected call: throws AuthError when the reply means the token is invalid (§4.3). */
  async requestAuthed(call: V4Call): Promise<unknown> {
    if (!call.token) throw new AuthError("No device login token", "token");
    const { status, answer } = await this.request(call);
    if (isAuthFailure(status, answer)) throw new AuthError(INVALID_TOKEN, "token", status);
    return answer;
  }
}
