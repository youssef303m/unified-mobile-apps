// Search screen data (user-flows.md §10 Mobile): 400 ms debounce, minimum 2 characters, the
// synced sections searched (Q-search-lod) and recent searches when the field is empty.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { searchContent, isSearchable, type SearchSegment } from "@/browse/search";

import { browseKey, need } from "./queryClient";
import { useBrowse } from "./useBrowse";

export const SEARCH_DEBOUNCE_MS = 400;

export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function useSearch(text: string, segment: SearchSegment) {
  const ctx = useBrowse();
  const pid = ctx?.catalogue.playlistId ?? "none";
  const query = useDebounced(text.trim(), SEARCH_DEBOUNCE_MS);
  const searchable = isSearchable(query);
  const result = useQuery({
    queryKey: [...browseKey(pid), "search", segment, query],
    enabled: ctx !== undefined && searchable,
    staleTime: 0,
    queryFn: () => searchContent(need(ctx), query, segment),
  });
  return { ...result, query, searchable, pending: text.trim() !== query };
}
