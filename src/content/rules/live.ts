// I. Live TV rules and sort orders (01-product/business-rules.md R-090…R-099,
// data-models.md §6, §8).
import type { KeyValueStore } from "@/api/store";
import { readJson } from "@/api/store";
import type { SortKey } from "@/storage/settings";
import { listTypeFor, playlistKeys } from "@/storage/keys";
import type { EpgProgramme } from "@/utils/epgTime";
import { parseWallClock } from "@/utils/epgTime";

import type { CatalogueItem, ContentKind, SourceType } from "../types";

// ---------- R-090 ----------

/** R-090: the defaults per section. */
export const DEFAULT_SORTS = { movie: "added", series: "added", replay: "default" } as const;

/** R-090: the sort dialog options; Stalker hides Z-A, and Rating for series. */
export function sortOptions(kind: "movie" | "series", source: SourceType): SortKey[] {
  const all: SortKey[] = ["default", "added", "a_z", "z_a", "rating"];
  if (source !== "stalker") return all;
  return all.filter((s) => s !== "z_a" && !(kind === "series" && s === "rating"));
}

type SortField = "name" | "num" | "rating" | "added";

/**
 * R-090 (getSortedMovies): judged on the first item: when it lacks the field, the list is left
 * in provider order. Added/Rating descending, Number ascending, A-Z / Z-A by locale compare.
 * Returns a new array.
 */
export function sortItems(
  items: readonly CatalogueItem[],
  key: SortKey,
  locale?: string,
): CatalogueItem[] {
  const field: SortField | undefined =
    key === "a_z" || key === "z_a"
      ? "name"
      : key === "number"
        ? "num"
        : key === "rating"
          ? "rating"
          : key === "added"
            ? "added"
            : undefined;
  const first = items[0];
  if (!field || !first || first[field] === undefined) return [...items];
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  const out = [...items];
  switch (key) {
    case "rating":
    case "added":
      return out.sort((a, b) => num(b[field]) - num(a[field]));
    case "number":
      return out.sort((a, b) => num(a[field]) - num(b[field]));
    case "a_z":
      return out.sort((a, b) => a.name.localeCompare(b.name, locale));
    case "z_a":
      return out.sort((a, b) => b.name.localeCompare(a.name, locale));
    default:
      return out;
  }
}

// ---------- R-091 ----------

/** R-091: the first tap on a channel previews it; a tap on the playing channel goes fullscreen. */
export function channelTapAction(
  playingId: string | undefined,
  tappedId: string,
): "preview" | "fullscreen" {
  return playingId === tappedId ? "fullscreen" : "preview";
}

// ---------- R-092 ----------

export interface LiveRow {
  id: string;
  channels: readonly Pick<CatalogueItem, "item_id" | "category_id">[];
}

/**
 * R-092 (settings.md §2.13, Xtream/M3U only): which category opens and which channel starts.
 * Default: the 3rd row if it has channels, else the first non-empty one. Last: the most
 * recently watched channel in its category. Favorite: the first favourite. Both fall back to
 * Default. Stalker: the first real portal category (R-058), nothing auto-played.
 */
export function liveInitialization(
  choice: "default" | "last" | "favorite",
  source: SourceType,
  rows: readonly LiveRow[],
  recentIds: readonly string[],
): { categoryId?: string; channelId?: string } {
  if (source === "stalker")
    return { categoryId: rows.find((r) => !["all", "recent", "favourite"].includes(r.id))?.id };
  const byDefault = () => {
    const third = rows[2];
    const row =
      third && third.channels.length > 0 ? third : rows.find((r) => r.channels.length > 0);
    return { categoryId: row?.id, channelId: row?.channels[0]?.item_id };
  };
  if (choice === "last") {
    const last = recentIds[0];
    const row = last
      ? rows.find(
          (r) =>
            r.id !== "recent" && r.id !== "favourite" && r.channels.some((c) => c.item_id === last),
        )
      : undefined;
    return row && last ? { categoryId: row.id, channelId: last } : byDefault();
  }
  if (choice === "favorite") {
    const favourites = rows.find((r) => r.id === "favourite");
    const first = favourites?.channels[0];
    return first ? { categoryId: "favourite", channelId: first.item_id } : byDefault();
  }
  return byDefault();
}

// ---------- R-093 ----------

interface CategoryOrder {
  id: string;
  position: number;
}
interface ChannelOrder {
  id: string;
  name: string;
  position: number;
}

/** makeRearrangeArray: remove + insert at the position. */
function moveTo<T>(list: T[], from: number, to: number): T[] {
  const out = [...list];
  const [item] = out.splice(from, 1);
  if (item !== undefined) out.splice(Math.min(Math.max(to, 0), out.length), 0, item);
  return out;
}

