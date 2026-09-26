// Stalker content API and mapping (02-backend/stalker.md §4.1-4.6, §4.8, §4.11).
import {
  formatYmdHm,
  formatYmdHms,
  getLocalChannelTime,
  parseWallClock,
  type EpgProgramme,
} from "@/utils/epgTime";

import { asArray, asObject, isObject, str, type JsonObject } from "../parse";

import type { StalkerClient } from "./client";
import { absUrl } from "./portal";

export type StalkerKind = "live" | "movie" | "series";

export interface StalkerCategory {
  category_id: string;
  category_name: string;
  parent_id: "0";
}

export interface StalkerChannel {
  stream_id: string;
  name: string;
  stream_icon: string;
  num: string | number;
  category_id: string;
  cmd: string;
  tv_archive: 0 | 1;
  tv_archive_duration: number;
  epg_channel_id: string;
}

export interface StalkerMovie {
  stream_id: string;
  name: string;
  stream_icon: string;
  stream_type: "movie";
  category_id: string;
  rating: string;
  plot: string;
  cmd: string;
  series: unknown;
  storage_id: string;
  added: string;
  tmdb_id: string;
  director: string;
  cast: string;
  genre: string;
  year: string;
  duration: string;
}

export interface StalkerSeries {
  series_id: string;
  name: string;
  cover: string;
  stream_type: "series";
  category_id: string;
  stalker_category_id: string;
  year: string;
  plot: string;
  genre: string;
  cast: string;
  director: string;
  rating: string;
  added: string;
  tmdb_id: string;
}

export interface StalkerEpisode {
  id: string;
  title: string;
  name: string;
  cmd: string;
  series: string;
  storage_id: string;
  season: string;
  episode_num: number;
  container_extension: "mp4";
}

export interface StalkerSeason {
  name: string;
  season_number: string;
  stalker_season_id: string;
  raw_cmd: string;
  raw_series: number[];
  storage_id: string;
  episodes: StalkerEpisode[];
}

export interface Page<T> {
  data: T[];
  total_items: number;
}

/** §4.1 pageResult. */
export function pageResult(body: unknown): Page<unknown> {
  const js = asObject(body).js;
  if (js === undefined || js === null) return { data: [], total_items: 0 };
  const items = Array.isArray(js) ? js : asArray(asObject(js).data);
  let total = parseInt(str(asObject(js).total_items), 10);
  if (isNaN(total)) total = items.length;
  return { data: items, total_items: total };
}

const ALL_NAMES = new Set(["all", "all channels", "all movies", "all series"]);

/** §4.2: "All" entries skipped; `censored` is not used (adult detection is by name). */
export function mapCategories(body: unknown): StalkerCategory[] {
  return asArray(asObject(body).js).flatMap((item) => {
    const c = asObject(item);
    const name = str(c.title) || str(c.name);
    if (ALL_NAMES.has(name.trim().toLowerCase())) return [];
    return [{ category_id: str(c.id), category_name: name, parent_id: "0" as const }];
  });
}

/** Q-behaviour-fixes #6: a string "0" (or "", 0) means no archive. */
function archiveFlag(ch: JsonObject): boolean {
  for (const key of ["archive", "tv_archive", "has_archive", "mark_archive"]) {
    const v = ch[key];
    if (v !== undefined && v !== null && v !== "" && v !== 0 && v !== "0" && v !== false)
      return true;
  }
  return false;
}

function archiveDays(ch: JsonObject): number {
  if (ch.tv_archive_duration) return parseInt(str(ch.tv_archive_duration), 10) || 0;
  if (isObject(ch.archive_range)) {
    const range = ch.archive_range;
    if (range.days) return parseInt(str(range.days), 10) || 0;
    if (range.to && range.from) {
      const from = new Date(str(range.from)).getTime();
      const to = new Date(str(range.to)).getTime();
      if (to > from) return Math.ceil((to - from) / 86_400_000);
    }
    return 0;
  }
  if (ch.archive_days) return parseInt(str(ch.archive_days), 10) || 0;
  return 0;
}

/** §4.3 mapLiveChannel. */
export function mapLiveChannel(ch: JsonObject, catId: string, origin: string): StalkerChannel {
  const hasArchive = archiveFlag(ch);
  let days = archiveDays(ch);
  if (hasArchive && days === 0) days = 7;
  return {
    stream_id: str(ch.id),
    name: str(ch.name),
    stream_icon: absUrl(str(ch.logo) || str(ch.screenshot_uri), origin),
    num: str(ch.number) || str(ch.cmd_id) || 0,
    category_id: catId,
    cmd: str(ch.cmd),
    tv_archive: hasArchive ? 1 : 0,
    tv_archive_duration: days,
    epg_channel_id: str(ch.epg_id),
  };
}

