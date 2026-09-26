// fetch wrapper (04-build/architecture.md): timeouts through AbortController, error mapping,
// redacted dev logging, and a swappable transport so the "use fixtures" mode can answer every
// request locally (04-build/testing.md §1).
//
// `send` only throws for transport problems (NetworkError, TimeoutError, CancelledError). An HTTP
// error status is returned as a response, because several protocols treat error bodies as answers
// (IBO V4 JSON errors, Stalker 405, Stararcs 422). Use `expectOk` to turn a status into an error.
import {
  AuthError,
  CancelledError,
  NetworkError,
  ParseError,
  ServerError,
  TimeoutError,
} from "./errors";
import { logRequest } from "./log";

export type HttpMethod = "GET" | "POST" | "PUT";

export interface HttpRequest {
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: string;
  /** Milliseconds; 0 disables the timeout. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface HttpResponse {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  text: string;
}

export type Transport = (request: HttpRequest & { method: HttpMethod }) => Promise<HttpResponse>;

export const DEFAULT_TIMEOUT_MS = 15_000;
// Catalogue downloads (Xtream lists, M3U files) have no timeout on TV. A phone needs one, so
// they get a generous limit instead (docs/decisions.md D-023).
export const LARGE_DOWNLOAD_TIMEOUT_MS = 120_000;

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

export const fetchTransport: Transport = async (request) => {
  const controller = new AbortController();
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timedOut = false;
  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : undefined;
  const onCallerAbort = () => controller.abort();
  request.signal?.addEventListener("abort", onCallerAbort);
  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      headers: headersToRecord(response.headers),
      text,
    };
  } catch (error) {
    if (timedOut) throw new TimeoutError(`Timed out after ${timeoutMs} ms`, error);
    if (request.signal?.aborted) throw new CancelledError("Request cancelled", error);
    throw new NetworkError("Network request failed", error);
  } finally {
    if (timer) clearTimeout(timer);
    request.signal?.removeEventListener("abort", onCallerAbort);
  }
};

let transport: Transport = fetchTransport;

export function setTransport(next: Transport): void {
  transport = next;
}

export function resetTransport(): void {
  transport = fetchTransport;
}

export async function send(request: HttpRequest): Promise<HttpResponse> {
  const method = request.method ?? "GET";
  if (request.signal?.aborted) throw new CancelledError("Request cancelled");
  const started = Date.now();
  try {
    const response = await transport({ ...request, method });
    logRequest(method, request.url, `${response.status} ${Date.now() - started}ms`);
    return response;
  } catch (error) {
    logRequest(method, request.url, `failed: ${error instanceof Error ? error.name : "error"}`);
    throw error;
  }
}

export function expectOk(response: HttpResponse): HttpResponse {
  if (response.ok) return response;
  if (response.status === 401 || response.status === 403) {
    throw new AuthError(`HTTP ${response.status}`, "unauthorized", response.status);
  }
  throw new ServerError(`HTTP ${response.status}`, response.status);
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new ParseError("Response is not valid JSON", error);
  }
}

/** Parses JSON without throwing; undefined when the text is not JSON. */
export function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export async function getJson(url: string, init: Omit<HttpRequest, "url"> = {}): Promise<unknown> {
  const response = expectOk(await send({ ...init, url }));
  return parseJson(response.text);
}

type FormValue = string | number | boolean | null | undefined;

/**
 * jQuery `$.param` encoding, which the TV app uses for form bodies and query strings:
 * encodeURIComponent on keys and values, `%20` written as `+`, null/undefined as "".
 */
export function formEncode(fields: Record<string, FormValue>): string {
  return Object.entries(fields)
    .map(([key, value]) => {
      const text = value === null || value === undefined ? "" : String(value);
      return `${encodeURIComponent(key)}=${encodeURIComponent(text)}`;
    })
    .join("&")
    .replace(/%20/g, "+");
}

export const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded; charset=UTF-8";
