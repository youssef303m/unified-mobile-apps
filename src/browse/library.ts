// My List data (N-02): favourites, Continue Watching, recently viewed channels, the category
// open counts behind the Home category rows (N-01) and recent searches. The rules themselves
// live in src/content/rules/library.ts; this file picks the storage per source (Stalker keeps
// full objects, R-071) and resolves ids to catalogue items.
import { readJson } from "@/api/store";
import type { KeyValueStore } from "@/api/store";
import {
  addFavourite,
  continueWatchingIds,
  episodeProgress,
  favouriteIds,
  lastWatched,
  movieProgress,
  persistStalkerObject,
  recentLiveIds,
  recordLiveChannel,
  removeFavourite,
  removeProgress,
  removeStalkerObject,
  STALKER_OBJECT_LIMITS,
  stalkerObjects,
} from "@/content/rules/library";
import { canAddFavourite, canRecordHistory } from "@/content/rules/parental";
import type { CatalogueItem, ContentKind } from "@/content/types";
import { itemsByIds } from "@/db/queries/catalogue";
import { listTypeFor, playlistKeys } from "@/storage/keys";

import { playlistIdOf, sourceTypeOf, type BrowseContext } from "./context";

const stalker = (ctx: BrowseContext) => sourceTypeOf(ctx) === "stalker";

// ---------- favourites (R-062, R-070, R-071) ----------

export async function favouriteItems(
  ctx: BrowseContext,
  kind: ContentKind,
): Promise<CatalogueItem[]> {
  const pid = playlistIdOf(ctx);
  if (stalker(ctx)) return stalkerObjects(ctx.store, pid, listTypeFor(kind), "favourite");
  return itemsByIds(ctx.db, pid, kind, favouriteIds(ctx.store, pid, listTypeFor(kind)));
}

export function isFavouriteItem(ctx: BrowseContext, item: CatalogueItem): boolean {
  const pid = playlistIdOf(ctx);
  const type = listTypeFor(item.kind);
  if (stalker(ctx))
    return stalkerObjects(ctx.store, pid, type, "favourite").some(
      (o) => o.item_id === item.item_id,
    );
  return favouriteIds(ctx.store, pid, type).includes(item.item_id);
}

export type FavouriteToggle = "added" | "removed" | "refused_adult" | "full";

/**
 * R-062 / R-070: toggles an item. Removing is always allowed; adding an adult item is refused,
 * and so is adding to a full list (D-037). Stalker stores the whole item (R-071).
 */
export function toggleFavourite(
  ctx: BrowseContext,
  item: CatalogueItem,
  categoryIsAdult: boolean,
): FavouriteToggle {
  const pid = playlistIdOf(ctx);
  const type = listTypeFor(item.kind);
  if (isFavouriteItem(ctx, item)) {
    if (stalker(ctx)) removeStalkerObject(ctx.store, pid, type, "favourite", item.item_id);
    else removeFavourite(ctx.store, pid, type, item.item_id);
    return "removed";
  }
  if (stalker(ctx)) {
    if (!canAddFavourite(categoryIsAdult)) return "refused_adult";
    if (stalkerObjects(ctx.store, pid, type, "favourite").length >= STALKER_OBJECT_LIMITS.favourite)
      return "full";
    persistStalkerObject(ctx.store, pid, type, "favourite", item);
    return "added";
  }
  const result = addFavourite(ctx.store, pid, type, item.item_id, categoryIsAdult);
  return result === "already" ? "added" : result;
}

// ---------- Continue Watching (R-073…R-076) ----------

export interface ContinueEntry {
  item: CatalogueItem;
  /** 0…1, for the progress bar. */
  fraction: number;
  /** Seconds. */
  position: number;
  /** Series: the last watched episode ("S2:E5"). */
  episode?: { id: string; season: number; episode: number };
}

const fractionOf = (time: number, duration: number) =>
  duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0;

