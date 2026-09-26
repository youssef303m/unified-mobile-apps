// E. Content loading and caching (01-product/business-rules.md R-050…R-058).
import type { KeyValueStore } from "@/api/store";
import { secureRandom, shuffled, type RandomSource } from "@/api/random";
import { globalKeys } from "@/storage/keys";

import type { CatalogueItem, ContentKind, SourceType } from "../types";

// ---------- R-050 ----------

/** R-050: the sections downloaded at login. Load on demand (default) → none; Stalker → none. */
export function sectionsAtLogin(type: SourceType, loadOnDemand: boolean): ContentKind[] {
  if (type === "stalker") return [];
  if (type === "m3u") return ["live", "movie", "series"]; // the whole file is read at login
  return loadOnDemand ? [] : ["live", "movie", "series"];
}

// ---------- R-051 (Q-search-lod) ----------

/**
 * R-051 as changed by Q-search-lod: search is always shown and searches what is synced. For
 * Stalker, movies and series use the portal's search and live search is hidden.
 */
export function searchScope(type: SourceType): { kinds: ContentKind[]; portalSearch: boolean } {
  return type === "stalker"
    ? { kinds: ["movie", "series"], portalSearch: true }
    : { kinds: ["live", "movie", "series"], portalSearch: false };
}

// ---------- R-053 ----------

export type VirtualRowId =
  "all" | "recent" | "favourite" | "top_rated" | "newly_added" | "recently_modified";

export type Row =
  | { type: "virtual"; id: VirtualRowId }
  | { type: "custom"; id: string; name: string; icon: string }
  | { type: "category"; id: string; name: string; isAdult: boolean };

export interface RowInput {
  kind: ContentKind;
  source: SourceType;
  categories: readonly { category_id: string; category_name: string; is_adult: boolean }[];
  customRows?: readonly { id: string; name: string; icon: string }[];
  hidden?: readonly string[];
}

/**
 * R-053: virtual rows first (Search All, Recent, Favourites), custom rows after Favourites,
 * then Top Rated / Newly (Recently) Added for movies and series, then provider categories
 * (Uncategorized last). Stalker has no Search All and no Top Rated / Added rows. Hidden rows
 * are left out (data-models.md §3; Search All is never hideable).
 */
export function buildRows({
  kind,
  source,
  categories,
  customRows = [],
  hidden = [],
}: RowInput): Row[] {
  const rows: Row[] = [];
  if (source !== "stalker") rows.push({ type: "virtual", id: "all" });
  rows.push({ type: "virtual", id: "recent" }, { type: "virtual", id: "favourite" });
  rows.push(...customRows.map((c) => ({ type: "custom" as const, ...c })));
  if (kind !== "live" && source !== "stalker") {
    rows.push(
      { type: "virtual", id: "top_rated" },
      { type: "virtual", id: kind === "movie" ? "newly_added" : "recently_modified" },
    );
  }
  rows.push(
    ...categories.map((c) => ({
      type: "category" as const,
      id: c.category_id,
      name: c.category_name,
      isAdult: c.is_adult,
    })),
  );
  const hiddenSet = new Set(hidden);
  return rows.filter((r) => (r.type === "virtual" && r.id === "all") || !hiddenSet.has(r.id));
}

// ---------- R-054 ----------

export const NEW_WINDOW_SECONDS = 15 * 86_400;

/** R-054: added (movies) / last_modified (series) within the last 15 days. */
export function isNewlyAdded(added: number | undefined, nowSeconds: number): boolean {
  return added !== undefined && nowSeconds - added <= NEW_WINDOW_SECONDS;
}

// ---------- R-055 ----------

export const TOP_RATED_COUNT = 10;
export const TOP_RATED_SHUFFLE_MIN = 20;

/**
 * R-055: the top 10 by rating; when more than 10 share the highest rating, 10 of them in random
 * order. The shuffle button appears when 20 or more share it.
 */
export function pickTopRated(
  top: readonly CatalogueItem[],
  pool: readonly CatalogueItem[],
  random: RandomSource = secureRandom,
): { items: CatalogueItem[]; canShuffle: boolean } {
  if (pool.length > TOP_RATED_COUNT) {
    return {
      items: shuffled(pool, random).slice(0, TOP_RATED_COUNT),
      canShuffle: pool.length >= TOP_RATED_SHUFFLE_MIN,
    };
  }
  return { items: top.slice(0, TOP_RATED_COUNT), canShuffle: false };
}

// ---------- R-057 ----------

export const MOVIE_INFO_CACHE_MAX = 100;

type InfoCache = Record<string, unknown> & { host_url?: string };

/**
 * R-057 / R-041: provider movie/series info, cached under `saved-movie-info` (max 100 keys;
 * when full, the second key is dropped to keep `host_url`). Cleared on a different host.
 */
export class MovieInfoCache {
  constructor(
    private readonly store: KeyValueStore,
    private readonly hostUrl: string,
  ) {}

  private read(): InfoCache {
    try {
      const cache = JSON.parse(this.store.get(globalKeys.savedMovieInfo) ?? "{}") as InfoCache;
      return cache.host_url === this.hostUrl ? cache : { host_url: this.hostUrl };
    } catch {
      return { host_url: this.hostUrl };
    }
  }

  get<T>(kind: "movie" | "series", id: string): T | undefined {
    const entry = this.read()[`${kind === "movie" ? "vod" : "series"}${id}`] as
      { info?: T } | undefined;
    return entry?.info;
  }

  set(kind: "movie" | "series", id: string, info: unknown): void {
    const key = `${kind === "movie" ? "vod" : "series"}${id}`;
    let cache = this.read();
    const keys = Object.keys(cache);
    if (!(key in cache) && keys.length >= MOVIE_INFO_CACHE_MAX) {
      const second = keys[1];
      cache = Object.fromEntries(Object.entries(cache).filter(([k]) => k !== second));
    }
    this.store.set(
      globalKeys.savedMovieInfo,
      JSON.stringify({ ...cache, [key]: { info }, host_url: this.hostUrl }),
    );
  }
}

// ---------- R-058 ----------

/**
 * R-058: the category opened first on Live: the first one with channels (Xtream/M3U), or the
 * first real portal category (Stalker).
 */
export function firstLiveCategory(
  source: SourceType,
  categories: readonly { category_id: string; item_count: number }[],
): string | undefined {
  if (source === "stalker")
    return categories.find((c) => c.category_id !== "*" && c.category_id !== "0")?.category_id;
  return categories.find((c) => c.item_count > 0)?.category_id;
}
