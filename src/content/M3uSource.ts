// M3U playlists as a ContentSource (02-backend/m3u.md). The whole file is loaded once (M3U has
// no load on demand), then each kind is served from the parsed result. No EPG, no catch-up.
import { loadM3u } from "@/api/m3u/client";
import type { M3uItem, M3uResult, M3uSeries } from "@/api/m3u/parser";

import type { Catalogue, CatalogueOptions, ContentSource } from "./ContentSource";
import type {
  CatalogueItem,
  Category,
  ContentKind,
  EpgProgramme,
  Episode,
  MovieInfo,
  PlayRequest,
  Season,
  SeriesInfo,
  SourceCapabilities,
  StreamTarget,
} from "./types";

function toItem(kind: ContentKind, item: M3uItem): CatalogueItem {
  return {
    kind,
    item_id: item.stream_id,
    name: item.name,
    icon: item.stream_icon,
    category_id: item.category_id,
    num: item.num,
    url: item.url,
    tv_archive: 0,
    tv_archive_duration: 0,
  };
}

/** Seasons "Season 01" keep playlist order; episode ids are made unique per series (fix #3). */
function toSeasons(series: M3uSeries): Season[] {
  return series.seasons.map((season, index) => {
    const number = parseInt(season.name.replace(/\D/g, ""), 10) || index + 1;
    const episodes: Episode[] = season.episodes.map((e, i) => ({
      id: `${season.name}:${e.id}`,
      title: e.title,
      seasonNumber: number,
      episodeNumber: parseInt(e.id, 10) || i + 1,
      url: e.url,
    }));
    return { number, name: season.name, episodes };
  });
}

function seriesToItem(series: M3uSeries): CatalogueItem {
  return {
    kind: "series",
    item_id: series.series_id,
    name: series.name,
    icon: series.cover,
    category_id: series.category_id,
    num: series.num,
    tv_archive: 0,
    tv_archive_duration: 0,
    data: { seasons: toSeasons(series) },
  };
}

export class M3uSource implements ContentSource {
  readonly type = "m3u" as const;
  readonly capabilities: SourceCapabilities = {
    replay: false,
    liveFavorites: true,
    epg: false,
    paged: false,
    downloads: true,
    liveSearch: true,
  };
  private parsed?: Promise<M3uResult>;

  constructor(
    readonly id: string,
    readonly url: string,
  ) {}

  /** Downloads and parses the file once per session (R-025 validation inside loadM3u). */
  load(options: CatalogueOptions = {}): Promise<M3uResult> {
    this.parsed ??= loadM3u(this.url, options).catch((error: unknown) => {
      this.parsed = undefined;
      throw error;
    });
    return this.parsed;
  }

  async categories(kind: ContentKind): Promise<Category[]> {
    const result = await this.load();
    const section = kind === "live" ? result.live : kind === "movie" ? result.vod : result.series;
    return section.categories.map((c) => ({ ...c, parent_id: "0" }));
  }

  async catalogue(kind: ContentKind, options: CatalogueOptions = {}): Promise<Catalogue> {
    const result = await this.load(options);
    const categories = await this.categories(kind);
    const items =
      kind === "live"
        ? result.live.items.map((i) => toItem("live", i))
        : kind === "movie"
          ? result.vod.items.map((i) => toItem("movie", i))
          : result.series.items.map(seriesToItem);
    return { categories, items };
  }

  async movieInfo(): Promise<MovieInfo | undefined> {
    return undefined;
  }

  async seriesInfo(item: CatalogueItem): Promise<SeriesInfo | undefined> {
    const seasons = item.data?.seasons as Season[] | undefined;
    return seasons ? { info: { name: item.name }, seasons } : undefined;
  }

  async epg(): Promise<EpgProgramme[]> {
    return [];
  }

  async streamUrl(request: PlayRequest): Promise<StreamTarget> {
    const url = request.kind === "episode" ? request.episode.url : request.item.url;
    return { url: url ?? "" };
  }
}