/** §4.4 mapVodMovie. */
export function mapVodMovie(m: JsonObject, catId: string, origin: string): StalkerMovie {
  const time = str(m.time);
  return {
    stream_id: str(m.id),
    name: str(m.name),
    stream_icon: absUrl(str(m.screenshot_uri), origin),
    stream_type: "movie",
    category_id: catId,
    rating: str(m.rating_imdb),
    plot: str(m.description),
    cmd: str(m.cmd),
    series: m.series ?? "",
    storage_id: str(m.storage_id),
    added: str(m.added),
    tmdb_id: str(m.tmdb_id),
    director: str(m.director),
    cast: str(m.actors),
    genre: str(m.genres_str),
    year: str(m.year),
    duration: time ? `${time} min` : "",
  };
}

/** §4.5 mapSeriesItem. */
export function mapSeriesItem(s: JsonObject, catId: string, origin: string): StalkerSeries {
  return {
    series_id: str(s.id),
    name: str(s.name),
    cover: absUrl(str(s.screenshot_uri), origin),
    stream_type: "series",
    category_id: catId,
    stalker_category_id: catId,
    year: str(s.year),
    plot: str(s.description),
    genre: str(s.genres_str),
    cast: str(s.actors),
    director: str(s.director),
    rating: str(s.rating_imdb),
    added: str(s.added) || str(s.last_modified),
    tmdb_id: str(s.tmdb_id),
  };
}

/** §4.4: the app's vod_sort setting → the portal's sort. */
export function portalSort(vodSort: string | undefined): string {
  if (vodSort === "a_z") return "name";
  if (vodSort === "rating") return "rating";
  return "added";
}

/** §4.6: seasons from page 1; episodes built locally from `series`. */
export function mapSeasons(body: unknown): StalkerSeason[] {
  return pageResult(body)
    .data.map((item, index) => {
      const s = asObject(item);
      const n = str(s.series_num) || String(index + 1);
      const season: StalkerSeason = {
        name: str(s.name) || `Season ${n}`,
        season_number: n,
        stalker_season_id: str(s.id),
        raw_cmd: str(s.cmd),
        raw_series: asArray(s.series)
          .map((e) => Number(e))
          .filter((e) => Number.isFinite(e)),
        storage_id: str(s.storage_id),
        episodes: [],
      };
      season.episodes = season.raw_series.map((epNum) => ({
        id: `${season.stalker_season_id}:${epNum}`,
        title: `Episode ${epNum}`,
        name: `Episode ${epNum}`,
        cmd: season.raw_cmd,
        series: String(epNum),
        storage_id: season.storage_id,
        season: season.season_number,
        episode_num: epNum,
        container_extension: "mp4" as const,
      }));
      return season;
    })
    .sort((a, b) => parseInt(a.season_number, 10) - parseInt(b.season_number, 10));
}

function stalkerProgramme(item: JsonObject): EpgProgramme {
  const time = str(item.time);
  const timeTo = str(item.time_to);
  let start = "";
  let stop = "";
  if (time && timeTo) {
    start = time;
    stop = timeTo;
  } else {
    const s = getLocalChannelTime(str(item.start_timestamp), 0);
    const e = getLocalChannelTime(str(item.stop_timestamp), 0);
    if (s && e) {
      start = formatYmdHms(s);
      stop = formatYmdHms(e);
    }
  }
  // Stalker titles are plain text: never base64-decode them.
  return {
    start,
    stop,
    title: str(item.name) || str(item.title),
    description: str(item.descr) || str(item.description),
  };
}

function epgItems(body: unknown): unknown[] {
  const js = asObject(body).js;
  return Array.isArray(js) ? js : asArray(asObject(js).data);
}

export class StalkerContent {
  constructor(private readonly client: StalkerClient) {}

  async categories(kind: StalkerKind): Promise<StalkerCategory[]> {
    const params =
      kind === "live"
        ? { action: "get_genres", type: "itv" }
        : { action: "get_categories", type: kind === "movie" ? "vod" : "series" };
    return mapCategories(await this.client.call(params));
  }

