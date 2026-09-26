// G. Favourites, recent, continue watching (01-product/business-rules.md R-070…R-078,
// data-models.md §2, §7, player.md §4). Stored on the injected KeyValueStore under the TV keys.
import type { KeyValueStore } from "@/api/store";
import { readJson } from "@/api/store";
import { playlistKeys, type ListType } from "@/storage/keys";

import type { CatalogueItem, SourceType } from "../types";

import { canAddFavourite, canRecordHistory } from "./parental";

const readIds = (store: KeyValueStore, key: string): string[] =>
  (readJson<unknown[]>(store, key) ?? []).map((v) => String(v));

// ---------- R-070 favourites ----------

/** R-070: per playlist and type: live 500, movies 200, series 200. */
export const FAVOURITE_LIMITS: Record<ListType, number> = { live: 500, vod: 200, series: 200 };

export type FavouriteResult = "added" | "already" | "refused_adult" | "full";

export function favouriteIds(store: KeyValueStore, pid: string, type: ListType): string[] {
  return readIds(store, playlistKeys(pid).favourites(type));
}

export function isFavourite(
  store: KeyValueStore,
  pid: string,
  type: ListType,
  id: string,
): boolean {
  return favouriteIds(store, pid, type).includes(id);
}

/**
 * R-070 / R-062: appended at the end; refused for adult items. At the limit the add is refused
 * rather than dropping an older favourite (docs/decisions.md D-037).
 */
export function addFavourite(
  store: KeyValueStore,
  pid: string,
  type: ListType,
  id: string,
  categoryIsAdult: boolean,
): FavouriteResult {
  if (!canAddFavourite(categoryIsAdult)) return "refused_adult";
  const ids = favouriteIds(store, pid, type);
  if (ids.includes(id)) return "already";
  if (ids.length >= FAVOURITE_LIMITS[type]) return "full";
  store.set(playlistKeys(pid).favourites(type), JSON.stringify([...ids, id]));
  return "added";
}

/** R-062: removing is always allowed. */
export function removeFavourite(
  store: KeyValueStore,
  pid: string,
  type: ListType,
  id: string,
): void {
  store.set(
    playlistKeys(pid).favourites(type),
    JSON.stringify(favouriteIds(store, pid, type).filter((f) => f !== id)),
  );
}

// ---------- R-071 Stalker objects ----------

/** R-071: the Home "Live Favourites" tile: hidden for Stalker and when the setting is off. */
export function homeLiveFavouritesVisible(
  source: SourceType,
  homeFavoritesSetting: boolean,
): boolean {
  return source !== "stalker" && homeFavoritesSetting;
}

export const STALKER_OBJECT_LIMITS = { favourite: 500, recent: 15 } as const;

export function stalkerObjects(
  store: KeyValueStore,
  pid: string,
  type: ListType,
  list: "recent" | "favourite",
): CatalogueItem[] {
  return readJson<CatalogueItem[]>(store, playlistKeys(pid).stalkerObjects(type, list)) ?? [];
}

/**
 * R-071 / R-072: Stalker keeps full objects (portal lists are paged): the same id is removed,
 * the item goes first, the list is truncated.
 */
export function persistStalkerObject(
  store: KeyValueStore,
  pid: string,
  type: ListType,
  list: "recent" | "favourite",
  item: CatalogueItem,
): void {
  const rest = stalkerObjects(store, pid, type, list).filter((o) => o.item_id !== item.item_id);
  const next = [item, ...rest].slice(0, STALKER_OBJECT_LIMITS[list]);
  store.set(playlistKeys(pid).stalkerObjects(type, list), JSON.stringify(next));
}

export function removeStalkerObject(
  store: KeyValueStore,
  pid: string,
  type: ListType,
  list: "recent" | "favourite",
  id: string,
) {
  const next = stalkerObjects(store, pid, type, list).filter((o) => o.item_id !== id);
  store.set(playlistKeys(pid).stalkerObjects(type, list), JSON.stringify(next));
}

// ---------- R-072 recently viewed (live) ----------

export const RECENT_LIVE_LIMIT = 15;

export function recentLiveIds(store: KeyValueStore, pid: string): string[] {
  return readIds(store, playlistKeys(pid).liveRecent);
}

/**
 * R-072 / R-063: playing a (non-adult) channel puts it first, max 15. Q-behaviour-fixes #2: a
 * channel already in the list moves to the front for every source (not only Stalker).
 */
