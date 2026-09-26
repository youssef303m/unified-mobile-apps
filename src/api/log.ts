// Development-only request logging. Stream URLs contain Xtream credentials and portal MACs
// (AGENTS.md security rules), so URLs are redacted, and nothing is logged in release builds.

const SECRET_PARAMS = /([?&](?:username|password|token|play_token|mac|sn|identifier|d)=)[^&#]*/gi;
// Xtream stream paths: /live|movie|series/<user>/<pass>/<id>.<ext>
const STREAM_PATH = /\/(live|movie|series)\/[^/]+\/[^/]+\//gi;
const MAC = /\b([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g;

export function redactUrl(url: string): string {
  return url
    .replace(SECRET_PARAMS, "$1***")
    .replace(STREAM_PATH, "/$1/***/***/")
    .replace(MAC, "**:**:**:**:**:**");
}

const enabled = typeof __DEV__ !== "undefined" ? __DEV__ : false;

export function logRequest(method: string, url: string, detail: string): void {
  if (!enabled) return;
  console.debug(`[api] ${method} ${redactUrl(url)} ${detail}`);
}
