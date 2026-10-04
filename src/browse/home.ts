// N-01 · Streaming-style Home, built from local data only: the hero, then Continue Watching,
// My List, Live Now, Recently Added Movies and Series, and a row per category the user opened
// most. Items from adult categories never appear (R-060, R-063, R-064).
import { homeLiveFavouritesVisible } from "@/content/rules/library";
import { NEW_WINDOW_SECONDS } from "@/content/rules/content";
import type { CatalogueItem, ContentKind } from "@/content/types";
import {
  categoryFlags,
  heroCandidates,
  itemsPage,
  recentlyAdded,
  type CategoryFlags,
} from "@/db/queries/catalogue";
import type { SortKey } from "@/storage/settings";

import { nowSeconds, playlistIdOf, sourceTypeOf, type BrowseContext } from "./context";
import {
  continueWatching,
  favouriteItems,
  mostOpenedCategories,
  type ContinueEntry,
} from "./library";
import { ROW_PREVIEW } from "./rows";

/** Items in the Recently Added rows. */
export const HOME_RECENT_LIMIT = 20;
/** Style A: the hero is a carousel of the newest titles with artwork (docs/decisions.md D-085). */
export const HERO_COUNT = 5;
/** Category rows at the end of Home. */
export const HOME_CATEGORY_ROWS = 3;

export type HomeRow =
  | { id: "continue_movies" | "continue_series"; style: "continue"; entries: ContinueEntry[] }
  | { id: "my_list" | "recent_movies" | "recent_series"; style: "poster"; items: CatalogueItem[] }
  | { id: "live_now"; style: "live"; items: CatalogueItem[] }
  | {
      id: `category:${string}`;
      style: "poster";
      kind: ContentKind;
      categoryId: string;
      name: string;
      items: CatalogueItem[];
    };

export interface HomeData {
  /** The carousel: newest movies with artwork first, then series. */
  heroes: CatalogueItem[];
  rows: HomeRow[];
}

export interface HomeOptions {
  /** Settings "Toggle Home Favorites" (R-071). */
  homeFavorites: boolean;
  sorts: Record<"movie" | "series", SortKey>;
}

type Flags = Record<ContentKind, Map<string, CategoryFlags>>;

const safe = (flags: Flags) => (item: CatalogueItem) => {
  const f = flags[item.kind].get(item.category_id);
  return !f || !f.hideFromRows;
};

export async function loadHome(ctx: BrowseContext, options: HomeOptions): Promise<HomeData> {
  const pid = playlistIdOf(ctx);
  const flags: Flags = {
    live: await categoryFlags(ctx.db, pid, "live"),
    movie: await categoryFlags(ctx.db, pid, "movie"),
    series: await categoryFlags(ctx.db, pid, "series"),
  };
  const ok = safe(flags);
  const rows: HomeRow[] = [];

  const movies = (await continueWatching(ctx, "movie")).filter((e) => ok(e.item));
  if (movies.length) rows.push({ id: "continue_movies", style: "continue", entries: movies });
  const series = (await continueWatching(ctx, "series")).filter((e) => ok(e.item));
  if (series.length) rows.push({ id: "continue_series", style: "continue", entries: series });

  const myList = [
    ...(await favouriteItems(ctx, "movie")),
    ...(await favouriteItems(ctx, "series")),
  ].filter(ok);
  if (myList.length) rows.push({ id: "my_list", style: "poster", items: myList });

  if (homeLiveFavouritesVisible(sourceTypeOf(ctx), options.homeFavorites)) {
    const live = (await favouriteItems(ctx, "live")).filter(ok);
    if (live.length) rows.push({ id: "live_now", style: "live", items: live });
  }

  const now = nowSeconds(ctx);
  for (const [id, kind] of [
    ["recent_movies", "movie"],
    ["recent_series", "series"],
  ] as const) {
    const items = (await recentlyAdded(ctx.db, pid, kind, now, NEW_WINDOW_SECONDS)).slice(
      0,
      HOME_RECENT_LIMIT,
    );
    if (items.length) rows.push({ id, style: "poster", items });
  }

  for (const top of mostOpenedCategories(ctx.store, pid, ["movie", "series"], HOME_CATEGORY_ROWS)) {
    const f = flags[top.kind].get(top.categoryId);
    if (!f || f.hideFromRows) continue;
    const items = await itemsPage(ctx.db, pid, top.kind, top.categoryId, {
      offset: 0,
      limit: ROW_PREVIEW,
      sort: top.kind === "live" ? "default" : options.sorts[top.kind],
    });
    if (items.length)
      rows.push({
        id: `category:${top.kind}:${top.categoryId}`,
        style: "poster",
        kind: top.kind,
        categoryId: top.categoryId,
        name: f.name,
        items,
      });
  }

  // The most recently added movies with artwork, topped up with series.
  const heroes = await heroCandidates(ctx.db, pid, "movie", HERO_COUNT);
  if (heroes.length < HERO_COUNT)
    heroes.push(...(await heroCandidates(ctx.db, pid, "series", HERO_COUNT - heroes.length)));
  return { heroes, rows };
}
