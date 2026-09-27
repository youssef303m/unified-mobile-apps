// Xtream Codes as a ContentSource (02-backend/xtream.md).
import { ParseError } from "@/api/errors";
import type { Playlist } from "@/api/ibo/types";
import { XtreamClient } from "@/api/xtream/client";
import type { XtreamAccount, XtreamPlaylist } from "@/api/xtream/types";
import { episodeUrl, liveUrl, movieUrl, timeshiftUrl, type StreamFormat } from "@/api/xtream/urls";
import { xtreamGuide, type GuideProgramme } from "@/utils/epgTime";

import type { Catalogue, CatalogueOptions, ContentSource } from "./ContentSource";
import type {
  CatalogueItem,
  Category,
  ContentKind,
  EpgProgramme,
  MovieInfo,
  PlayRequest,
  SeriesInfo,
  SourceCapabilities,
  StreamTarget,
} from "./types";

const float = (value: string | undefined): number | undefined => {
  const n = parseFloat(value ?? "");
  return Number.isFinite(n) ? n : undefined;
};

export function toXtreamPlaylist(p: Playlist): XtreamPlaylist {
  return {
    url: p.url,
    username: p.username ?? "",
    password: p.password ?? "",
    origin_url: p.origin_url,
  };
}

export class XtreamSource implements ContentSource {
  readonly type = "xtream" as const;
  readonly capabilities: SourceCapabilities = {
    replay: true,
    liveFavorites: true,
    epg: true,
    paged: false,
    downloads: true,
    liveSearch: true,
  };
  readonly client: XtreamClient;
  /** Minutes added to wall-clock EPG times (set by `login`). */
  serverOffsetMinutes = 0;

  constructor(
    readonly playlist: Playlist,
    private readonly options: { streamFormat?: StreamFormat } = {},
  ) {
    this.client = new XtreamClient(toXtreamPlaylist(playlist));
  }

  get id(): string {
    return this.playlist.id;
  }

  /** R-023 / R-027: login; the server offset is kept for EPG times. */
  async login(signal?: AbortSignal): Promise<XtreamAccount> {
    const account = await this.client.account(signal);
    this.serverOffsetMinutes = account.serverOffsetMinutes;
    return account;
  }

  async categories(kind: ContentKind, signal?: AbortSignal): Promise<Category[]> {
    const list =
      kind === "live"
        ? await this.client.liveCategories(signal)
        : kind === "movie"
          ? await this.client.vodCategories(signal)
          : await this.client.seriesCategories(signal);
    return list.map((c) => ({
      category_id: c.category_id,
      category_name: c.category_name,
      parent_id: c.parent_id,
    }));
  }

  private async items(kind: ContentKind, signal?: AbortSignal): Promise<CatalogueItem[]> {
    if (kind === "live") {
      return (await this.client.liveStreams(signal)).map((s) => ({
        kind,
        item_id: s.stream_id,
        name: s.name,
        icon: s.stream_icon,
        category_id: s.category_id,
        num: s.num,
        tv_archive: s.tv_archive,
        tv_archive_duration: s.tv_archive_duration,
      }));
    }
    if (kind === "movie") {
      return (await this.client.vodStreams(signal)).map((s) => ({
        kind,
        item_id: s.stream_id,
        name: s.name,
        icon: s.stream_icon,
        category_id: s.category_id,
        num: s.num,
        rating: float(s.rating),
        added: float(s.added),
        extension: s.container_extension,
        tv_archive: 0,
        tv_archive_duration: 0,
      }));
    }
    return (await this.client.series(signal)).map((s) => ({
      kind,
      item_id: s.series_id,
      name: s.name,
      icon: s.cover,
      category_id: s.category_id,
      num: s.num,
      rating: float(s.rating),
      added: float(s.last_modified),
      tv_archive: 0,
      tv_archive_duration: 0,
      data: {
        plot: s.plot,
        cast: s.cast,
        genre: s.genre,
        releaseDate: s.releaseDate,
        backdrop: s.backdrop_path?.[0],
      },
    }));
  }

  /** The categories + streams pair of a section, fetched in parallel (R-050). */
  async catalogue(kind: ContentKind, options: CatalogueOptions = {}): Promise<Catalogue> {
    const [categories, items] = await Promise.all([
      this.categories(kind, options.signal),
      this.items(kind, options.signal),
    ]);
    options.onProgress?.(1);
    return { categories, items };
  }

  async movieInfo(item: CatalogueItem, signal?: AbortSignal): Promise<MovieInfo | undefined> {
    return this.client.vodInfo(item.item_id, signal);
  }

  async seriesInfo(item: CatalogueItem, signal?: AbortSignal): Promise<SeriesInfo | undefined> {
    const info = await this.client.seriesInfo(item.item_id, signal);
    if (!info) return undefined;
    return {
      info: info.info,
      seasons: info.seasons.map((s) => ({
        number: s.season_number,
        name: s.name,
        episodes: s.episodes.map((e, i) => ({
          id: e.id,
          title: e.title,
          seasonNumber: s.season_number,
          episodeNumber: i + 1,
          extension: e.container_extension,
          durationSecs: e.duration_secs,
          image: e.movie_image,
          plot: e.plot,
        })),
      })),
    };
  }

  epg(channel: CatalogueItem, signal?: AbortSignal): Promise<EpgProgramme[]> {
    return this.client.shortEpg(channel.item_id, this.serverOffsetMinutes, signal);
  }

  async guide(channel: CatalogueItem, signal?: AbortSignal): Promise<GuideProgramme[]> {
    const listings = await this.client.simpleDataTable(channel.item_id, signal);
    return xtreamGuide(listings ?? [], this.serverOffsetMinutes);
  }

  catchup(channel: CatalogueItem, signal?: AbortSignal): Promise<EpgProgramme[]> {
    return this.client.catchupProgrammes(channel.item_id, this.serverOffsetMinutes, signal);
  }

  async streamUrl(request: PlayRequest): Promise<StreamTarget> {
    const p = this.client.playlist;
    if (request.kind === "live")
      return { url: liveUrl(p, request.item.item_id, this.options.streamFormat) };
    if (request.kind === "movie")
      return { url: movieUrl(p, request.item.item_id, request.item.extension ?? "mp4") };
    return { url: episodeUrl(p, request.episode.id, request.episode.extension ?? "mp4") };
  }

  async catchupUrl(channel: CatalogueItem, programme: EpgProgramme): Promise<StreamTarget> {
    const result = timeshiftUrl(
      this.client.playlist,
      channel.item_id,
      programme,
      this.serverOffsetMinutes,
    );
    if (!result) throw new ParseError("Invalid programme times");
    return { url: result.url };
  }
}
