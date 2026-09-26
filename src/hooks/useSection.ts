// R-050 load on demand: a section (Live, Movies, Series) downloads the first time it is opened,
// with progress and a cancel button, then stays loaded for the session. The state is shared by
// every screen (Home prefetches movies and series in the background, Q-home-prefetch).
import { useEffect } from "react";
import { create } from "zustand";

import { CancelledError } from "@/api/errors";
import type { ContentKind } from "@/content/types";
import { useSession } from "@/session/store";

import { refreshBrowse } from "./queryClient";

export type SectionStatus =
  | { state: "idle" }
  | { state: "loading"; fraction: number }
  | { state: "ready" }
  | { state: "cancelled" }
  | { state: "error"; error: unknown };

type Key = `${string}:${ContentKind}`;

const useSections = create<Record<Key, SectionStatus>>()(() => ({}));
const controllers = new Map<Key, AbortController>();

const keyOf = (playlistId: string, kind: ContentKind): Key => `${playlistId}:${kind}`;
const setStatus = (key: Key, status: SectionStatus) =>
  useSections.setState({ [key]: status } as Record<Key, SectionStatus>);

/** Starts (or joins) the section download of the active playlist. */
export function loadSection(kind: ContentKind): Promise<void> {
  const catalogue = useSession.getState().active?.catalogue;
  if (!catalogue) return Promise.resolve();
  const pid = catalogue.playlistId;
  const key = keyOf(pid, kind);
  if (catalogue.isLoaded(kind)) {
    if (useSections.getState()[key]?.state !== "ready") setStatus(key, { state: "ready" });
    return Promise.resolve();
  }
  if (!controllers.has(key)) {
    const controller = new AbortController();
    controllers.set(key, controller);
    setStatus(key, { state: "loading", fraction: 0 });
    catalogue
      .ensureSection(kind, {
        signal: controller.signal,
        onProgress: (p) => {
          if (!controller.signal.aborted)
            setStatus(key, { state: "loading", fraction: p.fraction });
        },
      })
      .then(
        () => setStatus(key, { state: "ready" }),
        (error: unknown) =>
          setStatus(
            key,
            controller.signal.aborted || error instanceof CancelledError
              ? { state: "cancelled" }
              : { state: "error", error },
          ),
      )
      .finally(() => {
        controllers.delete(key);
        // Rows render from the cached copy meanwhile; show the fresh data now.
        refreshBrowse(pid);
      });
  }
  return new Promise((resolve) => {
    const unsubscribe = useSections.subscribe((s) => {
      if (s[key]?.state !== "loading") {
        unsubscribe();
        resolve();
      }
    });
  });
}

/** The loader's Cancel button (R-050: the download is cancellable). */
export function cancelSection(kind: ContentKind): void {
  const pid = useSession.getState().active?.catalogue.playlistId;
  if (pid) controllers.get(keyOf(pid, kind))?.abort();
}

/** The section's state; opening the screen starts the download. */
export function useSection(kind: ContentKind, autoLoad = true): SectionStatus {
  const catalogue = useSession((s) => s.active?.catalogue);
  const pid = catalogue?.playlistId ?? "";
  const status = useSections((s) => s[keyOf(pid, kind)]);
  useEffect(() => {
    if (autoLoad && catalogue) void loadSection(kind);
  }, [autoLoad, catalogue, kind]);
  if (catalogue?.isLoaded(kind)) return { state: "ready" };
  return status ?? { state: "idle" };
}

/**
 * N-09 pull to refresh (R-052): re-downloads the sections loaded so far. Errors are left to the
 * section states, so the screens show them.
 */
export async function refreshCatalogue(): Promise<void> {
  const catalogue = useSession.getState().active?.catalogue;
  if (!catalogue) return;
  try {
    await catalogue.refresh();
  } finally {
    refreshBrowse(catalogue.playlistId);
  }
}

/**
 * Q-home-prefetch (N-01): after Home appears, movies and then series download in the
 * background, one at a time, so the Home rows fill; live follows when there are live favourites.
 */
export async function prefetchForHome(withLive: boolean): Promise<void> {
  await loadSection("movie");
  await loadSection("series");
  if (withLive) await loadSection("live");
}
