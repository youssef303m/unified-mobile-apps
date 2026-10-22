// The React Query client (04-build/tech-stack.md "Server data"). Browse queries read SQLite and
// MMKV, so they never go stale on their own: they are refreshed by invalidation when a section
// finishes syncing or the user's lists change.
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, gcTime: 5 * 60_000, retry: false },
  },
});

/** Every browse query of a playlist starts with this key. */
export const browseKey = (playlistId: string) => ["browse", playlistId] as const;

// Bumped with every refresh, for screens that read the lists while rendering (the details pages'
// Resume button): an invalidated query with identical data does not re-render them.
let browseVersion = 0;
const versionListeners = new Set<() => void>();

export function subscribeBrowseVersion(listener: () => void): () => void {
  versionListeners.add(listener);
  return () => versionListeners.delete(listener);
}

export const getBrowseVersion = () => browseVersion;

/** Favourites, history or a synced section changed: refresh what is on screen. */
export function refreshBrowse(playlistId: string): void {
  browseVersion += 1;
  versionListeners.forEach((listener) => listener());
  void queryClient.invalidateQueries({ queryKey: browseKey(playlistId) });
}

/** Query functions run only when enabled; this narrows the context they close over. */
export function need<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Query ran without its input");
  return value;
}
