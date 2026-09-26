// Pulls a source's catalogue into SQLite (04-build/architecture.md "sync.ts"): whole sections
// for Xtream/M3U, categories + cached pages for Stalker. Writes happen in one transaction per
// section, in batches, with progress.
import type { Db, SqlValue } from "@/db/database";

import type { Catalogue } from "./ContentSource";
import { isAdultCategory, isHiddenFromRows } from "./rules/parental";
import type { CatalogueItem, Category, ContentKind } from "./types";

const BATCH = 100;
const COLUMNS = [
  "playlist_id",
  "kind",
  "item_id",
  "category_id",
  "position",
  "name",
  "icon",
  "num",
  "rating",
  "added",
  "extension",
  "url",
  "cmd",
  "tv_archive",
  "tv_archive_duration",
  "data",
] as const;
const ROW = `(${COLUMNS.map(() => "?").join(",")})`;

export const UNCATEGORIZED_ID = "undefined";

export interface SyncProgress {
  kind: ContentKind;
  /** 0..1 of the rows written. */
  fraction: number;
}

function rowValues(playlistId: string, item: CatalogueItem, position: number): SqlValue[] {
  return [
    playlistId,
    item.kind,
    item.item_id,
    item.category_id,
    position,
    item.name,
    item.icon,
    item.num ?? null,
    item.rating ?? null,
    item.added ?? null,
    item.extension ?? null,
    item.url ?? null,
    item.cmd ?? null,
    item.tv_archive,
    item.tv_archive_duration,
    item.data ? JSON.stringify(item.data) : null,
  ];
}

async function insertItems(
  tx: Db,
  playlistId: string,
  items: readonly CatalogueItem[],
  firstPosition: number,
  onBatch?: (written: number) => void,
): Promise<void> {
  for (let start = 0; start < items.length; start += BATCH) {
    const batch = items.slice(start, start + BATCH);
    const values = batch.flatMap((item, i) =>
      rowValues(playlistId, item, firstPosition + start + i),
    );
    await tx.run(
      `INSERT INTO items (${COLUMNS.join(",")}) VALUES ${batch.map(() => ROW).join(",")}`,
      values,
    );
    onBatch?.(start + batch.length);
  }
}

async function insertCategories(
  tx: Db,
  playlistId: string,
  kind: ContentKind,
  categories: readonly Category[],
) {
  let position = 0;
  for (const c of categories) {
    await tx.run(
      `INSERT OR REPLACE INTO categories (playlist_id, kind, category_id, name, position, parent_id, is_adult, hide_from_rows)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        playlistId,
        kind,
        c.category_id,
        c.category_name,
        position++,
        c.parent_id,
        isAdultCategory(c.category_name) ? 1 : 0,
        isHiddenFromRows(c.category_name) ? 1 : 0,
      ],
    );
  }
}

async function markSynced(
  tx: Db,
  playlistId: string,
  kind: ContentKind,
  count: number,
  now: number,
) {
  await tx.run(
    `INSERT OR REPLACE INTO sync_state (playlist_id, kind, synced_at, item_count) VALUES (?, ?, ?, ?)`,
    [playlistId, kind, now, count],
  );
}

async function clearSection(tx: Db, playlistId: string, kind: ContentKind) {
  await tx.run(`DELETE FROM items WHERE playlist_id = ? AND kind = ?`, [playlistId, kind]);
  await tx.run(`DELETE FROM categories WHERE playlist_id = ? AND kind = ?`, [playlistId, kind]);
}

/**
 * Replaces a whole section (R-053 model build): provider categories in provider order, then
 * "Uncategorized" only when some items have no category. Items keep provider order.
 */
export async function writeCatalogue(
  db: Db,
  playlistId: string,
  kind: ContentKind,
  catalogue: Catalogue,
  options: { onProgress?: (p: SyncProgress) => void; now?: number } = {},
): Promise<void> {
  const categories = [...catalogue.categories];
  if (catalogue.items.some((i) => i.category_id === UNCATEGORIZED_ID)) {
    categories.push({
      category_id: UNCATEGORIZED_ID,
      category_name: "Uncategorized",
      parent_id: "0",
    });
  }
  const total = catalogue.items.length;
  await db.transaction(async (tx) => {
    await clearSection(tx, playlistId, kind);
    await insertCategories(tx, playlistId, kind, categories);
    await insertItems(tx, playlistId, catalogue.items, 0, (written) =>
      options.onProgress?.({ kind, fraction: total === 0 ? 1 : written / total }),
    );
    await markSynced(tx, playlistId, kind, total, options.now ?? Math.floor(Date.now() / 1000));
  });
  if (total === 0) options.onProgress?.({ kind, fraction: 1 });
}

/** Stalker: categories only; items arrive page by page (cachePage). */
export async function writeCategories(
  db: Db,
  playlistId: string,
  kind: ContentKind,
  categories: readonly Category[],
) {
  await db.transaction(async (tx) => {
    await tx.run(`DELETE FROM categories WHERE playlist_id = ? AND kind = ?`, [playlistId, kind]);
    await insertCategories(tx, playlistId, kind, categories);
  });
}

/**
 * Stalker: caches a loaded page of a category (stalker.md §4.3). Page 1 replaces the category's
 * rows; later pages append, skipping ids already loaded (portals that repeat pages). Returns the
 * number of new items.
 */
export async function cachePage(
  db: Db,
  playlistId: string,
  kind: ContentKind,
  categoryId: string,
  page: number,
  items: readonly CatalogueItem[],
): Promise<number> {
  let added = 0;
  await db.transaction(async (tx) => {
    if (page === 1) {
      await tx.run(`DELETE FROM items WHERE playlist_id = ? AND kind = ? AND category_id = ?`, [
        playlistId,
        kind,
        categoryId,
      ]);
    }
    const existing = await tx.all<{ item_id: string }>(
      `SELECT item_id FROM items WHERE playlist_id = ? AND kind = ? AND category_id = ?`,
      [playlistId, kind, categoryId],
    );
    const seen = new Set(existing.map((r) => r.item_id));
    const fresh = items.filter((i) => !seen.has(i.item_id) && seen.add(i.item_id));
    await insertItems(
      tx,
      playlistId,
      fresh.map((i) => ({ ...i, category_id: categoryId })),
      existing.length,
    );
    added = fresh.length;
  });
  return added;
}

/** Removes every cached row of a playlist (playlist deleted, or Clear Cache). */
export async function forgetPlaylist(db: Db, playlistId: string): Promise<void> {
  await db.transaction(async (tx) => {
    for (const table of ["items", "categories", "sync_state"]) {
      await tx.run(`DELETE FROM ${table} WHERE playlist_id = ?`, [playlistId]);
    }
  });
}
