// Movie and Series details (03-design/screens.md, user-flows.md §7-9): provider info through the
// movie-info cache (R-057), the saved position (R-075), and for series the sorted seasons and
// the episode that Play starts (R-076).
import { MovieInfoCache } from "@/content/rules/content";
import {
  episodeProgress,
  lastWatched,
  movieProgress,
  progressPercent,
  type SavedProgress,
} from "@/content/rules/library";
import type { CatalogueItem, ContentKind, Episode, MovieInfo, Season } from "@/content/types";
import { categoryFlags, itemById } from "@/db/queries/catalogue";

import { playlistIdOf, sourceTypeOf, type BrowseContext } from "./context";
import { favouriteItems } from "./library";

function infoCache(ctx: BrowseContext): MovieInfoCache {
  const p = ctx.catalogue.playlist;
  return new MovieInfoCache(ctx.store, p.url || p.portal_address || "");
}

/**
 * Finds an item by id: the catalogue first, then the Stalker favourites (portal items are not
 * all stored).
 */
export async function findItem(
  ctx: BrowseContext,
  kind: ContentKind,
  itemId: string,
): Promise<CatalogueItem | undefined> {
  const stored = await itemById(ctx.db, playlistIdOf(ctx), kind, itemId);
  if (stored || sourceTypeOf(ctx) !== "stalker") return stored;
  return (await favouriteItems(ctx, kind)).find((i) => i.item_id === itemId);
}

/** R-060: whether the item's category is adult (PIN, favourites, history). */
export async function isAdultItem(ctx: BrowseContext, item: CatalogueItem): Promise<boolean> {
  const flags = await categoryFlags(ctx.db, playlistIdOf(ctx), item.kind);
  return flags.get(item.category_id)?.isAdult ?? false;
}

export interface Resume {
  position: number;
  duration: number;
  /** R-075: the percentage shown with "Continue Watching". */
  percent: number;
}

const resumeOf = (p: SavedProgress | undefined): Resume | undefined =>
  p && p.time > 0
    ? { position: p.time, duration: p.duration, percent: progressPercent(p.time, p.duration) }
    : undefined;

/** Genre, year and the other list fields that the catalogue already has (shown at once). */
export function listInfo(item: CatalogueItem): MovieInfo {
  const d = item.data ?? {};
  const text = (key: string) =>
    typeof d[key] === "string" && d[key] !== "" ? (d[key] as string) : undefined;
  return {
    name: item.name,
    description: text("plot"),
    cast: text("cast"),
    director: text("director"),
    genre: text("genre"),
    releaseDate: text("releaseDate"),
    rating: item.rating !== undefined ? String(item.rating) : undefined,
    backdrop: text("backdrop"),
  };
}

/** R-057: provider info, cached (max 100) and reused; a failure leaves the list fields. */
export async function movieInfo(
  ctx: BrowseContext,
  item: CatalogueItem,
  signal?: AbortSignal,
): Promise<MovieInfo> {
  const cache = infoCache(ctx);
  const cached = cache.get<MovieInfo>("movie", item.item_id);
  if (cached) return { ...listInfo(item), ...stripEmpty(cached) };
  const info = await ctx.catalogue.source.movieInfo(item, signal);
  if (info) cache.set("movie", item.item_id, info);
  return { ...listInfo(item), ...stripEmpty(info) };
}

const stripEmpty = (info: MovieInfo | undefined): MovieInfo =>
  Object.fromEntries(Object.entries(info ?? {}).filter(([, v]) => v !== undefined && v !== ""));

export function movieResume(ctx: BrowseContext, item: CatalogueItem): Resume | undefined {
  return resumeOf(movieProgress(ctx.store, playlistIdOf(ctx), item.item_id));
}

export interface SeriesDetails {
  info: MovieInfo;
  /** Sorted by number; seasons without episodes are removed. */
  seasons: Season[];
}

export type SeriesResult = { kind: "ok"; details: SeriesDetails } | { kind: "no_seasons" };

/** user-flows.md §8: seasons sorted, empty ones removed; none left → "No seasons available". */
export async function seriesDetails(
  ctx: BrowseContext,
  item: CatalogueItem,
  signal?: AbortSignal,
): Promise<SeriesResult> {
  const result = await ctx.catalogue.source.seriesInfo(item, signal);
  const seasons = (result?.seasons ?? [])
    .filter((s) => s.episodes.length > 0)
    .sort((a, b) => a.number - b.number);
  if (seasons.length === 0) return { kind: "no_seasons" };
  return {
    kind: "ok",
    details: { info: { ...listInfo(item), ...stripEmpty(result?.info) }, seasons },
  };
}

export interface EpisodeState {
  episode: Episode;
  season: Season;
  resume?: Resume;
}

/**
 * R-076: Play on a series resumes the last watched episode, or starts the first episode of the
 * first season.
 */
export function seriesPlayTarget(
  ctx: BrowseContext,
  item: CatalogueItem,
  seasons: readonly Season[],
): EpisodeState | undefined {
  const pid = playlistIdOf(ctx);
  const last = lastWatched(ctx.store, pid, item.item_id);
  const progress = episodeProgress(ctx.store, pid, item.item_id);
  if (last) {
    for (const season of seasons) {
      const episode = season.episodes.find((e) => e.id === last.id);
      if (episode) return { episode, season, resume: resumeOf(progress[episode.id]) };
    }
  }
  const season = seasons[0];
  const episode = season?.episodes[0];
  return season && episode ? { episode, season } : undefined;
}

/** R-073: the saved position of every episode of a series (the progress bars). */
export function episodeResumes(ctx: BrowseContext, item: CatalogueItem): Record<string, Resume> {
  const progress = episodeProgress(ctx.store, playlistIdOf(ctx), item.item_id);
  return Object.fromEntries(
    Object.entries(progress).flatMap(([id, p]) => {
      const r = resumeOf(p);
      return r ? [[id, r]] : [];
    }),
  );
}

/**
 * N-03: only direct files can be downloaded (not HLS); the button is hidden otherwise. Shown
 * from M7, when downloads exist.
 */
export function isDownloadable(ctx: BrowseContext, extension: string | undefined): boolean {
  return (
    ctx.catalogue.source.capabilities.downloads &&
    extension !== undefined &&
    extension.toLowerCase() !== "m3u8"
  );
}
