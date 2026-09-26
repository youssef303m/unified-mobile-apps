// Xtream shapes (02-backend/xtream.md, data-models.md §1). Only the fields the app uses are
// typed; the rest of each item is kept in `raw`-free objects as the sync needs.

export interface XtreamPlaylist {
  url: string;
  username: string;
  password: string;
  origin_url?: string;
}

export interface XtreamAccount {
  /** "YYYY-MM-DD" of `exp_date`, or null for unlimited. */
  expireDate: string | null;
  /** Unix seconds as the provider sent it, or null. */
  expUnix: number | null;
  status: string;
  /** Minutes to add to wall-clock EPG times (xtream.md §8). */
  serverOffsetMinutes: number;
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: string;
}

export interface XtreamLiveStream {
  stream_id: string;
  name: string;
  stream_icon: string;
  num?: number;
  category_id: string;
  tv_archive: number;
  tv_archive_duration: number;
}

export interface XtreamVodStream {
  stream_id: string;
  name: string;
  stream_icon: string;
  rating?: string;
  added?: string;
  category_id: string;
  container_extension?: string;
  num?: number;
}

export interface XtreamSeries {
  series_id: string;
  name: string;
  cover: string;
  rating?: string;
  last_modified?: string;
  category_id: string;
  plot?: string;
  cast?: string;
  genre?: string;
  releaseDate?: string;
  backdrop_path?: string[];
  youtube_trailer?: string;
  num?: number;
}

export interface XtreamMovieInfo {
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

export interface XtreamEpisode {
  id: string;
  title: string;
  container_extension?: string;
  duration_secs?: number;
  movie_image?: string;
  plot?: string;
}

export interface XtreamSeason {
  season_number: number;
  name: string;
  episodes: XtreamEpisode[];
}

export interface XtreamSeriesInfo {
  info: XtreamMovieInfo;
  seasons: XtreamSeason[];
}

export interface XtreamListing {
  start: string;
  end: string;
  title: string;
  description: string;
  start_timestamp?: string;
  stop_timestamp?: string;
  has_archive?: number;
}
