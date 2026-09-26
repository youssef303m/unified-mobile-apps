// M3U parser (02-backend/m3u.md). It keeps the TV's classification rules (live / vod / series
// URL tests, the two parser modes decided by "tvg-" anywhere in the file, the "Uncategorized"
// rename, "Season NN" grouping), and fixes the lossy parts as m3u.md recommends
// (docs/decisions.md D-025): quotes are kept in names and URLs, CRLF is handled, values are
// trimmed, `key="value"` attributes are read with a real parser (commas and "=" inside values
// survive), the display name is everything after the attribute section, and directive lines
// (#EXTVLCOPT, #EXTGRP…) between #EXTINF and its URL no longer drop the entry.
//
// Incremental: feed text with `push()` (e.g. in chunks between yields) and call `finish()`.
import { CancelledError } from "../errors";

export type M3uKind = "live" | "vod" | "series";

export interface M3uItem {
  stream_id: string;
  name: string;
  stream_icon: string;
  url: string;
  num: number;
  category_id: string;
}

export interface M3uCategory {
  category_id: string;
  category_name: string;
}

export interface M3uEpisode {
  id: string;
  name: string;
  title: string;
  url: string;
}

export interface M3uSeason {
  name: string;
  episodes: M3uEpisode[];
}

export interface M3uSeries {
  series_id: string;
  name: string;
  cover: string;
  category_id: string;
  num: number;
  seasons: M3uSeason[];
}

export interface M3uResult {
  live: { categories: M3uCategory[]; items: M3uItem[] };
  vod: { categories: M3uCategory[]; items: M3uItem[] };
  series: { categories: M3uCategory[]; items: M3uSeries[] };
}

interface RawEntry {
  num: number;
  attrs: Record<string, string>;
  displayName: string;
  url: string;
}

const EXTINF = /^#EXTINF:\s*-?\d+/i;
const ATTRIBUTE = /([A-Za-z0-9_-]+)=(?:"([^"]*)"|'([^']*)'|([^\s,]*))/g;

/** Splits `#EXTINF:-1 attrs,Display Name` at the first comma outside quotes. */
function splitExtinf(line: string): { attrs: Record<string, string>; displayName: string } {
  const body = line.replace(EXTINF, "");
  let inQuote: string | null = null;
  let comma = -1;
  for (let i = 0; i < body.length; i++) {
    const c = body.charAt(i);
    if (inQuote) {
      if (c === inQuote) inQuote = null;
    } else if (c === '"' || c === "'") {
      inQuote = c;
    } else if (c === ",") {
      comma = i;
      break;
    }
  }
  const attrText = comma >= 0 ? body.slice(0, comma) : body;
  const attrs: Record<string, string> = {};
  for (const m of attrText.matchAll(ATTRIBUTE)) {
    const key = (m[1] ?? "").toLowerCase();
    attrs[key] = (m[2] ?? m[3] ?? m[4] ?? "").trim();
  }
  return { attrs, displayName: comma >= 0 ? body.slice(comma + 1).trim() : "" };
}

/** Attributed-mode type rules (m3u.md §2a step 3). */
export function classifyAttributed(url: string): M3uKind {
  let kind: M3uKind = "live";
  if (
    url.includes("/movie/") ||
    url.includes("vod") ||
    url.includes("=movie") ||
    url.includes("==movie==")
  ) {
    kind = "vod";
  }
  if (url.includes("/series/")) kind = "series";
  return kind;
}

/** Plain-mode type rules (§2b): no "vod" substring test. */
function classifyPlain(url: string): M3uKind {
  if (url.includes("/series/")) return "series";
  if (url.includes("/movie/")) return "vod";
  return "live";
}

const SEASON_TAG = /S[0-9]{2}/;
const SEASON_SPLIT = / S[0-9]{2}/;

/** parseSeries (m3u.md §3): items without " SNN" in the name are dropped. */
export function groupSeries(items: readonly M3uItem[]): M3uSeries[] {
  const map = new Map<string, M3uSeries & { seasonIndex: Map<string, M3uSeason> }>();
  for (const item of items) {
    const tag = SEASON_TAG.exec(item.name)?.[0];
    const pieces = item.name.split(SEASON_SPLIT);
    const rest = pieces[1];
    if (!tag || rest === undefined) continue;
    const seasonName = `Season ${tag.replace("S", "")}`;
    const seriesName = (pieces[0] ?? "").trim();
    const episodeName = rest.trim().replace("E", "");
    let entry = map.get(seriesName);
    if (!entry) {
      entry = {
        series_id: seriesName,
        name: seriesName,
        cover: item.stream_icon,
        category_id: item.category_id,
        num: map.size + 1,
        seasons: [],
        seasonIndex: new Map(),
      };
      map.set(seriesName, entry);
    }
    let season = entry.seasonIndex.get(seasonName);
    if (!season) {
      season = { name: seasonName, episodes: [] };
      entry.seasonIndex.set(seasonName, season);
      entry.seasons.push(season);
    }
    season.episodes.push({
      id: episodeName,
      name: episodeName,
      title: `Episode ${episodeName}`,
      url: item.url,
    });
  }
  return [...map.values()].map(({ seasonIndex: _unused, ...series }) => series);
}

