// IBO image cache (02-backend/services.md "IBO image cache"): TMDB image lists, Xtream
// playlists only. Other playlist types call TMDB directly.
import { config } from "@/config";

import { CancelledError } from "./errors";
import { getJson } from "./http";
import { asObject } from "./parse";
import { parseImages, tmdbImages, type TmdbImages } from "./tmdb";

/**
 * Reads the cache; on any error falls back to TMDB. Q-image-store: the `images/store`
 * write-back is skipped (read-only use of the cache).
 */
export async function cachedImages(
  kind: "movie" | "tv",
  tmdbId: string,
  signal?: AbortSignal,
): Promise<TmdbImages> {
  const section = kind === "movie" ? "movies" : "series";
  try {
    const body = await getJson(`${config.imageCache.url}/${section}/images/show/${tmdbId}`, {
      headers: { Authorization: `Bearer ${config.imageCache.token}` },
      signal,
    });
    return parseImages(asObject(body).data);
  } catch (error) {
    if (error instanceof CancelledError) throw error;
    return tmdbImages(kind, tmdbId, signal);
  }
}
