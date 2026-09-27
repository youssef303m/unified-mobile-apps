// Typed catalogue queries (04-build/architecture.md: screens query pages, never whole lists).
import type { CatalogueItem, Category, ContentKind } from "@/content/types";
import type { SortKey } from "@/storage/settings";

import type { Db, SqlValue } from "../database";

export interface CategoryRow extends Category {
  is_adult: boolean;
  item_count: number;
}

interface ItemRow {
  kind: ContentKind;
  item_id: string;
  category_id: string;
  name: string;
  icon: string;
  num: number | null;
  rating: number | null;
  added: number | null;
  extension: string | null;
  url: string | null;
  cmd: string | null;
  tv_archive: number;
  tv_archive_duration: number;
  data: string | null;
}

const ITEM_COLUMNS =
  "i.kind, i.item_id, i.category_id, i.name, i.icon, i.num, i.rating, i.added, i.extension, i.url, i.cmd, i.tv_archive, i.tv_archive_duration, i.data";

export function toItem(row: ItemRow): CatalogueItem {
  const item: CatalogueItem = {
    kind: row.kind,
    item_id: row.item_id,
    name: row.name,
    icon: row.icon,
    category_id: row.category_id,
    tv_archive: row.tv_archive,
    tv_archive_duration: row.tv_archive_duration,
  };
  if (row.num !== null) item.num = row.num;
  if (row.rating !== null) item.rating = row.rating;
  if (row.added !== null) item.added = row.added;
  if (row.extension !== null) item.extension = row.extension;
  if (row.url !== null) item.url = row.url;
  if (row.cmd !== null) item.cmd = row.cmd;
  if (row.data !== null) item.data = JSON.parse(row.data) as Record<string, unknown>;
  return item;
}

/** Provider categories in provider order, with their item counts. */
export async function categories(
  db: Db,
  playlistId: string,
  kind: ContentKind,
): Promise<CategoryRow[]> {
  const rows = await db.all<{
    category_id: string;
    name: string;
    parent_id: string;
    is_adult: number;
    item_count: number;
  }>(
    `SELECT c.category_id, c.name, c.parent_id, c.is_adult,
            (SELECT COUNT(*) FROM items i WHERE i.playlist_id = c.playlist_id AND i.kind = c.kind AND i.category_id = c.category_id) AS item_count
       FROM categories c WHERE c.playlist_id = ? AND c.kind = ? ORDER BY c.position`,
    [playlistId, kind],
  );
  return rows.map((r) => ({
    category_id: r.category_id,
    category_name: r.name,
    parent_id: r.parent_id,
    is_adult: r.is_adult === 1,
    item_count: r.item_count,
  }));
}

/**
 * R-090 sort orders. NULLs (M3U items have no rating or added date) sort last, then provider
 * order, which matches the TV leaving such lists unchanged.
 */
function orderBy(sort: SortKey): string {
  switch (sort) {
    case "added":
      return "i.added IS NULL, i.added DESC, i.position";
    case "rating":
      return "i.rating IS NULL, i.rating DESC, i.position";
    case "a_z":
      return "i.name COLLATE NOCASE ASC, i.position";
    case "z_a":
      return "i.name COLLATE NOCASE DESC, i.position";
    case "number":
      return "i.num IS NULL, i.num ASC, i.position";
    default:
      return "i.position";
  }
}

export interface PageOptions {
  offset: number;
  limit: number;
  sort?: SortKey;
}

/** One page of a category. */
export async function itemsPage(
  db: Db,
  playlistId: string,
  kind: ContentKind,
  categoryId: string,
  { offset, limit, sort = "default" }: PageOptions,
): Promise<CatalogueItem[]> {
  const rows = await db.all<ItemRow>(
    `SELECT ${ITEM_COLUMNS} FROM items i WHERE i.playlist_id = ? AND i.kind = ? AND i.category_id = ?
      ORDER BY ${orderBy(sort)} LIMIT ? OFFSET ?`,
    [playlistId, kind, categoryId, limit, offset],
  );
  return rows.map(toItem);
}

export async function itemById(
  db: Db,
  playlistId: string,
  kind: ContentKind,
  itemId: string,
): Promise<CatalogueItem | undefined> {
  const row = await db.first<ItemRow>(
    `SELECT ${ITEM_COLUMNS} FROM items i WHERE i.playlist_id = ? AND i.kind = ? AND i.item_id = ? ORDER BY i.position LIMIT 1`,
    [playlistId, kind, itemId],
  );
  return row ? toItem(row) : undefined;
}

