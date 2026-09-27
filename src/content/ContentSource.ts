// One content interface, three sources (04-build/architecture.md). Everything above it is
// source-agnostic; differences are capabilities. Whole-list sources (Xtream, M3U) expose
// `catalogue`, which sync.ts writes to SQLite; the paged source (Stalker) exposes `page`
// (docs/decisions.md D-034).
import type { GuideProgramme } from "@/utils/epgTime";

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
  SourceType,
  StreamTarget,
} from "./types";

export interface Catalogue {
  categories: Category[];
  items: CatalogueItem[];
}

export interface CatalogueOptions {
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}

export interface ContentSource {
  /** The playlist or portal id (prefix of every per-playlist key). */
  readonly id: string;
  readonly type: SourceType;
  readonly capabilities: SourceCapabilities;

  categories(kind: ContentKind, signal?: AbortSignal): Promise<Category[]>;
  /** Whole-list sources: every category and item of a kind. */
  catalogue?(kind: ContentKind, options?: CatalogueOptions): Promise<Catalogue>;
  /** Paged sources: one page (1-based) of a category, sorted by the portal. */
  page?(
    kind: ContentKind,
    categoryId: string,
    page: number,
    sort?: string,
  ): Promise<Page<CatalogueItem>>;

  movieInfo(item: CatalogueItem, signal?: AbortSignal): Promise<MovieInfo | undefined>;
  seriesInfo(item: CatalogueItem, signal?: AbortSignal): Promise<SeriesInfo | undefined>;
  epg(channel: CatalogueItem, signal?: AbortSignal): Promise<EpgProgramme[]>;
  /** The EPG guide row of a channel (R-096; epg-and-catchup.md §4). Not for M3U. */
  guide?(channel: CatalogueItem, signal?: AbortSignal): Promise<GuideProgramme[]>;
  /** Catch-up programmes with an archive (R-097; Xtream only). */
  catchup?(channel: CatalogueItem, signal?: AbortSignal): Promise<EpgProgramme[]>;

  /** Resolved at play time: Stalker links are short-lived tokens. */
  streamUrl(request: PlayRequest): Promise<StreamTarget>;
  catchupUrl?(channel: CatalogueItem, programme: EpgProgramme): Promise<StreamTarget>;
}
