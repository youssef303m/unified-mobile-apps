// Xtream Codes player_api.php client (02-backend/xtream.md). The login → M3U fallback
// (Q-behaviour-fixes #8) and the load modes belong to the content layer (M2).
import {
  decodeBase64Title,
  formatYmdHm,
  getLocalChannelTime,
  serverOffsetMinutes,
  type EpgProgramme,
} from "@/utils/epgTime";

import { AuthError, CancelledError, ParseError } from "../errors";
import { expectOk, LARGE_DOWNLOAD_TIMEOUT_MS, parseJson, send } from "../http";
import { asArray, asObject, isObject, num, optStr, str, type JsonObject } from "../parse";

import type {
  XtreamAccount,
  XtreamCategory,
  XtreamEpisode,
  XtreamListing,
  XtreamLiveStream,
  XtreamMovieInfo,
  XtreamPlaylist,
  XtreamSeason,
  XtreamSeries,
  XtreamSeriesInfo,
  XtreamVodStream,
} from "./types";
import { playerApiUrl } from "./urls";

const LOGIN_TIMEOUT_MS = 15_000;

async function getJson(url: string, timeoutMs: number, signal?: AbortSignal): Promise<unknown> {
  const response = expectOk(
    await send({ url, headers: { Accept: "application/json" }, timeoutMs, signal }),
  );
  return parseJson(response.text);
}

/** `null`/`"null"`/missing category → "undefined" (Uncategorized). */
function categoryId(value: unknown): string {
  const s = str(value);
  return s === "" || s === "null" ? "undefined" : s;
}

function expireDate(expUnix: number | null): string | null {
  if (expUnix === null) return null;
  const d = new Date(expUnix * 1000);
  return formatYmdHm(d).slice(0, 10);
}

/** §2 decision logic. Throws AuthError for rejected or unusable accounts. */
export function parseAccount(body: unknown): XtreamAccount {
  if (!isObject(body)) throw new ParseError("Xtream login reply is not an object");
  const server = asObject(body.server_info);
  const offset = isObject(body.server_info)
    ? serverOffsetMinutes(str(server.time_now), num(server.timestamp_now) ?? NaN)
    : 0;
  if (!isObject(body.user_info)) throw new ParseError("Xtream login reply has no user_info");
  const user = body.user_info;
  const status = str(user.status);
  // Loose equality on TV: "0" counts as 0.
  if (num(user.auth) === 0) throw new AuthError("Xtream login rejected", "provider_auth");
  if (status === "Expired") throw new AuthError("Xtream account expired", "provider_expired");
  if (status === "Banned") throw new AuthError("Xtream account banned", "provider_banned");
  if (status === "Disabled") throw new AuthError("Xtream account disabled", "provider_disabled");
  const expUnix =
    user.exp_date === null || user.exp_date === undefined ? null : (num(user.exp_date) ?? null);
  return {
    expireDate: expireDate(expUnix),
    expUnix,
    status: status || "Unknown",
    serverOffsetMinutes: offset,
  };
}

function parseCategories(body: unknown): XtreamCategory[] {
  if (!Array.isArray(body)) throw new ParseError("Expected a category array");
  return body.map((c) => {
    const o = asObject(c);
    return {
      category_id: str(o.category_id),
      category_name: str(o.category_name),
      parent_id: str(o.parent_id, "0"),
    };
  });
}

function parseLive(o: JsonObject): XtreamLiveStream {
  return {
    stream_id: str(o.stream_id),
    name: str(o.name),
    stream_icon: str(o.stream_icon),
    num: num(o.num),
    category_id: categoryId(o.category_id),
    tv_archive: num(o.tv_archive) ?? 0,
    tv_archive_duration: num(o.tv_archive_duration) ?? 0,
  };
}

function parseVod(o: JsonObject): XtreamVodStream {
  return {
    stream_id: str(o.stream_id),
    name: str(o.name),
    stream_icon: str(o.stream_icon),
    rating: optStr(o.rating),
    added: optStr(o.added),
    category_id: categoryId(o.category_id),
    container_extension: optStr(o.container_extension),
    num: num(o.num),
  };
}

