// External subtitles for one video (player.md §5.2–5.4): the ibosub lookup runs once, the first
// time the subtitle sheet opens; the chosen language's SRT drives a cursor from the playback
// position; the delay is per video. The lookup itself is in subtitleLookup.ts; a downloaded
// video falls back to the subtitles saved next to it (offline), and keeps the one chosen.
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { showToast } from "@/components/Toast";
import { downloads } from "@/downloads";
import { useBrowse } from "@/hooks/useBrowse";

import type { ExternalState } from "./controls/TrackSheet";
import type { VodItem } from "./session";
import { downloadTargetOf, lookupSubtitles, savedSubtitleSource } from "./subtitleLookup";
import type { SubtitleLanguage, SubtitleSource } from "./subtitles/lookup";
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
    const uiLanguage = i18n.language;
    // player.md §8.2: a downloaded video also has the subtitles saved next to it (offline).
    const saved = savedSubtitleSource(
      downloads().savedSubtitles(ctx.catalogue.playlistId, downloadTargetOf(item)),
      uiLanguage,
    );
    update(key, { lookup: { kind: "loading" } });
    void (async () => {
      let found: SubtitleSource | undefined;
      try {
        found = await lookupSubtitles(ctx, item, uiLanguage);
      } catch {
        found = undefined;
      }
      found ??= saved;
      source.current = found ? { key, found } : undefined;
      update(key, {
        lookup: found ? { kind: "ok", languages: found.languages } : { kind: "none" },
      });
    })();
  }, [ctx, i18n.language, item, itemKey, state.lookup.kind, update]);

  // player.md §8.2: a subtitle chosen for a downloaded video is kept next to the file.
  const saveForOffline = useCallback(
    (lang: string, srt: string) => {
      if (!ctx || item.kind === "catchup" || !srt) return;
      const record = downloads().recordFor(ctx.catalogue.playlistId, downloadTargetOf(item));
      if (record?.status === "done") downloads().saveSubtitle(record.id, lang, srt);
    },
    [ctx, item],
  );

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
          saveForOffline(language.code, srt);
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
    [delay, itemKey, saveForOffline, t, update],
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
