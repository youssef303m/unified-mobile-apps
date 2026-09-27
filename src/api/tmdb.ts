// TMDB v3 (02-backend/services.md "TMDB"). Used only to enrich items the playlist already has.
import { config } from "@/config";

import { getJson } from "./http";
import { asArray, asObject, num, optStr, str } from "./parse";

export type TmdbKind = "movie" | "tv";

export interface TmdbImage {
  file_path: string;
  width?: number;
}

export interface TmdbImages {
  tmdbId?: number;
  backdrops: TmdbImage[];
  logos: TmdbImage[];
  posters: TmdbImage[];
}

export interface TmdbCastMember {
  name: string;
  order: number;
  profile_path?: string;
}

export interface TmdbSearchResult {
  id: number;
  title: string;
  release_date?: string;
  overview?: string;
  /** `original_title` (movies) or `original_name` (series). */
  original?: string;
}

/** The key from `device_info.tmdb_api_key` replaces the built-in one for the session. */
let apiKey: string = config.tmdb.apiKey;
export function setTmdbApiKey(key: string | undefined): void {
  apiKey = key || config.tmdb.apiKey;
}

export function tmdbImageUrl(size: "w500" | "w1280" | "original", filePath: string): string {
  return `${config.tmdb.imageBase}${size}/${filePath.replace(/^\//, "")}`;
}

function parseImageList(value: unknown): TmdbImage[] {
  return asArray(value).flatMap((item) => {
    const o = asObject(item);
    const file_path = str(o.file_path);
    return file_path ? [{ file_path, width: num(o.width) }] : [];
  });
}

export function parseImages(value: unknown): TmdbImages {
  const o = asObject(value);
  return {
    tmdbId: num(o.tmdbId) ?? num(o.id),
    backdrops: parseImageList(o.backdrops),
    logos: parseImageList(o.logos),
    posters: parseImageList(o.posters),
  };
}

export async function tmdbImages(
  kind: TmdbKind,
  tmdbId: string,
  signal?: AbortSignal,
): Promise<TmdbImages> {
  return parseImages(
    await getJson(`${config.tmdb.apiBase}/${kind}/${tmdbId}/images?api_key=${apiKey}`, { signal }),
  );
}

export async function tmdbCredits(
  movieId: string,
  signal?: AbortSignal,
): Promise<TmdbCastMember[]> {
  const body = asObject(
    await getJson(`${config.tmdb.apiBase}/movie/${movieId}/credits?api_key=${apiKey}`, { signal }),
  );
  return asArray(body.cast).map((c) => {
    const o = asObject(c);
    return { name: str(o.name), order: num(o.order) ?? 0, profile_path: optStr(o.profile_path) };
  });
}

/** Title → query: "XX - " prefix and "(year)"/"(country)" suffixes removed, lowercased. */
export function cleanSearchQuery(title: string): string {
  return title
    .replace(/^[A-Z]{2,3}\s*-\s*/, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .trim()
    .toLowerCase();
}

/** The query is URL-encoded (the TV does not encode it). */
export async function tmdbSearch(
  kind: TmdbKind,
  title: string,
  signal?: AbortSignal,
): Promise<TmdbSearchResult[]> {
  const query = encodeURIComponent(cleanSearchQuery(title));
  const body = asObject(
    await getJson(`${config.tmdb.apiBase}/search/${kind}?api_key=${apiKey}&query=${query}`, {
      signal,
    }),
  );
  return asArray(body.results).map((r) => {
    const o = asObject(r);
    return {
      id: num(o.id) ?? 0,
      title: str(o.title) || str(o.name),
      release_date: optStr(o.release_date) ?? optStr(o.first_air_date),
      overview: optStr(o.overview),
      original: optStr(o.original_title) ?? optStr(o.original_name),
    };
  });
}