/** Items for a list of ids, in the order of `ids` (favourites, recent, custom rows). */
export async function itemsByIds(
  db: Db,
  playlistId: string,
  kind: ContentKind,
  ids: readonly string[],
): Promise<CatalogueItem[]> {
  const found = new Map<string, CatalogueItem>();
  for (let start = 0; start < ids.length; start += 500) {
    const chunk = ids.slice(start, start + 500);
    const rows = await db.all<ItemRow>(
      `SELECT ${ITEM_COLUMNS} FROM items i WHERE i.playlist_id = ? AND i.kind = ?
         AND i.item_id IN (${chunk.map(() => "?").join(",")}) ORDER BY i.position`,
      [playlistId, kind, ...chunk],
    );
    for (const row of rows) if (!found.has(row.item_id)) found.set(row.item_id, toItem(row));
  }
  return ids.flatMap((id) => found.get(id) ?? []);
}

/** Q-behaviour-fixes #1: the minimum query length is 2 on every screen. */
export const MIN_SEARCH_LENGTH = 2;

/** FTS5 query: every word as a quoted prefix term, so user input is never FTS syntax. */
export function ftsQuery(text: string): string | undefined {
  const words = text
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/"/g, ""))
    .filter(Boolean);
  if (words.length === 0 || text.trim().length < MIN_SEARCH_LENGTH) return undefined;
  return words.map((w) => `"${w}"*`).join(" ");
}

export interface SearchOptions {
  kinds: readonly ContentKind[];
  /** Hidden category ids per kind (R-098: hidden categories are not searched). */
  hidden?: Partial<Record<ContentKind, readonly string[]>>;
  limit?: number;
}

/**
 * R-064: search never returns items from adult categories, even with parental control off.
 * Only items in a known category are searched, de-duplicated by id (data-models.md §10).
 */
export async function search(
  db: Db,
  playlistId: string,
  text: string,
  { kinds, hidden = {}, limit = 60 }: SearchOptions,
): Promise<CatalogueItem[]> {
  const match = ftsQuery(text);
  if (!match || kinds.length === 0) return [];
  const params: SqlValue[] = [match, playlistId, ...kinds];
  let hiddenClause = "";
  for (const kind of kinds) {
    const ids = hidden[kind] ?? [];
    if (ids.length === 0) continue;
    hiddenClause += ` AND NOT (i.kind = ? AND i.category_id IN (${ids.map(() => "?").join(",")}))`;
    params.push(kind, ...ids);
  }
  // bm25() cannot be combined with GROUP BY, so duplicates are removed here (extra rows fetched).
  params.push(limit * 3);
  const rows = await db.all<ItemRow>(
    `SELECT ${ITEM_COLUMNS} FROM items_fts f
       JOIN items i ON i.id = f.rowid
       JOIN categories c ON c.playlist_id = i.playlist_id AND c.kind = i.kind AND c.category_id = i.category_id
      WHERE items_fts MATCH ? AND i.playlist_id = ? AND i.kind IN (${kinds.map(() => "?").join(",")})
        AND c.is_adult = 0${hiddenClause}
      ORDER BY bm25(items_fts), i.position
      LIMIT ?`,
    params,
  );
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const key = `${r.kind}:${r.item_id}`;
    return !seen.has(key) && seen.add(key);
  });
  return unique.slice(0, limit).map(toItem);
}

/** R-054: items added within `windowSeconds` (default 15 days), test-B adult excluded, newest first. */
export async function recentlyAdded(
  db: Db,
  playlistId: string,
  kind: "movie" | "series",
  nowSeconds: number,
  windowSeconds: number,
): Promise<CatalogueItem[]> {
  const rows = await db.all<ItemRow>(
    `SELECT ${ITEM_COLUMNS} FROM items i
       JOIN categories c ON c.playlist_id = i.playlist_id AND c.kind = i.kind AND c.category_id = i.category_id
      WHERE i.playlist_id = ? AND i.kind = ? AND c.hide_from_rows = 0
        AND i.added IS NOT NULL AND ? - i.added <= ?
      GROUP BY i.item_id ORDER BY i.added DESC, i.position`,
    [playlistId, kind, nowSeconds, windowSeconds],
  );
  return rows.map(toItem);
}

/**
 * R-055 candidates: the 10 best-rated items and every item sharing the highest rating (test-B
 * adult excluded). The rule decides between them.
 */
export async function topRatedCandidates(
  db: Db,
  playlistId: string,
  kind: "movie" | "series",
): Promise<{ top: CatalogueItem[]; pool: CatalogueItem[] }> {
  const rated = `FROM items i
       JOIN categories c ON c.playlist_id = i.playlist_id AND c.kind = i.kind AND c.category_id = i.category_id
      WHERE i.playlist_id = ? AND i.kind = ? AND c.hide_from_rows = 0 AND i.rating IS NOT NULL`;
  const top = await db.all<ItemRow>(
    `SELECT ${ITEM_COLUMNS} ${rated} GROUP BY i.item_id ORDER BY i.rating DESC, i.position LIMIT 10`,
    [playlistId, kind],
  );
  const best = top[0]?.rating;
  if (best === undefined || best === null) return { top: [], pool: [] };
  const pool = await db.all<ItemRow>(
    `SELECT ${ITEM_COLUMNS} ${rated} AND i.rating = ? GROUP BY i.item_id ORDER BY i.position`,
    [playlistId, kind, best],
  );
  return { top: top.map(toItem), pool: pool.map(toItem) };
}