export class M3uParser {
  private carry = "";
  private started = false;
  private hasTvg = false;
  private blockCount = 0;
  private pending: { num: number; attrs: Record<string, string>; displayName: string } | null =
    null;
  private readonly entries: RawEntry[] = [];
  private firstLineChecked = false;

  /** Lines seen so far (for progress). */
  linesRead = 0;

  push(chunk: string): void {
    const text = this.carry + chunk;
    const lines = text.split("\n");
    this.carry = lines.pop() ?? "";
    for (const line of lines) this.line(line);
  }

  private line(rawLine: string): void {
    this.linesRead++;
    let line = rawLine.replace(/\r$/, "");
    if (!this.firstLineChecked) {
      this.firstLineChecked = true;
      line = line.replace(/^﻿/, "").trimStart();
      this.started = line.startsWith("#EXTM3U");
    }
    if (!this.hasTvg && line.includes("tvg-")) this.hasTvg = true;
    const trimmed = line.trim();
    if (trimmed === "") return;
    if (EXTINF.test(trimmed)) {
      this.blockCount++;
      this.pending = { num: this.blockCount, ...splitExtinf(trimmed) };
      return;
    }
    if (trimmed.startsWith("#")) return;
    if (this.pending) {
      this.entries.push({ ...this.pending, url: trimmed });
      this.pending = null;
    }
  }

  /** False when the text does not start with #EXTM3U (the TV's "problem with your playlist"). */
  get isM3u(): boolean {
    return this.started;
  }

  finish(): M3uResult {
    if (this.carry) this.line(this.carry);
    this.carry = "";
    return this.hasTvg ? this.buildAttributed() : this.buildPlain();
  }

  private buildAttributed(): M3uResult {
    const buckets = { live: new Bucket(), vod: new Bucket(), series: new Bucket() };
    for (const e of this.entries) {
      if (!/https?:/.test(e.url)) continue;
      const kind = classifyAttributed(e.url);
      const name = e.attrs["tvg-name"]?.trim() || e.displayName;
      const group = e.attrs["group-title"];
      let category = "All";
      if (group !== undefined) category = group.trim() === "" ? "Uncategorized" : group.trim();
      buckets[kind].add({
        stream_id: e.attrs["tvg-id"]?.trim() || name,
        name,
        stream_icon: e.attrs["tvg-logo"] ?? "",
        url: e.url,
        num: e.num,
        category_id: category,
      });
    }
    for (const bucket of Object.values(buckets)) bucket.renameAll();
    return {
      live: buckets.live.result(),
      vod: buckets.vod.result(),
      series: { categories: buckets.series.categories, items: groupSeries(buckets.series.items) },
    };
  }

  private buildPlain(): M3uResult {
    const buckets = { live: new Bucket(), vod: new Bucket(), series: new Bucket() };
    this.entries.forEach((e, i) => {
      const name = e.displayName;
      buckets[classifyPlain(e.url)].add({
        stream_id: name,
        name,
        stream_icon: "",
        url: e.url,
        num: i + 1,
        category_id: "all",
        categoryName: "All",
      });
    });
    return {
      live: buckets.live.result(),
      vod: buckets.vod.result(),
      series: { categories: buckets.series.categories, items: groupSeries(buckets.series.items) },
    };
  }
}

class Bucket {
  readonly categories: M3uCategory[] = [];
  readonly items: M3uItem[] = [];
  private readonly seen = new Set<string>();

  add(item: M3uItem & { categoryName?: string }): void {
    const { categoryName, ...rest } = item;
    if (!this.seen.has(rest.category_id)) {
      this.seen.add(rest.category_id);
      this.categories.push({
        category_id: rest.category_id,
        category_name: categoryName ?? rest.category_id,
      });
    }
    this.items.push(rest);
  }

  /** §2c: with more than one category, "All" (no group-title) becomes "Uncategorized". */
  renameAll(): void {
    if (this.categories.length <= 1) return;
    const index = this.categories.findIndex((c) => c.category_id === "All");
    const all = this.categories[index];
    if (!all) return;
    // An empty group-title already created "Uncategorized": merge into it.
    if (this.seen.has("Uncategorized")) this.categories.splice(index, 1);
    else Object.assign(all, { category_id: "Uncategorized", category_name: "Uncategorized" });
    for (const item of this.items)
      if (item.category_id === "All") item.category_id = "Uncategorized";
  }

  result() {
    return { categories: this.categories, items: this.items };
  }
}

/** Parses a whole file in slices, yielding to the event loop between them. */
export async function parseM3uText(
  text: string,
  options: {
    sliceSize?: number;
    onProgress?: (fraction: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<{ isM3u: boolean; result: M3uResult }> {
  const sliceSize = options.sliceSize ?? 256 * 1024;
  const parser = new M3uParser();
  for (let offset = 0; offset < text.length; offset += sliceSize) {
    if (options.signal?.aborted) throw new CancelledError("M3U parsing cancelled");
    parser.push(text.slice(offset, offset + sliceSize));
    options.onProgress?.(Math.min(1, (offset + sliceSize) / text.length));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const result = parser.finish();
  return { isM3u: parser.isM3u, result };
}