function stringList(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map((v) => str(v)).filter(Boolean);
  const s = optStr(value);
  return s ? [s] : undefined;
}

function parseSeriesItem(o: JsonObject): XtreamSeries {
  return {
    series_id: str(o.series_id),
    name: str(o.name),
    cover: str(o.cover),
    rating: optStr(o.rating),
    last_modified: optStr(o.last_modified),
    category_id: categoryId(o.category_id),
    plot: optStr(o.plot),
    cast: optStr(o.cast),
    genre: optStr(o.genre),
    releaseDate: optStr(o.releaseDate),
    backdrop_path: stringList(o.backdrop_path),
    youtube_trailer: optStr(o.youtube_trailer),
    num: num(o.num),
  };
}

function parseList<T>(body: unknown, parse: (o: JsonObject) => T): T[] {
  if (!Array.isArray(body)) throw new ParseError("Expected a stream array");
  return body.map((item) => parse(asObject(item)));
}

/** get_vod_info / get_series_info `info` (xtream.md §4). */
export function parseMovieInfo(value: unknown): XtreamMovieInfo {
  const i = asObject(value);
  return {
    name: optStr(i.name),
    description: optStr(i.description) ?? optStr(i.plot),
    cast: optStr(i.cast),
    director: optStr(i.director),
    releaseDate: optStr(i.releasedate) ?? optStr(i.releaseDate),
    duration: optStr(i.duration),
    genre: optStr(i.genre),
    rating: optStr(i.rating),
    age: optStr(i.age),
    tmdbId: optStr(i.tmdb_id) ?? optStr(i.tmdb),
    backdrop: stringList(i.backdrop_path)?.[0] ?? optStr(i.movie_image),
    youtubeTrailer: optStr(i.youtube_trailer),
  };
}

function parseEpisode(value: unknown, index: number): XtreamEpisode {
  const e = asObject(value);
  const info = asObject(e.info);
  return {
    id: str(e.id),
    title: str(e.title) || `Episode ${index + 1}`,
    container_extension: optStr(e.container_extension),
    duration_secs: num(info.duration_secs),
    movie_image: optStr(info.movie_image),
    plot: optStr(info.plot),
  };
}

/** Seasons from the `episodes` keys only (xtream.md §5 step 3-4). */
export function normalizeSeasons(episodes: unknown): XtreamSeason[] {
  const map: Record<string, unknown[]> = {};
  if (Array.isArray(episodes)) {
    episodes.forEach((e, i) => {
      if (Array.isArray(e)) map[String(i + 1)] = e;
    });
  } else {
    for (const [key, value] of Object.entries(asObject(episodes))) map[key] = asArray(value);
  }
  const keys = Object.keys(map).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    return a.localeCompare(b);
  });
  const used = new Set<number>();
  let fallback = 1;
  const seasons: XtreamSeason[] = [];
  for (const key of keys) {
    let n = parseInt(key, 10);
    if (isNaN(n)) {
      while (used.has(fallback)) fallback++;
      n = fallback++;
    }
    used.add(n);
    seasons.push({
      season_number: n,
      name: `Season ${n}`,
      episodes: (map[key] ?? []).map(parseEpisode),
    });
  }
  return seasons
    .filter((s) => s.episodes.length > 0)
    .sort((a, b) => a.season_number - b.season_number);
}

function parseListings(body: unknown): XtreamListing[] | undefined {
  const o = asObject(body);
  if (!Array.isArray(o.epg_listings)) return undefined;
  return o.epg_listings.map((item) => {
    const l = asObject(item);
    return {
      start: str(l.start),
      end: str(l.end),
      title: str(l.title),
      description: str(l.description),
      start_timestamp: optStr(l.start_timestamp),
      stop_timestamp: optStr(l.stop_timestamp),
      has_archive: num(l.has_archive),
    };
  });
}

function toProgramme(l: XtreamListing, offset: number, decode: boolean): EpgProgramme | undefined {
  const start = getLocalChannelTime(l.start || l.start_timestamp || "", offset);
  const stop = getLocalChannelTime(l.end || l.stop_timestamp || "", offset);
  if (!start || !stop) return undefined;
  return {
    start: formatYmdHm(start),
    stop: formatYmdHm(stop),
    title: decode ? decodeBase64Title(l.title) : l.title,
    description: decode ? decodeBase64Title(l.description) : l.description,
  };
}

