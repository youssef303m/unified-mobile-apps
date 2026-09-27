// Stalker portals as a ContentSource (02-backend/stalker.md). Always paged / on demand.
import { AuthError } from "@/api/errors";
import type { Playlist } from "@/api/ibo/types";
import { StalkerClient, type ConnectResult } from "@/api/stalker/client";
import {
  StalkerContent,
  type StalkerChannel,
  type StalkerMovie,
  type StalkerSeries,
} from "@/api/stalker/content";
import { StalkerLinks } from "@/api/stalker/links";
import { profileKey, type StbProfileKey } from "@/api/stalker/portal";
import type { KeyValueStore } from "@/api/store";
import { stalkerGuide, type GuideProgramme } from "@/utils/epgTime";

import type { ContentSource } from "./ContentSource";
import { stalkerLoginOutcome } from "./rules/playlists";
import type {
  CatalogueItem,
  Category,
  ContentKind,
  EpgProgramme,
  MovieInfo,
  Page,
  PlayRequest,
  SeriesInfo,
  SourceCapabilities,
  StreamTarget,
} from "./types";

const float = (value: string): number | undefined => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
};
const unixOf = (date: string): number | undefined => {
  const t = Date.parse(date.replace(" ", "T"));
  return Number.isNaN(t) ? undefined : Math.floor(t / 1000);
};

function channelItem(c: StalkerChannel): CatalogueItem {
  return {
    kind: "live",
    item_id: c.stream_id,
    name: c.name,
    icon: c.stream_icon,
    category_id: c.category_id,
    num: float(String(c.num)),
    cmd: c.cmd,
    tv_archive: c.tv_archive,
    tv_archive_duration: c.tv_archive_duration,
  };
}

function movieItem(m: StalkerMovie): CatalogueItem {
  return {
    kind: "movie",
    item_id: m.stream_id,
    name: m.name,
    icon: m.stream_icon,
    category_id: m.category_id,
    rating: float(m.rating),
    added: unixOf(m.added),
    cmd: m.cmd,
    tv_archive: 0,
    tv_archive_duration: 0,
    data: {
      series: m.series,
      storageId: m.storage_id,
      plot: m.plot,
      director: m.director,
      cast: m.cast,
      genre: m.genre,
      year: m.year,
      duration: m.duration,
      tmdbId: m.tmdb_id,
      addedRaw: m.added,
    },
  };
}

function seriesItem(s: StalkerSeries): CatalogueItem {
  return {
    kind: "series",
    item_id: s.series_id,
    name: s.name,
    icon: s.cover,
    category_id: s.category_id,
    rating: float(s.rating),
    added: unixOf(s.added),
    tv_archive: 0,
    tv_archive_duration: 0,
    data: {
      stalkerCategoryId: s.stalker_category_id,
      plot: s.plot,
      genre: s.genre,
      cast: s.cast,
      director: s.director,
      year: s.year,
      tmdbId: s.tmdb_id,
      addedRaw: s.added,
    },
  };
}

export class StalkerSource implements ContentSource {
  readonly type = "stalker" as const;
  readonly capabilities: SourceCapabilities = {
    replay: false, // Q-replay-stalker: kept blocked, as on TV.
    liveFavorites: false,
    epg: true,
    paged: true,
    downloads: true,
    liveSearch: false,
  };
  readonly client: StalkerClient;
  private readonly content: StalkerContent;
  private readonly links: StalkerLinks;
  private connected?: Promise<ConnectResult>;

  constructor(
    readonly playlist: Playlist,
    store: KeyValueStore,
    configuredProfile?: string,
  ) {
    this.client = new StalkerClient({
      portalUrl: playlist.portal_address || playlist.url,
      macAddress: playlist.stalker_mac_address ?? "",
      fallbackUrl: playlist.portal_fallback_address || undefined,
      profile: profileKey(playlist.stalker_stb_profile ?? configuredProfile),
      store,
    });
    this.content = new StalkerContent(this.client);
    this.links = new StalkerLinks(this.client);
  }

  get id(): string {
    return this.playlist.id;
  }

