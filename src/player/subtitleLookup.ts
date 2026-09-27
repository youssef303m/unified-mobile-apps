// The external subtitle lookup of one video (player.md §5.2–5.3), shared by the player and the
// downloads (player.md §8.2: subtitles are saved next to a downloaded file). ibosub is an IBO
// server, so it is skipped in the dev-backend mode (docs/decisions.md D-059).
import { tmdbSearch } from "@/api/tmdb";
import type { BrowseContext } from "@/browse/context";
import { movieInfo } from "@/browse/details";
import { tmdbAllowed } from "@/content/rules/app";
import type { DownloadTarget } from "@/downloads/types";
import { networkMode } from "@/session/network";

import { languageName } from "./languages";
import type { VodItem } from "./session";
import { findSubtitles, type SubtitleSource } from "./subtitles/lookup";

export type SubtitledItem = Exclude<VodItem, { kind: "catchup" }>;

export async function lookupSubtitles(
  ctx: BrowseContext,
  item: SubtitledItem,
  uiLanguage: string,
): Promise<SubtitleSource | undefined> {
  if (networkMode() === "dev_backend") return undefined;
  const search = tmdbAllowed(ctx.store) ? tmdbSearch : undefined;
  if (item.kind === "movie") {
    const info = await movieInfo(ctx, item.item);
    return findSubtitles(
      {
        tmdb: {
          kind: "movie",
          tmdbId: info.tmdbId,
          name: info.name || item.item.name,
          releaseDate: info.releaseDate,
        },
      },
      { search, uiLanguage },
    );
  }
  return findSubtitles(
    {
      tmdb: { kind: "tv", tmdbId: item.tmdbId, name: item.series.name },
      episode: {
        seasonNumber: item.episode.seasonNumber,
        episodeNumber: item.episode.episodeNumber,
      },
    },
    { search, uiLanguage },
  );
}

/** Subtitles saved next to a download, as a source the subtitle sheet can list. */
export function savedSubtitleSource(
  saved: readonly { lang: string; text: string }[],
  uiLanguage: string,
): SubtitleSource | undefined {
  if (saved.length === 0) return undefined;
  const texts = new Map(saved.map((s) => [s.lang, s.text]));
  return {
    languages: saved.map((s) => ({
      code: s.lang,
      label: languageName(s.lang, uiLanguage) ?? s.lang,
      fileId: s.lang,
    })),
    load: async (language) => texts.get(language.code) ?? "",
  };
}

export function downloadTargetOf(item: SubtitledItem): DownloadTarget {
  return item.kind === "movie"
    ? { kind: "movie", item: item.item }
    : { kind: "episode", series: item.series, episode: item.episode };
}
