// create_link handling (02-backend/stalker.md §4.7, §4.9). Links are short-lived: resolve them
// at play time (Q-behaviour-fixes #10: before every reconnect retry too).
import { ApiError } from "../errors";
import { asObject, str, type JsonObject } from "../parse";

import type { StalkerClient } from "./client";

export class StalkerLinkError extends ApiError {}

const PREFIX = /^(ffrt3|ffrt2|ffrt|ffmpeg|auto)\s+/i;
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i;

/** `_cleanCmd`. */
export function cleanCmd(value: string, mac: string): string {
  let s = value.trim().replace(/%mac%/gi, mac).replace(PREFIX, "");
  const m = /^(\S*:\/\/\S*)\s/.exec(s);
  if (m?.[1]) s = m[1];
  return s;
}

/** `_linkUrl`: the first absolute URL among the fields, else the first "/…" path on the origin. */
export function linkUrl(
  js: JsonObject,
  fields: readonly string[],
  mac: string,
  origin: string,
): string {
  const cleaned = fields.map((f) => cleanCmd(str(js[f]), mac)).filter(Boolean);
  const absolute = cleaned.find((v) => /^https?:\/\//i.test(v));
  if (absolute) return absolute;
  const path = cleaned.find((v) => v.startsWith("/"));
  return path ? origin + path : "";
}

function playToken(url: string): string | undefined {
  return /[?&]play_token=([^&]*)/.exec(url)?.[1];
}

function withPlayToken(url: string, token: string): string {
  if (/[?&]play_token=/.test(url)) return url.replace(/([?&]play_token=)[^&]*/, `$1${token}`);
  return `${url}${url.includes("?") ? "&" : "?"}play_token=${token}`;
}

/** `_repairMangledLink`. */
export function repairMangledLink(resolved: string, directCmd: string): string {
  if (!/^https?:\/\//i.test(directCmd) || LOCAL.test(directCmd)) return resolved;
  const path = resolved.replace(/^https?:\/\/[^/]+/i, "").split("?")[0] ?? "";
  if (!/\/[A-Za-z0-9.-]+:\d+(\/|$)/.test(path)) return resolved;
  const token = playToken(resolved);
  return token ? withPlayToken(directCmd, token) : directCmd;
}

const EMPTY_STREAM = /[?&]stream=(&|$)/;

function jsOf(body: unknown): JsonObject {
  return asObject(asObject(body).js);
}

const linkParams = (type: string, cmd: string, series: string, storage: string) => ({
  action: "create_link",
  type,
  cmd,
  series,
  forced_storage: storage,
  disable_ad: 0,
  download: 0,
});

export class StalkerLinks {
  constructor(private readonly client: StalkerClient) {}

  private link(js: JsonObject, fields: readonly string[]): string {
    return linkUrl(js, fields, this.client.mac, this.client.origin);
  }

  private async liveOnce(cmd: string): Promise<string> {
    const js = jsOf(await this.client.call(linkParams("itv", cmd, "", "")));
    const resolved = this.link(js, ["cmd", "url"]);
    if (!resolved) throw new StalkerLinkError("No live link");
    return resolved;
  }

  /** createLiveStreamUrl (§4.7 steps 1-6). */
  async live(cmd: string, fallbackId?: string): Promise<string> {
    const clean = cleanCmd(cmd, this.client.mac);
    try {
      const resolved = repairMangledLink(await this.liveOnce(cmd), clean);
      if (LOCAL.test(clean) && /^https?:\/\//i.test(resolved) && !LOCAL.test(resolved))
        return resolved;
      if (EMPTY_STREAM.test(resolved)) {
        const token = playToken(resolved);
        if (token && /[?&]stream=[^&]+/.test(clean)) return withPlayToken(clean, token);
        throw new StalkerLinkError("Empty stream in live link");
      }
      return resolved;
    } catch (error) {
      if (!fallbackId || fallbackId === cmd || fallbackId === clean) throw error;
      const retry = repairMangledLink(await this.liveOnce(fallbackId), clean);
      if (/^https?:\/\//i.test(retry) && !EMPTY_STREAM.test(retry)) return retry;
      throw error;
    }
  }

  /** createVODStreamUrl: `url` first. */
  async movie(cmd: string, series: string, storageId: string): Promise<string> {
    const js = jsOf(await this.client.call(linkParams("vod", cmd, series, storageId)));
    const resolved = this.link(js, ["url", "cmd"]);
    if (!resolved) throw new StalkerLinkError("No movie link");
    return repairMangledLink(resolved, cleanCmd(cmd, this.client.mac));
  }

  /** createSeriesStreamUrl, falling back to the VOD form. */
  async episode(cmd: string, episodeNumber: string, storageId: string): Promise<string> {
    try {
      const js = jsOf(await this.client.call(linkParams("series", cmd, episodeNumber, storageId)));
      const resolved = this.link(js, ["url", "cmd"]);
      if (resolved) return repairMangledLink(resolved, cleanCmd(cmd, this.client.mac));
    } catch {
      // fall back to the VOD form
    }
    return this.movie(cmd, episodeNumber, storageId);
  }

  /** createCatchupUrl (§4.9): the timeshift shape, then the tv_archive cascade. */
  async catchup(cmd: string, arcStart: number, arcStop: number, raw: JsonObject): Promise<string> {
    try {
      const js = jsOf(
        await this.client.call({
          ...linkParams("itv", cmd, "", ""),
          timeshift: 1,
          arc_start: arcStart,
          arc_stop: arcStop,
        }),
      );
      const url = this.link(js, ["cmd", "url"]);
      if (url) return url;
    } catch {
      // attempt 2
    }
    for (const attempt of catchupAttempts(cmd, arcStart, raw)) {
      const js = jsOf(
        await this.client.call(linkParams("tv_archive", attempt.cmd, attempt.series, "")),
      );
      const url = this.link(js, ["cmd", "url"]);
      if (url) return url;
      if (!/epg data not found|no cmd/i.test(str(js.error))) break;
    }
    throw new StalkerLinkError("No catch-up link");
  }
}

/** The ordered tv_archive attempts, empty series skipped, duplicates removed. */
export function catchupAttempts(cmd: string, arcStart: number, raw: JsonObject) {
  const realId = str(raw.real_id);
  const rawId = str(raw.id);
  const lastSeg = realId.split("_").pop() ?? "";
  const firstSeg = rawId.split("_")[0] ?? "";
  const realIdTs = /^\d{9,11}$/.test(lastSeg) ? lastSeg : "";
  const rawIdTs = /^\d{9,11}$/.test(firstSeg) ? firstSeg : "";
  const trail = cmd.endsWith("_");
  const start = String(arcStart);
  const list = [
    ...(rawId ? [{ cmd: `auto /media/${rawId}.mpg`, series: "" }] : []),
    { cmd: trail && realIdTs ? cmd + realIdTs : cmd, series: realIdTs },
    { cmd, series: realIdTs },
    { cmd: trail && rawIdTs ? cmd + rawIdTs : cmd, series: rawIdTs },
    { cmd, series: rawIdTs },
    { cmd: trail && start ? cmd + start : cmd, series: start },
    { cmd, series: start },
    { cmd, series: realId },
    { cmd: trail && realId ? cmd + realId : cmd, series: start || realId },
    { cmd, series: rawId },
  ];
  const seen = new Set<string>();
  return list.filter((a, i) => {
    // The reference_media_mpg attempt has an empty series by design.
    if (a.series === "" && !(i === 0 && rawId)) return false;
    const key = `${a.cmd}||${a.series}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
