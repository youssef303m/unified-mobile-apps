// The Movies, Series and Live tabs (03-design/screens.md, user-flows.md §5, §7, §8): the rows of
// a section (R-053), a short preview of each row, and the full list behind "See all" (a
// CategoryFeed, paged from SQLite; Stalker pages are fetched from the portal as the list grows).
import { readJson } from "@/api/store";
import { customMembers, customRows } from "@/content/rules/customCategories";
import { buildRows, NEW_WINDOW_SECONDS, pickTopRated, type Row } from "@/content/rules/content";
import { hiddenCategories } from "@/content/rules/live";
import type { CatalogueItem, ContentKind } from "@/content/types";
import {
  categories,
  categoryCount,
  itemsByIds,
  itemsPage,
  recentlyAdded,
  topRatedCandidates,
} from "@/db/queries/catalogue";
import type { SortKey } from "@/storage/settings";
import { listTypeFor, playlistKeys } from "@/storage/keys";

import { nowSeconds, playlistIdOf, sourceTypeOf, type BrowseContext } from "./context";
import { continueWatching, favouriteItems, recentChannels } from "./library";

export type { Row };

/** Items shown in a row before "See all". */
export const ROW_PREVIEW = 10;
/** Items per page of a category list. */
export const FEED_PAGE = 60;

/**
 * R-053 rows of a section, without "Search All" (the Search icon of every tab replaces it,
 * user-flows.md §7 Mobile). Custom rows appear only when the feature is on (R-080).
 */
export async function tabRows(ctx: BrowseContext, kind: ContentKind): Promise<Row[]> {
  const pid = playlistIdOf(ctx);
  const rows = buildRows({
    kind,
    source: sourceTypeOf(ctx),
    categories: await categories(ctx.db, pid, kind),
    customRows: customRows(ctx.store),
    hidden: hiddenCategories(ctx.store, pid, kind),
  });
  return rows.filter((r) => !(r.type === "virtual" && r.id === "all"));
}

/** A virtual or custom row's whole list (they are short: at most a few hundred items). */
async function virtualItems(
  ctx: BrowseContext,
  kind: ContentKind,
  row: Exclude<Row, { type: "category" }>,
): Promise<{ items: CatalogueItem[]; canShuffle?: boolean }> {
  const pid = playlistIdOf(ctx);
  if (row.type === "custom") {
    const type = listTypeFor(kind);
    if (sourceTypeOf(ctx) === "stalker")
      return {
        items:
          readJson<CatalogueItem[]>(
            ctx.store,
            playlistKeys(pid).stalkerCustomMembers(type, row.id),
          ) ?? [],
      };
    const ids = customMembers(ctx.store, pid, type, row.id);
    return { items: await itemsByIds(ctx.db, pid, kind, ids) };
  }
  switch (row.id) {
    case "recent":
      if (kind === "live") return { items: await recentChannels(ctx) };
      return { items: (await continueWatching(ctx, kind)).map((e) => e.item) };
    case "favourite":
      return { items: await favouriteItems(ctx, kind) };
    case "top_rated": {
      if (kind === "live") return { items: [] };
      const { top, pool } = await topRatedCandidates(ctx.db, pid, kind);
      return pickTopRated(top, pool);
    }
    case "newly_added":
    case "recently_modified":
      if (kind === "live") return { items: [] };
      return {
        items: await recentlyAdded(ctx.db, pid, kind, nowSeconds(ctx), NEW_WINDOW_SECONDS),
      };
    default:
      return { items: [] };
  }
}

/** The first items of a row, for the rows view of a tab. */
export async function rowPreview(
  ctx: BrowseContext,
  kind: ContentKind,
  row: Row,
  sort: SortKey,
): Promise<{ items: CatalogueItem[]; canShuffle?: boolean }> {
  if (row.type !== "category") {
    const result = await virtualItems(ctx, kind, row);
    return { ...result, items: result.items.slice(0, ROW_PREVIEW) };
  }
  const feed = new CategoryFeed(ctx, kind, row, sort);
  return { items: (await feed.next(ROW_PREVIEW)).items };
}

/**
 * The full list of a row, page by page. Provider categories are paged from SQLite (sorted,
 * R-090); a paged source (Stalker) fetches portal pages first, sorted by the portal. Virtual rows
 * are read whole.
 */
export class CategoryFeed {
  private offset = 0;
  /** Stalker: the next portal page, or undefined once the category is complete. */
  private nextPortalPage: number | undefined = 1;
  private virtual?: CatalogueItem[];

  constructor(
    private readonly ctx: BrowseContext,
    readonly kind: ContentKind,
    readonly row: Row,
    private readonly sort: SortKey,
  ) {}

  private get paged(): boolean {
    return Boolean(this.ctx.catalogue.source.page);
  }

  /** The next page after the ones already read. */
  async next(limit = FEED_PAGE): Promise<{ items: CatalogueItem[]; done: boolean }> {
    const result = await this.page(this.offset, limit);
    this.offset += result.items.length;
    return result;
  }

  /**
   * One page by offset (infinite lists refetch from offset 0). Virtual rows are read again at
   * offset 0, so a refetch shows the latest favourites and history.
   */
  async page(
    offset: number,
    limit = FEED_PAGE,
  ): Promise<{ items: CatalogueItem[]; done: boolean }> {
    if (this.row.type !== "category") {
      if (offset === 0 || !this.virtual)
        this.virtual = (await virtualItems(this.ctx, this.kind, this.row)).items;
      const items = this.virtual.slice(offset, offset + limit);
      return { items, done: offset + items.length >= this.virtual.length };
    }
    const pid = playlistIdOf(this.ctx);
    const categoryId = this.row.id;
    if (this.paged) {
      // Fetch portal pages until this page is covered or the category is complete. Page 1 is
      // fetched again once per feed, so a new session shows the portal's current list.
      while (
        this.nextPortalPage !== undefined &&
        (this.nextPortalPage === 1 ||
          (await categoryCount(this.ctx.db, pid, this.kind, categoryId)) < offset + limit)
      ) {
        this.nextPortalPage = await this.ctx.catalogue.loadPages(
          this.kind,
          categoryId,
          this.nextPortalPage,
          this.sort,
        );
      }
    }
    const items = await itemsPage(this.ctx.db, pid, this.kind, categoryId, {
      offset,
      limit,
      // Portal lists are already in the portal's sort order.
      sort: this.paged ? "default" : this.sort,
    });
    const done = items.length < limit && (!this.paged || this.nextPortalPage === undefined);
    return { items, done };
  }
}