export function recordLiveChannel(
  store: KeyValueStore,
  pid: string,
  id: string,
  categoryIsAdult: boolean,
): boolean {
  if (!canRecordHistory(categoryIsAdult)) return false;
  const next = [id, ...recentLiveIds(store, pid).filter((r) => r !== id)].slice(
    0,
    RECENT_LIVE_LIMIT,
  );
  store.set(playlistKeys(pid).liveRecent, JSON.stringify(next));
  return true;
}

// ---------- R-073 progress ----------

/** R-073 thresholds, in seconds (the phone stores seconds, docs/decisions.md D-038). */
export const MIN_PROGRESS_S = 10;
export const FINISHED_WITHIN_S = 10;
/** Saved at most once a minute during playback (player.md §4.2). */
export const PROGRESS_SAVE_INTERVAL_MS = 60_000;

export type ProgressDecision = "save" | "finished" | "ignore";

/** R-073: save when ≥ 10 s in and ≥ 10 s left; within the last 10 s it counts as finished. */
export function progressDecision(position: number, duration: number): ProgressDecision {
  if (duration > 0 && duration - position < FINISHED_WITHIN_S) return "finished";
  if (position >= MIN_PROGRESS_S) return "save";
  return "ignore";
}

interface MovieProgress {
  stream_id: string;
  time: number;
  duration: number;
  /** Phone addition: when it was saved, for Continue Watching order (R-074). */
  updated_at?: number;
}

interface EpisodeProgress {
  time: number;
  duration: number;
  season: number;
  episode: number;
  updated_at: number;
}

/**
 * Series progress, keyed by episode id (Q-behaviour-fixes #3) instead of the TV's season and
 * episode positions: `{ stream_id: seriesId, episodes: { [episodeId]: … }, recent }`.
 */
interface SeriesProgress {
  stream_id: string;
  episodes: Record<string, EpisodeProgress>;
  recent?: { id: string; s: number; ep: number };
  updated_at: number;
}

const movieList = (store: KeyValueStore, pid: string) =>
  readJson<MovieProgress[]>(store, playlistKeys(pid).savedVodTimes) ?? [];
const seriesList = (store: KeyValueStore, pid: string) =>
  readJson<SeriesProgress[]>(store, playlistKeys(pid).savedSeriesTimes) ?? [];

/** R-073 / R-063 for a movie. Returns what happened. */
export function saveMovieProgress(
  store: KeyValueStore,
  pid: string,
  movieId: string,
  position: number,
  duration: number,
  categoryIsAdult: boolean,
  now: number = Date.now(),
): ProgressDecision {
  if (!canRecordHistory(categoryIsAdult)) return "ignore";
  const decision = progressDecision(position, duration);
  if (decision === "ignore") return decision;
  const rest = movieList(store, pid).filter((m) => m.stream_id !== movieId);
  const next =
    decision === "save"
      ? [...rest, { stream_id: movieId, time: position, duration, updated_at: now }]
      : rest;
  store.set(playlistKeys(pid).savedVodTimes, JSON.stringify(next));
  return decision;
}

export interface EpisodeRef {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
}

/** R-073 / R-063 / R-076 for an episode; a series leaves the list when no episode remains. */
export function saveEpisodeProgress(
  store: KeyValueStore,
  pid: string,
  seriesId: string,
  episode: EpisodeRef,
  position: number,
  duration: number,
  categoryIsAdult: boolean,
  now: number = Date.now(),
): ProgressDecision {
  if (!canRecordHistory(categoryIsAdult)) return "ignore";
  const decision = progressDecision(position, duration);
  if (decision === "ignore") return decision;
  const list = seriesList(store, pid);
  const current = list.find((s) => s.stream_id === seriesId) ?? {
    stream_id: seriesId,
    episodes: {},
    updated_at: now,
  };
  const others = Object.entries(current.episodes).filter(([key]) => key !== episode.id);
  const episodes: Record<string, EpisodeProgress> = Object.fromEntries(
    decision === "save"
      ? [
          ...others,
          [
            episode.id,
            {
              time: position,
              duration,
              season: episode.seasonNumber,
              episode: episode.episodeNumber,
              updated_at: now,
            },
          ],
        ]
      : others,
  );
  const rest = list.filter((s) => s.stream_id !== seriesId);
  const recent = { id: episode.id, s: episode.seasonNumber, ep: episode.episodeNumber };
  const next =
    Object.keys(episodes).length > 0
      ? [...rest, { stream_id: seriesId, episodes, recent, updated_at: now }]
      : rest;
  store.set(playlistKeys(pid).savedSeriesTimes, JSON.stringify(next));
  return decision;
}

// ---------- R-074 continue watching ----------

export const CONTINUE_WATCHING_LIMIT = 15;