export async function syncState(
  db: Db,
  playlistId: string,
  kind: ContentKind,
): Promise<{ synced_at: number; item_count: number } | undefined> {
  return db.first(
    `SELECT synced_at, item_count FROM sync_state WHERE playlist_id = ? AND kind = ?`,
    [playlistId, kind],
  );
}

export interface CategoryFlags {
  name: string;
  /** R-060 test A: PIN lock, favourites, history, search. */
  isAdult: boolean;
  /** R-060 test B: kept out of the Top Rated / Newly Added / Home rows. */
  hideFromRows: boolean;
}

/** The R-060 flags of every category of a section, by category id. */
export async function categoryFlags(
  db: Db,
  playlistId: string,
  kind: ContentKind,
): Promise<Map<string, CategoryFlags>> {
  const rows = await db.all<{
    category_id: string;
    name: string;
    is_adult: number;
    hide_from_rows: number;
  }>(
    `SELECT category_id, name, is_adult, hide_from_rows FROM categories WHERE playlist_id = ? AND kind = ?`,
    [playlistId, kind],
  );
  return new Map(
    rows.map((r) => [
      r.category_id,
      { name: r.name, isAdult: r.is_adult === 1, hideFromRows: r.hide_from_rows === 1 },
    ]),
  );
}

/**
 * N-01: the Home hero candidates: movies (or series) with artwork outside the test-B adult
 * categories, the most recently added first (provider order when there is no date, as in M3U).
 */
export async function heroCandidates(
  db: Db,
  playlistId: string,
  kind: "movie" | "series",
  limit = 1,
): Promise<CatalogueItem[]> {
  const rows = await db.all<ItemRow>(
    `SELECT ${ITEM_COLUMNS} FROM items i
       JOIN categories c ON c.playlist_id = i.playlist_id AND c.kind = i.kind AND c.category_id = i.category_id
      WHERE i.playlist_id = ? AND i.kind = ? AND c.hide_from_rows = 0 AND i.icon <> ''
      ORDER BY i.added IS NULL, i.added DESC, i.position LIMIT ?`,
    [playlistId, kind, limit],
  );
  return rows.map(toItem);
}

/** How many items of a category are stored (Stalker: the pages loaded so far). */
export async function categoryCount(
  db: Db,
  playlistId: string,
  kind: ContentKind,
  categoryId: string,
): Promise<number> {
  const row = await db.first<{ n: number }>(
    `SELECT COUNT(*) AS n FROM items WHERE playlist_id = ? AND kind = ? AND category_id = ?`,
    [playlistId, kind, categoryId],
  );
  return row?.n ?? 0;
}

/** R-097: SQL form of `hasArchive` (tv_archive ≠ 0 and tv_archive_duration ≠ 0). */
const HAS_ARCHIVE = "i.tv_archive <> 0 AND i.tv_archive_duration <> 0";

/** R-097: live categories that hold at least one channel with an archive, in provider order. */
export async function archiveCategories(db: Db, playlistId: string): Promise<CategoryRow[]> {
  const rows = await db.all<{
    category_id: string;
    name: string;
    parent_id: string;
    is_adult: number;
    item_count: number;
  }>(
    `SELECT c.category_id, c.name, c.parent_id, c.is_adult,
            (SELECT COUNT(*) FROM items i WHERE i.playlist_id = c.playlist_id AND i.kind = 'live'
               AND i.category_id = c.category_id AND ${HAS_ARCHIVE}) AS item_count
       FROM categories c WHERE c.playlist_id = ? AND c.kind = 'live' ORDER BY c.position`,
    [playlistId],
  );
  return rows
    .filter((r) => r.item_count > 0)
    .map((r) => ({
      category_id: r.category_id,
      category_name: r.name,
      parent_id: r.parent_id,
      is_adult: r.is_adult === 1,
      item_count: r.item_count,
    }));
}

/** R-097: the channels of a category that have an archive, in the Replay sort (`live_sort`). */
export async function archiveChannels(
  db: Db,
  playlistId: string,
  categoryId: string,
  sort: SortKey = "default",
): Promise<CatalogueItem[]> {
  const rows = await db.all<ItemRow>(
    `SELECT ${ITEM_COLUMNS} FROM items i
      WHERE i.playlist_id = ? AND i.kind = 'live' AND i.category_id = ? AND ${HAS_ARCHIVE}
      ORDER BY ${orderBy(sort)}`,
    [playlistId, categoryId],
  );
  return rows.map(toItem);
}
