// Search (03-design/screens.md, user-flows.md §10): SQLite FTS over the synced sections
// (Q-search-lod), minimum 2 characters, adult categories never returned (R-064) and hidden
// categories left out (R-098). Stalker: the portal's own search for movies and series; no live
// search (R-051, R-098).
import { searchScope } from "@/content/rules/content";
import { hiddenCategories } from "@/content/rules/live";
import type { CatalogueItem, ContentKind } from "@/content/types";
import { StalkerSource } from "@/content/StalkerSource";
import { categoryFlags, ftsQuery, search } from "@/db/queries/catalogue";

import { playlistIdOf, type BrowseContext } from "./context";

export type SearchSegment = "all" | ContentKind;

export interface SearchResults {
  live: CatalogueItem[];
  movie: CatalogueItem[];
  series: CatalogueItem[];
  /** Live search is not available for this source (Stalker). */
  liveUnavailable: boolean;
}

/** Results per kind on the "All" segment, and on a single-kind segment. */
export const SEARCH_LIMITS = { all: 20, single: 100 } as const;

const EMPTY: Omit<SearchResults, "liveUnavailable"> = { live: [], movie: [], series: [] };

export function isSearchable(text: string): boolean {
  return ftsQuery(text) !== undefined;
}

/** The sections a segment needs synced before it can be searched. */
export function kindsFor(ctx: BrowseContext, segment: SearchSegment): ContentKind[] {
  const { kinds } = searchScope(ctx.catalogue.source.type);
  return segment === "all" ? kinds : kinds.filter((k) => k === segment);
}

export async function searchContent(
  ctx: BrowseContext,
  text: string,
  segment: SearchSegment,
): Promise<SearchResults> {
  const source = ctx.catalogue.source;
  const scope = searchScope(source.type);
  const liveUnavailable = !scope.kinds.includes("live");
  if (!isSearchable(text)) return { ...EMPTY, liveUnavailable };
  const kinds = kindsFor(ctx, segment);
  const limit = segment === "all" ? SEARCH_LIMITS.all : SEARCH_LIMITS.single;
  const pid = playlistIdOf(ctx);
  const results: SearchResults = { live: [], movie: [], series: [], liveUnavailable };

  if (scope.portalSearch && source instanceof StalkerSource) {
    for (const kind of kinds) {
      if (kind === "live") continue;
      const flags = await categoryFlags(ctx.db, pid, kind);
      const found = await source.search(kind, text.trim());
      // R-064: portal results from an adult category are dropped.
      results[kind] = found.filter((i) => !flags.get(i.category_id)?.isAdult).slice(0, limit);
    }
    return results;
  }

  const hidden = Object.fromEntries(
    kinds.map((k) => [k, hiddenCategories(ctx.store, pid, k)]),
  ) as Partial<Record<ContentKind, string[]>>;
  for (const kind of kinds) {
    results[kind] = await search(ctx.db, pid, text, { kinds: [kind], hidden, limit });
  }
  return results;
}