/** R-074: ids with saved progress, newest first, capped at 15 (Notes: capped consistently). */
export function continueWatchingIds(
  store: KeyValueStore,
  pid: string,
  kind: "movie" | "series",
): string[] {
  const entries: { stream_id: string; updated_at?: number }[] =
    kind === "movie" ? movieList(store, pid) : seriesList(store, pid);
  return entries
    .map((e, index) => ({ id: e.stream_id, at: e.updated_at ?? index }))
    .sort((a, b) => b.at - a.at)
    .slice(0, CONTINUE_WATCHING_LIMIT)
    .map((e) => e.id);
}

// ---------- R-075 resume ----------

/** R-075: the resume dialog closes by itself after 15 s (counts as "No"). */
export const RESUME_PROMPT_TIMEOUT_MS = 15_000;

export function movieResumePosition(store: KeyValueStore, pid: string, movieId: string): number {
  return movieList(store, pid).find((m) => m.stream_id === movieId)?.time ?? 0;
}

export function episodeResumePosition(
  store: KeyValueStore,
  pid: string,
  seriesId: string,
  episodeId: string,
): number {
  return (
    seriesList(store, pid).find((s) => s.stream_id === seriesId)?.episodes[episodeId]?.time ?? 0
  );
}

export interface SavedProgress {
  time: number;
  duration: number;
  updatedAt: number;
}

/** R-073 / R-075: a movie's saved position (Continue Watching card, details page). */
export function movieProgress(
  store: KeyValueStore,
  pid: string,
  movieId: string,
): SavedProgress | undefined {
  const m = movieList(store, pid).find((e) => e.stream_id === movieId);
  return m ? { time: m.time, duration: m.duration, updatedAt: m.updated_at ?? 0 } : undefined;
}

/** R-073: every saved episode position of a series, by episode id. */
export function episodeProgress(
  store: KeyValueStore,
  pid: string,
  seriesId: string,
): Record<string, SavedProgress & { season: number; episode: number }> {
  const s = seriesList(store, pid).find((e) => e.stream_id === seriesId);
  return Object.fromEntries(
    Object.entries(s?.episodes ?? {}).map(([id, e]) => [
      id,
      {
        time: e.time,
        duration: e.duration,
        updatedAt: e.updated_at,
        season: e.season,
        episode: e.episode,
      },
    ]),
  );
}

/** R-075: the prompt is offered when there is a saved position and the stream can seek. */
export function shouldOfferResume(position: number, seekable: boolean): boolean {
  return position > 0 && seekable;
}

/** R-075: the "Continue Watching" percentage on details pages. */
export function progressPercent(position: number, duration: number): number {
  if (!(duration > 0)) return 0;
  return Math.min(100, Math.max(0, Math.round((position / duration) * 100)));
}

// ---------- R-076 series last watched ----------

/** R-076: the last watched season/episode of a series ("S{n}EP{m}" on cards). */
export function lastWatched(
  store: KeyValueStore,
  pid: string,
  seriesId: string,
): { id: string; s: number; ep: number } | undefined {
  return seriesList(store, pid).find((s) => s.stream_id === seriesId)?.recent;
}

export function lastWatchedLabel(last: { s: number; ep: number }): string {
  return `S${last.s}EP${last.ep}`;
}

// ---------- R-077 clear watch lists ----------

/** R-077: removes all movie (or series) progress of the current playlist. */
export function clearWatchList(store: KeyValueStore, pid: string, kind: "movie" | "series"): void {
  store.remove(
    kind === "movie" ? playlistKeys(pid).savedVodTimes : playlistKeys(pid).savedSeriesTimes,
  );
}

/**
 * user-flows.md §12 Mobile (new, optional): "Remove from Continue Watching" deletes that item's
 * progress (a series: every episode position).
 */
export function removeProgress(
  store: KeyValueStore,
  pid: string,
  kind: "movie" | "series",
  id: string,
): void {
  if (kind === "movie") {
    const next = movieList(store, pid).filter((m) => m.stream_id !== id);
    store.set(playlistKeys(pid).savedVodTimes, JSON.stringify(next));
  } else {
    const next = seriesList(store, pid).filter((s) => s.stream_id !== id);
    store.set(playlistKeys(pid).savedSeriesTimes, JSON.stringify(next));
  }
}

// ---------- R-078 favourite from details ----------

/** R-078: the details page toggle is applied when leaving the page (the net change only). */
export function detailsFavouriteChange(
  wasFavourite: boolean,
  isFavouriteNow: boolean,
): "add" | "remove" | undefined {
  if (wasFavourite === isFavouriteNow) return undefined;
  return isFavouriteNow ? "add" : "remove";
}