  /** R-026: connect once; a non-OK profile is a login failure. */
  connect(): Promise<ConnectResult> {
    this.connected ??= this.client.connect().then((result) => {
      const outcome = stalkerLoginOutcome(result.profile);
      if (outcome !== "ok") {
        throw new AuthError(
          `Portal login failed: ${outcome}`,
          outcome === "expired" ? "portal_expired" : "portal_unavailable",
        );
      }
      return result;
    });
    this.connected.catch(() => {
      this.connected = undefined;
    });
    return this.connected;
  }

  get workingProfile(): Promise<StbProfileKey> {
    return this.connect().then((r) => r.workingProfile);
  }

  async categories(kind: ContentKind): Promise<Category[]> {
    await this.connect();
    return (await this.content.categories(kind)).map((c) => ({
      category_id: c.category_id,
      category_name: c.category_name,
      parent_id: c.parent_id,
    }));
  }

  async page(
    kind: ContentKind,
    categoryId: string,
    page: number,
    sort?: string,
  ): Promise<Page<CatalogueItem>> {
    await this.connect();
    if (kind === "live") {
      const result = await this.content.liveChannels(categoryId, page);
      return { items: result.data.map(channelItem), total: result.total_items };
    }
    if (kind === "movie") {
      const result = await this.content.movies(categoryId, page, sort);
      return { items: result.data.map(movieItem), total: result.total_items };
    }
    const result = await this.content.series(categoryId, page, sort);
    return { items: result.data.map(seriesItem), total: result.total_items };
  }

  /** §4.11: the portal's own search (movies and series; no live search). */
  async search(kind: "movie" | "series", keyword: string): Promise<CatalogueItem[]> {
    await this.connect();
    const results = await this.content.search(kind, keyword);
    return results.map((r) => ("stream_id" in r ? movieItem(r) : seriesItem(r)));
  }

  async movieInfo(item: CatalogueItem): Promise<MovieInfo | undefined> {
    const d = item.data ?? {};
    const text = (key: string) =>
      typeof d[key] === "string" && d[key] !== "" ? (d[key] as string) : undefined;
    return {
      name: item.name,
      description: text("plot"),
      cast: text("cast"),
      director: text("director"),
      genre: text("genre"),
      duration: text("duration"),
      releaseDate: text("year"),
      rating: item.rating !== undefined ? String(item.rating) : undefined,
      tmdbId: text("tmdbId"),
    };
  }

  async seriesInfo(item: CatalogueItem): Promise<SeriesInfo | undefined> {
    await this.connect();
    const seasons = await this.content.seasons({
      series_id: item.item_id,
      stalker_category_id:
        typeof item.data?.stalkerCategoryId === "string" ? item.data.stalkerCategoryId : undefined,
      category_id: item.category_id,
    });
    return {
      info: (await this.movieInfo(item)) ?? {},
      seasons: seasons.map((s) => ({
        number: parseInt(s.season_number, 10),
        name: s.name,
        episodes: s.episodes.map((e) => ({
          id: e.id,
          title: e.title,
          seasonNumber: parseInt(s.season_number, 10),
          episodeNumber: e.episode_num,
          extension: e.container_extension,
          cmd: e.cmd,
          series: e.series,
          storageId: e.storage_id,
        })),
      })),
    };
  }

  async epg(channel: CatalogueItem): Promise<EpgProgramme[]> {
    await this.connect();
    return this.content.shortEpg(channel.item_id);
  }

  async guide(channel: CatalogueItem): Promise<GuideProgramme[]> {
    await this.connect();
    return stalkerGuide(await this.content.simpleDataTable(channel.item_id, 400));
  }

  /** create_link at play time; Q-stream-headers: the MAG User-Agent and Cookie go with it. */
  async streamUrl(request: PlayRequest): Promise<StreamTarget> {
    await this.connect();
    const headers = this.client.streamHeaders();
    if (request.kind === "live") {
      return { url: await this.links.live(request.item.cmd ?? "", request.item.item_id), headers };
    }
    if (request.kind === "movie") {
      const d = request.item.data ?? {};
      const series = typeof d.series === "string" ? d.series : "";
      const storage = typeof d.storageId === "string" ? d.storageId : "";
      return { url: await this.links.movie(request.item.cmd ?? "", series, storage), headers };
    }
    const e = request.episode;
    return {
      url: await this.links.episode(e.cmd ?? "", e.series ?? "", e.storageId ?? ""),
      headers,
    };
  }
}