export class XtreamClient {
  constructor(readonly playlist: XtreamPlaylist) {}

  /** §2: login / account info. */
  async account(signal?: AbortSignal): Promise<XtreamAccount> {
    return parseAccount(await getJson(playerApiUrl(this.playlist), LOGIN_TIMEOUT_MS, signal));
  }

  private action(
    action: string,
    extra: Record<string, string | number> = {},
    signal?: AbortSignal,
  ) {
    return getJson(playerApiUrl(this.playlist, action, extra), LARGE_DOWNLOAD_TIMEOUT_MS, signal);
  }

  async liveCategories(signal?: AbortSignal) {
    return parseCategories(await this.action("get_live_categories", {}, signal));
  }
  async liveStreams(signal?: AbortSignal) {
    return parseList(await this.action("get_live_streams", {}, signal), parseLive);
  }
  async vodCategories(signal?: AbortSignal) {
    return parseCategories(await this.action("get_vod_categories", {}, signal));
  }
  async vodStreams(signal?: AbortSignal) {
    return parseList(await this.action("get_vod_streams", {}, signal), parseVod);
  }
  async seriesCategories(signal?: AbortSignal) {
    return parseCategories(await this.action("get_series_categories", {}, signal));
  }
  async series(signal?: AbortSignal) {
    return parseList(await this.action("get_series", {}, signal), parseSeriesItem);
  }

  /** §4: only `info` is read; empty info → undefined. */
  async vodInfo(vodId: string, signal?: AbortSignal): Promise<XtreamMovieInfo | undefined> {
    const body = asObject(await this.action("get_vod_info", { vod_id: vodId }, signal));
    return isObject(body.info) && Object.keys(body.info).length > 0
      ? parseMovieInfo(body.info)
      : undefined;
  }

  /** §5: undefined when there are no seasons ("No seasons available"). */
  async seriesInfo(seriesId: string, signal?: AbortSignal): Promise<XtreamSeriesInfo | undefined> {
    const body = asObject(await this.action("get_series_info", { series_id: seriesId }, signal));
    const hasEpisodes =
      Boolean(body.episodes) &&
      (asArray(body.seasons).length > 0 ||
        Object.keys(asObject(body.episodes)).length > 0 ||
        asArray(body.episodes).length > 0);
    if (!hasEpisodes) return undefined;
    const seasons = normalizeSeasons(body.episodes);
    return { info: parseMovieInfo(body.info), seasons };
  }

  /** epg-and-catchup.md §2: now/next listings, decoded; no listings or an error → []. */
  async shortEpg(streamId: string, offset: number, signal?: AbortSignal): Promise<EpgProgramme[]> {
    try {
      const listings = parseListings(
        await this.action("get_short_epg", { stream_id: streamId, limit: 30 }, signal),
      );
      return (listings ?? []).flatMap((l) => toProgramme(l, offset, true) ?? []);
    } catch (error) {
      if (error instanceof CancelledError) throw error;
      return [];
    }
  }

  /** get_simple_data_table raw listings (catch-up list and EPG guide). */
  async simpleDataTable(
    streamId: string,
    signal?: AbortSignal,
  ): Promise<XtreamListing[] | undefined> {
    return parseListings(
      await this.action("get_simple_data_table", { stream_id: streamId }, signal),
    );
  }

  /**
   * §3.2 catch-up list: programmes with an archive. Q-behaviour-fixes #5: the description is
   * kept (and decoded here with the title), so the catch-up list can show it.
   */
  async catchupProgrammes(
    streamId: string,
    offset: number,
    signal?: AbortSignal,
  ): Promise<EpgProgramme[]> {
    const listings = await this.simpleDataTable(streamId, signal);
    if (!listings) throw new ParseError("No epg_listings in the catch-up reply");
    return listings
      .filter((l) => (l.has_archive ?? 0) !== 0)
      .flatMap((l) => toProgramme(l, offset, true) ?? []);
  }
}
