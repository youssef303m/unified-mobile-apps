// Movie and Series details data: the item, provider info (R-057), TMDB artwork (R-122) and the
// saved positions (R-075, R-076).
import { useQuery } from "@tanstack/react-query";

import {
  episodeResumes,
  findItem,
  isAdultItem,
  movieInfo,
  movieResume,
  seriesDetails,
  seriesPlayTarget,
} from "@/browse/details";
import { artwork } from "@/browse/enrich";
import type { ContentKind } from "@/content/types";
import { networkMode } from "@/session/network";
import { readSettings } from "@/storage/settings";
import { kvStore } from "@/storage/kv";

import { browseKey, need } from "./queryClient";
import { useBrowse } from "./useBrowse";

const NONE = "none";

export function useItem(kind: ContentKind, itemId: string) {
  const ctx = useBrowse();
  const pid = ctx?.catalogue.playlistId ?? NONE;
  return useQuery({
    queryKey: [...browseKey(pid), "item", kind, itemId],
    enabled: ctx !== undefined,
    queryFn: async () => {
      const item = await findItem(need(ctx), kind, itemId);
      if (!item) return null;
      return { item, isAdult: await isAdultItem(need(ctx), item) };
    },
  });
}

export function useMovieDetails(kind: ContentKind, itemId: string) {
  const ctx = useBrowse();
  const pid = ctx?.catalogue.playlistId ?? NONE;
  const item = useItem(kind, itemId);
  const found = item.data?.item;
  const info = useQuery({
    queryKey: [...browseKey(pid), "movie-info", itemId],
    enabled: ctx !== undefined && found !== undefined,
    queryFn: ({ signal }) => movieInfo(need(ctx), need(found), signal),
  });
  const resume = found && ctx ? movieResume(ctx, found) : undefined;
  return { item, info, resume };
}

export function useSeriesDetails(itemId: string) {
  const ctx = useBrowse();
  const pid = ctx?.catalogue.playlistId ?? NONE;
  const item = useItem("series", itemId);
  const found = item.data?.item;
  const details = useQuery({
    queryKey: [...browseKey(pid), "series-info", itemId],
    enabled: ctx !== undefined && found !== undefined,
    queryFn: ({ signal }) => seriesDetails(need(ctx), need(found), signal),
  });
  const seasons = details.data?.kind === "ok" ? details.data.details.seasons : [];
  const playTarget = found && ctx ? seriesPlayTarget(ctx, found, seasons) : undefined;
  const resumes = found && ctx ? episodeResumes(ctx, found) : {};
  return { item, details, playTarget, resumes };
}

/** TMDB backdrop, logo and cast (R-122: none when TMDB is off). */
export function useArtwork(kind: "movie" | "series", tmdbId: string | undefined) {
  const ctx = useBrowse();
  const type = ctx?.catalogue.source.type;
  const mode = networkMode();
  return useQuery({
    queryKey: ["tmdb", kind, tmdbId ?? NONE, type],
    enabled: tmdbId !== undefined,
    staleTime: Infinity,
    queryFn: ({ signal }) =>
      artwork(kind, tmdbId, {
        tmdbAllowed: readSettings(kvStore).tmdb,
        useImageCache: type === "xtream" && mode !== "dev_backend",
        signal,
      }),
  });
}