/** R-093: the legacy "Move" orders (categories by id; channels by id and name, per category). */
export function applyLegacyOrders<C extends { category_id: string; channels: CatalogueItem[] }>(
  store: KeyValueStore,
  pid: string,
  categories: readonly C[],
): C[] {
  let cats = [...categories];
  const categoryOrders = [
    ...(readJson<CategoryOrder[]>(store, playlistKeys(pid).categoryOrders) ?? []),
  ].sort((a, b) => a.position - b.position);
  for (const order of categoryOrders) {
    const from = cats.findIndex((c) => c.category_id === String(order.id));
    if (from >= 0) cats = moveTo(cats, from, order.position);
  }
  const channelOrders =
    readJson<Record<string, ChannelOrder[]>>(store, playlistKeys(pid).channelOrders) ?? {};
  return cats.map((c) => {
    const orders = channelOrders[c.category_id];
    if (!orders) return c;
    let channels = [...c.channels];
    for (const o of [...orders].sort((a, b) => a.position - b.position)) {
      const from = channels.findIndex((ch) => ch.item_id === String(o.id) && ch.name === o.name);
      if (from >= 0) channels = moveTo(channels, from, o.position);
    }
    return { ...c, channels };
  });
}

/** R-093: "Search All Channels" cannot move, and nothing moves above the first row. */
export function canMoveCategory(
  rows: readonly { id: string }[],
  from: number,
  to: number,
): boolean {
  return rows[from]?.id !== "all" && to >= 1 && from >= 1;
}

// ---------- R-094 ----------

const PINNED = new Set(["all", "recent", "favourite"]);

/** R-094 (applyArrangement): pinned rows, then the chosen ids in order, then the rest. */
export function applyArrangement<T extends { category_id: string }>(
  cats: readonly T[],
  order: readonly string[],
): T[] {
  let start = 0;
  while (start < cats.length && PINNED.has(String((cats[start] as T).category_id))) start++;
  const head = cats.slice(0, start);
  const rest = cats.slice(start);
  const chosen = order.flatMap((id) => rest.find((c) => String(c.category_id) === id) ?? []);
  return [...head, ...chosen, ...rest.filter((c) => !chosen.includes(c))];
}

/** R-094: pinned ids are never stored; an empty arrangement removes the key. */
export function saveArrangement(store: KeyValueStore, pid: string, order: readonly string[]): void {
  const ids = order.filter((id) => !PINNED.has(id));
  if (ids.length === 0) store.remove(playlistKeys(pid).liveCategoryArrangement);
  else store.set(playlistKeys(pid).liveCategoryArrangement, JSON.stringify(ids));
}

export function readArrangement(store: KeyValueStore, pid: string): string[] {
  return (readJson<unknown[]>(store, playlistKeys(pid).liveCategoryArrangement) ?? []).map(String);
}

// ---------- R-095 ----------

/** R-095: where the EPG comes from; M3U has none (the EPG button is hidden). */
export function epgSource(source: SourceType): "xtream" | "stalker" | "none" {
  return source === "m3u" ? "none" : source;
}

// ---------- R-096 ----------

export const GUIDE = {
  maxConcurrent: 4,
  requestTimeoutMs: 15_000,
  probeRows: 8,
  /** Back-to-back programmes with the same title merge when the gap is ≤ 1 minute. */
  mergeGapMs: 60_000,
} as const;

/** R-096: the guide gives up on a category when its first 8 rows have no EPG. */
export function guideGivesUp(firstRowCounts: readonly number[]): boolean {
  return (
    firstRowCounts.length >= GUIDE.probeRows &&
    firstRowCounts.slice(0, GUIDE.probeRows).every((n) => n === 0)
  );
}

/** R-096: from the guide, a current programme plays live, a future one shows details, a past one does nothing. */
export function guideTapAction(
  p: EpgProgramme,
  now: Date = new Date(),
): "play_live" | "details" | "none" {
  const start = parseWallClock(p.start)?.getTime() ?? NaN;
  const stop = parseWallClock(p.stop)?.getTime() ?? NaN;
  if (now.getTime() >= start && now.getTime() < stop) return "play_live";
  return now.getTime() < start ? "details" : "none";
}

// ---------- R-097 ----------

/** R-097: Replay availability per source. */
export function replayAvailability(
  source: SourceType,
): "available" | "stalker_blocked" | "not_available" {
  if (source === "xtream") return "available";
  return source === "stalker" ? "stalker_blocked" : "not_available";
}

/** R-097: Xtream channels with an archive (tv_archive ≠ 0 and tv_archive_duration ≠ 0). */
export function hasArchive(
  channel: Pick<CatalogueItem, "tv_archive" | "tv_archive_duration">,
): boolean {
  return channel.tv_archive !== 0 && channel.tv_archive_duration !== 0;
}

// ---------- R-098 ----------

/** R-098: live search covers visible categories by name; not on Stalker. */
export function liveSearchAvailable(source: SourceType): boolean {
  return source !== "stalker";
}

// ---------- hidden categories (data-models.md §3; R-098 search excludes them) ----------

export function hiddenCategories(store: KeyValueStore, pid: string, kind: ContentKind): string[] {
  return (readJson<unknown[]>(store, playlistKeys(pid).hiddens(listTypeFor(kind))) ?? []).map(
    String,
  );
}

/** Settings → Hide Categories: toggles a row; "all" (Search All) is never hideable. */
export function toggleHiddenCategory(
  store: KeyValueStore,
  pid: string,
  kind: ContentKind,
  categoryId: string,
): boolean {
  if (categoryId === "all") return false;
  const hidden = hiddenCategories(store, pid, kind);
  const isHidden = hidden.includes(categoryId);
  const next = isHidden ? hidden.filter((h) => h !== categoryId) : [...hidden, categoryId];
  store.set(playlistKeys(pid).hiddens(listTypeFor(kind)), JSON.stringify(next));
  return !isHidden;
}
