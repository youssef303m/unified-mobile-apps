// TMDB enrichment of the details pages (02-backend/services.md "TMDB", "IBO image cache"): the
// backdrop, the title logo and, for movies, the cast. Only when TMDB is on (R-122) and the
// provider gave a TMDB id.
import { cachedImages } from "@/api/imageCache";
import { tmdbCredits, tmdbImages, tmdbImageUrl, type TmdbImages } from "@/api/tmdb";

export interface Artwork {
  backdrop?: string;
  logo?: string;
  cast: { name: string; photo?: string }[];
}

export interface EnrichOptions {
  /** R-122: TMDB off disables every call. */
  tmdbAllowed: boolean;
  /**
   * The IBO image cache serves Xtream playlists only; it is also skipped outside production and
   * fixtures, so development never reaches an IBO server (docs/decisions.md D-059).
   */
  useImageCache: boolean;
  signal?: AbortSignal;
}

const CAST_LIMIT = 15;

export async function artwork(
  kind: "movie" | "series",
  tmdbId: string | undefined,
  options: EnrichOptions,
): Promise<Artwork> {
  if (!options.tmdbAllowed || !tmdbId) return { cast: [] };
  const tmdbKind = kind === "movie" ? "movie" : "tv";
  let images: TmdbImages | undefined;
  try {
    images = options.useImageCache
      ? await cachedImages(tmdbKind, tmdbId, options.signal)
      : await tmdbImages(tmdbKind, tmdbId, options.signal);
  } catch {
    images = undefined;
  }
  let cast: Artwork["cast"] = [];
  if (kind === "movie") {
    try {
      cast = (await tmdbCredits(tmdbId, options.signal))
        .sort((a, b) => a.order - b.order)
        .slice(0, CAST_LIMIT)
        .map((c) => ({
          name: c.name,
          photo: c.profile_path ? tmdbImageUrl("w500", c.profile_path) : undefined,
        }));
    } catch {
      cast = [];
    }
  }
  const backdrop = images?.backdrops[0]?.file_path;
  const logo = images?.logos[0]?.file_path;
  return {
    backdrop: backdrop ? tmdbImageUrl("w1280", backdrop) : undefined,
    logo: logo ? tmdbImageUrl("w500", logo) : undefined,
    cast,
  };
}
