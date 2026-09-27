// Finding external subtitles for a video (01-product/player.md §5.3): the TMDB id (known, from
// the provider's info, or a TMDB search with the TV's matching rules), then the ibosub list,
// grouped by language (the first file of each), sorted by name with the app language on top.
// The lookup runs once per video, when the subtitle sheet first opens. Any failure means "No
// subtitles found"; the colour and size settings still work.
import { ibosubContent, ibosubList, type IbosubList, type IbosubQuery } from "@/api/ibosub";
import { cleanSearchQuery, type TmdbKind, type TmdbSearchResult } from "@/api/tmdb";

import { languageCode, languageName } from "../languages";

export interface TmdbLookup {
  kind: TmdbKind;
  /** Already known (the item, or the provider's movie or series info). */
  tmdbId?: string;
  /** The title to search with (the original name first, when the provider gives one). */
  name: string;
  /** Movies: the provider's release date, "YYYY-MM-DD…". */
  releaseDate?: string;
  /** Series: the provider's plot. */
  plot?: string;
}

export type TmdbSearch = (kind: TmdbKind, name: string) => Promise<TmdbSearchResult[]>;

/** §5.3 step 1. Undefined when nothing matches (or searching is not allowed). */
export async function resolveTmdbId(
  lookup: TmdbLookup,
  search: TmdbSearch | undefined,
): Promise<string | undefined> {
  if (lookup.tmdbId) return lookup.tmdbId;
  if (!search) return undefined;
  const cleaned = cleanSearchQuery(lookup.name);
  if (!cleaned) return undefined;
  const results = await search(lookup.kind, lookup.name);
  if (results.length === 1) return String(results[0]?.id);
  if (results.length < 2) return undefined;
  if (lookup.kind === "movie") {
    const date = lookup.releaseDate?.slice(0, 10);
    const byDate = date ? results.find((r) => r.release_date === date) : undefined;
    if (byDate) return String(byDate.id);
    const contained = results.filter((r) => r.title && cleaned.includes(r.title.toLowerCase()));
    return contained.length === 1 ? String(contained[0]?.id) : undefined;
  }
  const named = results.filter(
    (r) => r.title.toLowerCase() === cleaned || (r.original ?? "").toLowerCase() === cleaned,
  );
  if (named.length === 1) return String(named[0]?.id);
  const plot = lookup.plot?.trim();
  const byPlot = plot ? results.find((r) => r.overview?.trim() === plot) : undefined;
  return byPlot ? String(byPlot.id) : undefined;
}

export interface SubtitleLanguage {
  /** ISO 639-1 (or the raw value when unknown). */
  code: string;
  label: string;
  fileId: string;
}

/** Languages grouped (first file per language), sorted by label, the app language first. */
export function groupLanguages(list: IbosubList, uiLanguage: string): SubtitleLanguage[] {
  const seen = new Map<string, SubtitleLanguage>();
  for (const file of list.files) {
    const code = languageCode(file.language) ?? file.language.toLowerCase();
    if (!code || seen.has(code)) continue;
    seen.set(code, {
      code,
      label: languageName(code, uiLanguage) ?? file.language,
      fileId: file.fileId,
    });
  }
  const sorted = [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  const mine = sorted.findIndex((l) => l.code === languageCode(uiLanguage));
  if (mine > 0) sorted.unshift(...sorted.splice(mine, 1));
  return sorted;
}

export interface SubtitleSource {
  languages: SubtitleLanguage[];
  /** The SRT text of one language (cached per video). */
  load(language: SubtitleLanguage, signal?: AbortSignal): Promise<string>;
}

export interface SubtitleRequest {
  tmdb: TmdbLookup;
  /** Episodes: the season and episode numbers (§5.3 step 2 fallbacks applied by the caller). */
  episode?: { seasonNumber: number; episodeNumber: number; episodeTmdbId?: string };
}

/** The whole lookup; `undefined` when there is nothing (the sheet says "No subtitles found"). */
export async function findSubtitles(
  request: SubtitleRequest,
  options: { search?: TmdbSearch; uiLanguage: string; signal?: AbortSignal },
): Promise<SubtitleSource | undefined> {
  const tmdbId = await resolveTmdbId(request.tmdb, options.search);
  let query: IbosubQuery;
  if (request.episode) {
    if (!tmdbId && !request.episode.episodeTmdbId) return undefined;
    query = {
      kind: "episode",
      seriesTmdbId: tmdbId,
      episodeTmdbId: request.episode.episodeTmdbId,
      seasonNumber: request.episode.seasonNumber,
      episodeNumber: request.episode.episodeNumber,
    };
  } else {
    if (!tmdbId) return undefined;
    query = { kind: "movie", tmdbId };
  }
  const list = await ibosubList(query, options.signal);
  const languages = groupLanguages(list, options.uiLanguage);
  if (languages.length === 0) return undefined;
  const cache = new Map<string, string>(Object.entries(list.srtMap));
  return {
    languages,
    async load(language, signal) {
      const cached = cache.get(language.fileId);
      if (cached !== undefined) return cached;
      const content = await ibosubContent(list.movieListId, language.fileId, signal);
      cache.set(language.fileId, content);
      return content;
    },
  };
}
