// External subtitles for one video (player.md §5.2–5.4): the ibosub lookup runs once, the first
// time the subtitle sheet opens; the chosen language's SRT drives a cursor from the playback
// position; the delay is per video. ibosub is an IBO server, so it is skipped in the dev-backend
// mode (docs/decisions.md D-059: never call the real IBO servers during development).
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { tmdbSearch } from "@/api/tmdb";
import { movieInfo } from "@/browse/details";
import { showToast } from "@/components/Toast";
import { tmdbAllowed } from "@/content/rules/app";
import { useBrowse } from "@/hooks/useBrowse";
import { networkMode } from "@/session/network";

import type { ExternalState } from "./controls/TrackSheet";
import type { VodItem } from "./session";
import { findSubtitles, type SubtitleLanguage, type SubtitleSource } from "./subtitles/lookup";
import { parseSrt, SubtitleCursor, type Cue } from "./subtitles/srt";

export interface ExternalSubtitles {
  state: ExternalState;
  /** Starts the lookup (the sheet opened). */
  lookUp: () => void;
  selected: string | undefined;
  select: (code: string | undefined) => void;
  delay: number;
  setDelay: (delay: number) => void;
  cueAt: (position: number) => Cue | undefined;
  /** After a seek: re-search from the real position. */
  resetCursor: () => void;
}

interface SubtitleState {
  key: string;
  lookup: ExternalState;
  selected: string | undefined;
  delay: number;
  cursor: SubtitleCursor | undefined;
}

const fresh = (key: string): SubtitleState => ({
  key,
  lookup: { kind: "idle" },
  selected: undefined,
  delay: 0,
  cursor: undefined,
});

export function useExternalSubtitles(item: VodItem, itemKey: string): ExternalSubtitles {
  const { t, i18n } = useTranslation();
  const ctx = useBrowse();
  // Everything belongs to one video: a new key starts fresh (late replies for the previous one
  // are dropped because their key no longer matches).
  const [stored, setStored] = useState<SubtitleState>(() => fresh(itemKey));
  const state = stored.key === itemKey ? stored : fresh(itemKey);
  const update = useCallback(
    (key: string, patch: Partial<SubtitleState>) =>
      setStored((prev) => (prev.key === key ? { ...prev, ...patch } : { ...fresh(key), ...patch })),
    [],
  );
  const source = useRef<{ key: string; found: SubtitleSource } | undefined>(undefined);

  const lookUp = useCallback(() => {
    if (state.lookup.kind !== "idle" || !ctx || item.kind === "catchup") return;
    const key = itemKey;
    if (networkMode() === "dev_backend") {
      update(key, { lookup: { kind: "none" } });
      return;
    }
    update(key, { lookup: { kind: "loading" } });
    const uiLanguage = i18n.language;
    const search = tmdbAllowed(ctx.store) ? tmdbSearch : undefined;
    void (async () => {
      try {
        let found: SubtitleSource | undefined;
        if (item.kind === "movie") {
          const info = await movieInfo(ctx, item.item);
          found = await findSubtitles(
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
        } else {
          found = await findSubtitles(
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
        source.current = found ? { key, found } : undefined;
        update(key, {
          lookup: found ? { kind: "ok", languages: found.languages } : { kind: "none" },
        });
      } catch {
        update(key, { lookup: { kind: "none" } });
      }
    })();
  }, [ctx, i18n.language, item, itemKey, state.lookup.kind, update]);

  const delay = state.delay;
  const select = useCallback(
    (code: string | undefined) => {
      const key = itemKey;
      update(key, { selected: code, cursor: undefined });
      const found = source.current?.key === key ? source.current.found : undefined;
      const language = found?.languages.find((l: SubtitleLanguage) => l.code === code);
      if (!found || !language) return;
      void found
        .load(language)
        .then((srt) => {
          const next = new SubtitleCursor(parseSrt(srt));
          // Loading a new file resets the offset; the chosen delay applies again.
          next.setDelay(delay);
          update(key, { cursor: next });
        })
        .catch(() => {
          update(key, { selected: undefined });
          showToast({ text: t("msg_something_error_caused_while_downloading_subtitles_for") });
        });
    },
    [delay, itemKey, t, update],
  );

  const cursor = state.cursor;
  const setDelay = useCallback(
    (next: number) => {
      cursor?.setDelay(next);
      update(itemKey, { delay: next });
    },
    [cursor, itemKey, update],
  );

  return useMemo(
    () => ({
      state: state.lookup,
      lookUp,
      selected: state.selected,
      select,
      delay,
      setDelay,
      cueAt: (position: number) => cursor?.at(position),
      resetCursor: () => cursor?.reset(),
    }),
    [state.lookup, state.selected, lookUp, select, delay, setDelay, cursor],
  );
}