  async liveChannels(catId: string, page: number): Promise<Page<StalkerChannel>> {
    const result = pageResult(
      await this.client.call({
        action: "get_ordered_list",
        type: "itv",
        genre: catId,
        force_ch_link_check: 0,
        fav: 0,
        sortby: "number",
        hd: 0,
        page_offset: 0,
        p: page,
      }),
    );
    return {
      ...result,
      data: result.data.map((c) => mapLiveChannel(asObject(c), catId, this.client.origin)),
    };
  }

  async movies(catId: string, page: number, vodSort?: string): Promise<Page<StalkerMovie>> {
    const result = pageResult(
      await this.client.call({
        action: "get_ordered_list",
        type: "vod",
        category: catId,
        page_offset: 0,
        p: page,
        search: "",
        sort: portalSort(vodSort),
        fav: 0,
        hd: 0,
      }),
    );
    return {
      ...result,
      data: result.data.map((m) => mapVodMovie(asObject(m), catId, this.client.origin)),
    };
  }

  async series(catId: string, page: number, vodSort?: string): Promise<Page<StalkerSeries>> {
    const result = pageResult(
      await this.client.call({
        action: "get_ordered_list",
        type: "series",
        category: catId,
        page_offset: 0,
        p: page,
        sort: portalSort(vodSort),
        search: "",
        fav: 0,
      }),
    );
    return {
      ...result,
      data: result.data.map((s) => mapSeriesItem(asObject(s), catId, this.client.origin)),
    };
  }

  async seasons(series: { series_id: string; stalker_category_id?: string; category_id?: string }) {
    return mapSeasons(
      await this.client.call({
        action: "get_ordered_list",
        type: "series",
        movie_id: series.series_id,
        season_id: 0,
        episode_id: 0,
        category: series.stalker_category_id || series.category_id || "0",
        page_offset: 0,
        p: 1,
        sort: "added",
        fav: 0,
      }),
    );
  }

  /** §4.11: page 1 of the portal's VOD or series search. No live search. */
  async search(kind: "movie" | "series", keyword: string) {
    const params: Record<string, string | number> =
      kind === "movie"
        ? {
            action: "get_ordered_list",
            type: "vod",
            category: "*",
            page_offset: 0,
            p: 1,
            search: keyword,
            sort: "added",
            fav: 0,
            hd: 0,
          }
        : {
            action: "get_ordered_list",
            type: "series",
            category: "*",
            page_offset: 0,
            p: 1,
            search: keyword,
            sort: "added",
            fav: 0,
          };
    const { data } = pageResult(await this.client.call(params));
    const origin = this.client.origin;
    return data.map((item) => {
      const o = asObject(item);
      const catId = str(o.category) || "0";
      return kind === "movie" ? mapVodMovie(o, catId, origin) : mapSeriesItem(o, catId, origin);
    });
  }

  /** §4.8 short EPG (now/next), size=2. */
  async shortEpg(streamId: string): Promise<EpgProgramme[]> {
    const body = await this.client.call({
      action: "get_short_epg",
      type: "itv",
      ch_id: streamId,
      size: 2,
    });
    return epgItems(body).map((i) => stalkerProgramme(asObject(i)));
  }

  /**
   * epg-and-catchup.md §3.2 (loadStalkerCatchupEPG): ended programmes with valid times. Titles
   * stay plain text (the TV base64-encodes them only to reuse its Xtream screen).
   */
  async catchupProgrammes(streamId: string, now: Date = new Date()): Promise<EpgProgramme[]> {
    const toDate = (v: unknown) => {
      const s = str(v);
      return /^\d+$/.test(s) ? new Date(Number(s) * 1000) : parseWallClock(s);
    };
    return (await this.simpleDataTable(streamId, 100)).flatMap((item) => {
      const start = toDate(item.time);
      const stop = toDate(item.time_to);
      if (!start || !stop || stop.getTime() > now.getTime()) return [];
      return [
        {
          start: formatYmdHm(start),
          stop: formatYmdHm(stop),
          title: str(item.name),
          description: str(item.descr),
          raw: item,
        },
      ];
    });
  }

  /** §4.8 full table (100 for catch-up, 400 for the guide); raw items. */
  async simpleDataTable(streamId: string, size: 100 | 400): Promise<JsonObject[]> {
    const body = await this.client.call({
      action: "get_simple_data_table",
      type: "itv",
      ch_id: streamId,
      size,
    });
    return epgItems(body).map((i) => asObject(i));
  }
}
