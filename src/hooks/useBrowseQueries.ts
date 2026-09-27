// Browse data hooks: SQLite and MMKV reads through React Query, keyed under the playlist so a
// sync or a list change refreshes them (queryClient.ts).
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { loadHome } from "@/browse/home";
import { hideableRows } from "@/browse/settings";
import { CategoryFeed, FEED_PAGE, rowPreview, tabRows, type Row } from "@/browse/rows";
import type { ContentKind } from "@/content/types";
import { categoryFlags, type CategoryFlags } from "@/db/queries/catalogue";
import { readSettings, type SortKey } from "@/storage/settings";
import { kvStore } from "@/storage/kv";

import { browseKey, need } from "./queryClient";
import { useBrowse } from "./useBrowse";

const NONE = "none";

export function useHome() {
  const ctx = useBrowse();
  const pid = ctx?.catalogue.playlistId ?? NONE;
  return useQuery({
    queryKey: [...browseKey(pid), "home"],
    enabled: ctx !== undefined,
    queryFn: () => {
      const settings = readSettings(kvStore);
      return loadHome(need(ctx), {
        homeFavorites: settings.homeFavorites,
        sorts: { movie: settings.vodSort, series: settings.seriesSort },
      });
    },
  });
}

export function useTabRows(kind: ContentKind, enabled = true) {
  const ctx = useBrowse();
  const pid = ctx?.catalogue.playlistId ?? NONE;
  return useQuery({
    queryKey: [...browseKey(pid), "rows", kind],
    enabled: enabled && ctx !== undefined,
    queryFn: () => tabRows(need(ctx), kind),
  });
}

export function useRowPreview(kind: ContentKind, row: Row, sort: SortKey, enabled = true) {
  const ctx = useBrowse();
  const pid = ctx?.catalogue.playlistId ?? NONE;
  return useQuery({
    queryKey: [...browseKey(pid), "preview", kind, row.type, row.id, sort],
    enabled: enabled && ctx !== undefined,
    queryFn: () => rowPreview(need(ctx), kind, row, sort),
  });
}

/** A row's full list, page by page (the category grid, the channel list, My List). */
export function useFeed(kind: ContentKind, row: Row | undefined, sort: SortKey, enabled = true) {
  const ctx = useBrowse();
  const pid = ctx?.catalogue.playlistId ?? NONE;
  const feed = useMemo(
    () => (ctx && row ? new CategoryFeed(ctx, kind, row, sort) : undefined),
    [ctx, kind, row, sort],
  );
  const query = useInfiniteQuery({
    queryKey: [...browseKey(pid), "feed", kind, row?.type, row?.id, sort],
    enabled: enabled && feed !== undefined,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => need(feed).page(pageParam, FEED_PAGE),
    getNextPageParam: (last, pages) =>
      last.done ? undefined : pages.reduce((n, p) => n + p.items.length, 0),
  });
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  return { ...query, items };
}

/** R-060 flags of a section's categories (locks, favourites, history). */
export function useCategoryFlags(kind: ContentKind) {
  const ctx = useBrowse();
  const pid = ctx?.catalogue.playlistId ?? NONE;
  const query = useQuery({
    queryKey: [...browseKey(pid), "flags", kind],
    enabled: ctx !== undefined,
    queryFn: () => categoryFlags(need(ctx).db, pid, kind),
  });
  return query.data ?? new Map<string, CategoryFlags>();
}

/** Settings → Hide Categories: the rows of a section with their hidden flag. */
export function useHideableRows(kind: ContentKind) {
  const ctx = useBrowse();
  const pid = ctx?.catalogue.playlistId ?? NONE;
  return useQuery({
    queryKey: [...browseKey(pid), "hideable", kind],
    enabled: ctx !== undefined,
    queryFn: () => hideableRows(need(ctx), kind),
  });
}
