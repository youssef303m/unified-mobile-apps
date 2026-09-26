// Source-agnostic content shapes (04-build/architecture.md "The content interface"). Every
// provider item is stored and read as a CatalogueItem; kind-specific extras sit in `data`.
import type { EpgProgramme } from "@/utils/epgTime";

export type { EpgProgramme };

export type ContentKind = "live" | "movie" | "series";
export type SourceType = "xtream" | "m3u" | "stalker";

export interface Category {
  category_id: string;
  category_name: string;
  parent_id: string;
}

export interface CatalogueItem {
  kind: ContentKind;
  /** stream_id (live, movies) or series_id. */
  item_id: string;
  name: string;
  icon: string;
  category_id: string;
  num?: number;
  rating?: number;
  /** Unix seconds: `added` for live and movies, `last_modified` for series. */
  added?: number;
  /** Xtream container_extension. */
  extension?: string;
  /** M3U: the item's own URL. */
  url?: string;
  /** Stalker: the create_link input. */
  cmd?: string;
  tv_archive: number;
  tv_archive_duration: number;
  /** Extra provider fields (plot, genre, Stalker series/storage ids, M3U seasons…). */
  data?: Record<string, unknown>;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface MovieInfo {
  name?: string;
  description?: string;
  cast?: string;
  director?: string;
  releaseDate?: string;
  duration?: string;
  genre?: string;
  rating?: string;
  age?: string;
  tmdbId?: string;
  backdrop?: string;
  youtubeTrailer?: string;
}

export interface Episode {
  /** Unique within the series (Q-behaviour-fixes #3: progress is keyed by this). */
  id: string;
  title: string;
  seasonNumber: number;
  episodeNumber: number;
  extension?: string;
  url?: string;
  cmd?: string;
  /** Stalker: the episode number sent as `series` to create_link. */
  series?: string;
  storageId?: string;
  durationSecs?: number;
  image?: string;
  plot?: string;
}

export interface Season {
  number: number;
  name: string;
  episodes: Episode[];
}

export interface SeriesInfo {
  info: MovieInfo;
  seasons: Season[];
}

export type PlayRequest =
  | { kind: "live"; item: CatalogueItem }
  | { kind: "movie"; item: CatalogueItem }
  | { kind: "episode"; series: CatalogueItem; episode: Episode };

export interface StreamTarget {
  url: string;
  headers?: Record<string, string>;
}

export interface SourceCapabilities {
  /** Catch-up / Replay (false for Stalker, Q-replay-stalker; false for M3U). */
  replay: boolean;
  /** The Home "Live Favourites" tile (false for Stalker, R-071). */
  liveFavorites: boolean;
  epg: boolean;
  /** Lists are fetched per category page instead of whole (Stalker). */
  paged: boolean;
  /** Direct file URLs exist for movies and episodes (downloads, N-03). */
  downloads: boolean;
  /** Search within the source's own data per kind (R-051 / Q-search-lod). */
  liveSearch: boolean;
}