/** R-074: the Continue Watching list of a kind, newest first, max 15, with progress. */
export async function continueWatching(
  ctx: BrowseContext,
  kind: "movie" | "series",
): Promise<ContinueEntry[]> {
  const pid = playlistIdOf(ctx);
  const items = await itemsByIds(ctx.db, pid, kind, continueWatchingIds(ctx.store, pid, kind));
  return items.flatMap((item): ContinueEntry[] => {
    if (kind === "movie") {
      const p = movieProgress(ctx.store, pid, item.item_id);
      return p ? [{ item, fraction: fractionOf(p.time, p.duration), position: p.time }] : [];
    }
    const last = lastWatched(ctx.store, pid, item.item_id);
    const p = last ? episodeProgress(ctx.store, pid, item.item_id)[last.id] : undefined;
    if (!last) return [];
    return [
      {
        item,
        fraction: p ? fractionOf(p.time, p.duration) : 0,
        position: p?.time ?? 0,
        episode: { id: last.id, season: last.s, episode: last.ep },
      },
    ];
  });
}

/** user-flows.md §12 Mobile: "Remove from Continue Watching" forgets the item's progress. */
export function removeFromContinueWatching(
  ctx: BrowseContext,
  kind: "movie" | "series",
  itemId: string,
): void {
  removeProgress(ctx.store, playlistIdOf(ctx), kind, itemId);
}

// ---------- recently viewed channels (R-072) ----------

export async function recentChannels(ctx: BrowseContext): Promise<CatalogueItem[]> {
  const pid = playlistIdOf(ctx);
  if (stalker(ctx)) return stalkerObjects(ctx.store, pid, "live", "recent");
  return itemsByIds(ctx.db, pid, "live", recentLiveIds(ctx.store, pid));
}

/** R-072 / R-063: a (non-adult) channel that starts playing goes first in Recently Viewed. */
export function recordChannelView(
  ctx: BrowseContext,
  item: CatalogueItem,
  categoryIsAdult: boolean,
): boolean {
  const pid = playlistIdOf(ctx);
  if (!stalker(ctx)) return recordLiveChannel(ctx.store, pid, item.item_id, categoryIsAdult);
  if (!canRecordHistory(categoryIsAdult)) return false;
  persistStalkerObject(ctx.store, pid, "live", "recent", item);
  return true;
}

// ---------- category opens (N-01 "the categories the user has opened most") ----------

type OpenCounts = Partial<Record<ContentKind, Record<string, number>>>;

const openCounts = (store: KeyValueStore, pid: string): OpenCounts =>
  readJson<OpenCounts>(store, playlistKeys(pid).categoryOpens) ?? {};

/** Counts a category opening (adult categories are never counted, N-01). */
export function recordCategoryOpen(
  store: KeyValueStore,
  pid: string,
  kind: ContentKind,
  categoryId: string,
  categoryIsAdult: boolean,
): void {
  if (categoryIsAdult) return;
  const counts = openCounts(store, pid);
  const forKind = { ...counts[kind], [categoryId]: (counts[kind]?.[categoryId] ?? 0) + 1 };
  store.set(playlistKeys(pid).categoryOpens, JSON.stringify({ ...counts, [kind]: forKind }));
}

/** The most opened categories of the given kinds, most opened first (ties: the first counted). */
export function mostOpenedCategories(
  store: KeyValueStore,
  pid: string,
  kinds: readonly ContentKind[],
  limit: number,
): { kind: ContentKind; categoryId: string; count: number }[] {
  const counts = openCounts(store, pid);
  return kinds
    .flatMap((kind) =>
      Object.entries(counts[kind] ?? {}).map(([categoryId, count]) => ({
        kind,
        categoryId,
        count,
      })),
    )
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ---------- recent searches (Search screen, 03-design/screens.md) ----------

export const RECENT_SEARCHES_LIMIT = 10;

export function recentSearches(store: KeyValueStore, pid: string): string[] {
  return (readJson<unknown[]>(store, playlistKeys(pid).recentSearches) ?? []).map(String);
}

/** The newest query first; the same query (ignoring case) moves to the front. */
export function addRecentSearch(store: KeyValueStore, pid: string, query: string): void {
  const text = query.trim();
  if (!text) return;
  const rest = recentSearches(store, pid).filter((q) => q.toLowerCase() !== text.toLowerCase());
  store.set(
    playlistKeys(pid).recentSearches,
    JSON.stringify([text, ...rest].slice(0, RECENT_SEARCHES_LIMIT)),
  );
}

export function clearRecentSearches(store: KeyValueStore, pid: string): void {
  store.remove(playlistKeys(pid).recentSearches);
}
